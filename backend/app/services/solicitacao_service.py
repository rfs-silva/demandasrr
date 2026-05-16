"""Casos de uso de Solicitação."""

from __future__ import annotations

from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.core.logging import get_logger
from app.models.enums import (
    PERFIS_OPERACIONAIS,
    AcaoAudit,
    EntidadeAudit,
    PerfilUsuario,
    Situacao,
    StatusSolicitacao,
    TipoEventoSolicitacao,
)
from app.models.solicitacao import Solicitacao
from app.models.solicitacao_evento import SolicitacaoEvento
from app.models.usuario import Usuario
from app.repositories import pessoa_repo, solicitacao_repo
from app.schemas.solicitacao import (
    ComentarioCreate,
    SolicitacaoCreate,
    SolicitacaoUpdate,
    codigo_solicitacao,
)
from app.services import audit_service


def _solicitacao_label(s: Solicitacao) -> str:
    return f"Solicitação {codigo_solicitacao(s.id)}"

log = get_logger("solicitacao")


# ---- Transições de status permitidas ----
_TRANSITIONS: dict[StatusSolicitacao, set[StatusSolicitacao]] = {
    StatusSolicitacao.cadastrada: {
        StatusSolicitacao.em_analise,
        StatusSolicitacao.cancelada,
    },
    StatusSolicitacao.em_analise: {
        StatusSolicitacao.atendida,
        StatusSolicitacao.indeferida,
        StatusSolicitacao.cancelada,
    },
    StatusSolicitacao.atendida: set(),
    StatusSolicitacao.indeferida: set(),
    StatusSolicitacao.cancelada: {StatusSolicitacao.em_analise},
}


class TransicaoInvalida(AppError):
    code = "TRANSICAO_INVALIDA"
    default_status = 409
    default_message = "Transição de status inválida"


class PessoaInativaError(AppError):
    code = "PESSOA_INATIVA"
    default_status = 409
    default_message = "Não é possível abrir solicitação para pessoa inativa"


class EdicaoBloqueadaError(AppError):
    code = "EDICAO_BLOQUEADA"
    default_status = 409
    default_message = "Solicitação não pode mais ser editada"


class ParecerObrigatorioError(AppError):
    code = "PARECER_OBRIGATORIO"
    default_status = 400
    default_message = "Informe o parecer para concluir esta ação"


class ReaberturaBloqueadaError(AppError):
    code = "REABERTURA_BLOQUEADA"
    default_status = 403
    default_message = "Seu perfil não pode reabrir solicitações canceladas"


def _pode_reabrir_cancelada(requester: Usuario) -> bool:
    if requester.perfil == PerfilUsuario.administrador:
        return True
    if requester.perfil == PerfilUsuario.suporte:
        return bool(getattr(requester, "pode_reabrir_solicitacoes", False))
    return False


def _status_permitidos_para(requester: Usuario, atual: StatusSolicitacao) -> set[StatusSolicitacao]:
    if requester.perfil == PerfilUsuario.administrador:
        return {status for status in StatusSolicitacao if status != atual}
    return set(_TRANSITIONS.get(atual, set()))


def _pode_criar_solicitacao(autor: Usuario) -> bool:
    """Quem pode abrir uma solicitação:

    - gestor_solicitante: sempre (cria a própria demanda).
    - administrador: sempre.
    - suporte/governador: só se a flag ``pode_criar_solicitacoes`` estiver ativa.
    """
    if autor.perfil in (
        PerfilUsuario.gestor_solicitante,
        PerfilUsuario.administrador,
    ):
        return True
    if autor.perfil in (PerfilUsuario.suporte, PerfilUsuario.governador):
        return bool(autor.pode_criar_solicitacoes)
    return False


async def criar(
    session: AsyncSession,
    *,
    body: SolicitacaoCreate,
    autor: Usuario,
    request: Request | None = None,
) -> Solicitacao:
    # RBAC: apenas perfis liberados podem criar solicitação.
    if not _pode_criar_solicitacao(autor):
        raise ForbiddenError(
            "Seu perfil não tem permissão para abrir solicitações. "
            "Peça ao administrador para liberar este recurso para você."
        )

    # Resolve a pessoa: solicitante usa/cria a própria (a partir do CPF do
    # usuário); demais perfis devem mandar pessoa_id explícito.
    pessoa_id = body.pessoa_id
    if pessoa_id is None:
        if autor.perfil != PerfilUsuario.gestor_solicitante:
            raise AppError(
                "pessoa_id é obrigatório para este perfil.",
                status_code=400,
            )
        if autor.pessoa_id is None:
            # Garante Pessoa vinculada ao usuário (idempotente).
            from app.services.usuario_service import _ensure_pessoa_para_usuario

            await _ensure_pessoa_para_usuario(session, usuario=autor)
            await session.flush()
        pessoa_id = autor.pessoa_id

    pessoa = await pessoa_repo.get_by_id(session, pessoa_id)
    if pessoa is None:
        raise NotFoundError("Pessoa não encontrada")
    if pessoa.situacao != Situacao.ativo:
        raise PessoaInativaError()

    municipio_str = pessoa.municipio.nome
    if pessoa.municipio.eh_outros and pessoa.localidade:
        municipio_str = f"{pessoa.municipio.nome} — {pessoa.localidade}"

    solicitacao = Solicitacao(
        pessoa_id=pessoa.id,
        usuario_id=autor.id,
        municipio=municipio_str,
        titulo=body.titulo,
        area=body.area,
        descricao=body.descricao,
        status=StatusSolicitacao.cadastrada,
    )
    await solicitacao_repo.add(session, solicitacao)

    # Registra evento "criada" na mesma transação.
    session.add(
        SolicitacaoEvento(
            solicitacao_id=solicitacao.id,
            usuario_id=autor.id,
            tipo=TipoEventoSolicitacao.criada,
            de_status=None,
            para_status=StatusSolicitacao.cadastrada,
        )
    )

    await audit_service.log_event(
        session,
        acao=AcaoAudit.solicitacao_criada,
        entidade=EntidadeAudit.solicitacao,
        actor=autor,
        entidade_id=solicitacao.id,
        entidade_label=_solicitacao_label(solicitacao),
        detalhes={
            "area": body.area.value,
            "pessoa_id": str(pessoa.id),
            "pessoa_nome": pessoa.nome,
        },
        request=request,
    )

    await session.commit()
    refreshed = await solicitacao_repo.get_by_id(session, solicitacao.id)
    log.info(
        "solicitacao.criada",
        solicitacao_id=str(solicitacao.id),
        usuario_id=str(autor.id),
        pessoa_id=str(pessoa.id),
        area=body.area.value,
    )
    return refreshed  # type: ignore[return-value]


async def obter(
    session: AsyncSession,
    *,
    solicitacao_id: UUID,
    requester: Usuario,
) -> Solicitacao:
    s = await solicitacao_repo.get_by_id(session, solicitacao_id)
    if s is None:
        raise NotFoundError("Solicitação não encontrada")
    # Gestor solicitante só pode visualizar as próprias.
    if (
        requester.perfil == PerfilUsuario.gestor_solicitante
        and s.usuario_id != requester.id
    ):
        raise ForbiddenError("Sem permissão para visualizar esta solicitação")
    return s


async def editar(
    session: AsyncSession,
    *,
    solicitacao_id: UUID,
    body: SolicitacaoUpdate,
    requester: Usuario,
    request: Request | None = None,
) -> Solicitacao:
    s = await solicitacao_repo.get_by_id(session, solicitacao_id)
    if s is None:
        raise NotFoundError("Solicitação não encontrada")

    # Edição é EXCLUSIVA do dono (quem abriu) e somente enquanto a solicitação
    # ainda está cadastrada. Nem admin nem suporte podem alterar o corpo da
    # solicitação aberta por um solicitante — apenas mudar status, comentar e
    # anexar/desanexar (limitado ao próprio anexo).
    if s.usuario_id != requester.id:
        raise ForbiddenError("Apenas o autor pode editar esta solicitação")

    # Só pode editar enquanto está cadastrada
    if s.status != StatusSolicitacao.cadastrada:
        raise EdicaoBloqueadaError(
            "Solicitação só pode ser editada antes de entrar em análise.",
            details={"status_atual": s.status.value},
        )

    mudanca: list[str] = []
    if body.titulo is not None and body.titulo != s.titulo:
        mudanca.append("título atualizado")
        s.titulo = body.titulo
    if body.area is not None and body.area != s.area:
        mudanca.append(f"área: {s.area.value} → {body.area.value}")
        s.area = body.area
    if body.descricao is not None and body.descricao != s.descricao:
        mudanca.append("descrição atualizada")
        s.descricao = body.descricao

    if not mudanca:
        return s  # nada a fazer

    session.add(
        SolicitacaoEvento(
            solicitacao_id=s.id,
            usuario_id=requester.id,
            tipo=TipoEventoSolicitacao.editada,
            de_status=s.status,
            para_status=s.status,
            comentario="; ".join(mudanca),
            interno=False,
        )
    )
    await audit_service.log_event(
        session,
        acao=AcaoAudit.solicitacao_editada,
        entidade=EntidadeAudit.solicitacao,
        actor=requester,
        entidade_id=s.id,
        entidade_label=_solicitacao_label(s),
        detalhes={"mudanca": mudanca},
        request=request,
    )

    await session.commit()
    await session.refresh(s)
    log.info(
        "solicitacao.editada",
        solicitacao_id=str(s.id),
        por=str(requester.id),
        mudanca=mudanca,
    )
    return s


async def comentar(
    session: AsyncSession,
    *,
    solicitacao_id: UUID,
    body: ComentarioCreate,
    requester: Usuario,
    request: Request | None = None,
) -> SolicitacaoEvento:
    """Cria uma anotação interna. Só gestor/administrador chamam este endpoint."""
    s = await solicitacao_repo.get_by_id(session, solicitacao_id)
    if s is None:
        raise NotFoundError("Solicitação não encontrada")

    evento = SolicitacaoEvento(
        solicitacao_id=s.id,
        usuario_id=requester.id,
        tipo=TipoEventoSolicitacao.comentario,
        de_status=None,
        para_status=None,
        comentario=body.texto,
        interno=True,
    )
    session.add(evento)
    await audit_service.log_event(
        session,
        acao=AcaoAudit.solicitacao_comentario,
        entidade=EntidadeAudit.solicitacao,
        actor=requester,
        entidade_id=s.id,
        entidade_label=_solicitacao_label(s),
        detalhes={"texto": body.texto[:300]},
        request=request,
    )
    await session.commit()
    refreshed = await solicitacao_repo.get_evento_with_user(session, evento.id)
    log.info(
        "solicitacao.comentario",
        solicitacao_id=str(s.id),
        evento_id=str(evento.id),
        por=str(requester.id),
    )
    return refreshed  # type: ignore[return-value]


async def alterar_status(
    session: AsyncSession,
    *,
    solicitacao_id: UUID,
    novo_status: StatusSolicitacao,
    parecer: str | None = None,
    requester: Usuario,
    request: Request | None = None,
) -> Solicitacao:
    s = await solicitacao_repo.get_by_id(session, solicitacao_id)
    if s is None:
        raise NotFoundError("Solicitação não encontrada")

    if s.status == StatusSolicitacao.cancelada and novo_status == StatusSolicitacao.em_analise:
        if not _pode_reabrir_cancelada(requester):
            raise ReaberturaBloqueadaError()

    permitidos = _status_permitidos_para(requester, s.status)
    if novo_status not in permitidos:
        raise TransicaoInvalida(
            f"Não é possível mudar de '{s.status.value}' para '{novo_status.value}'",
            details={
                "atual": s.status.value,
                "solicitado": novo_status.value,
                "permitidos": sorted(p.value for p in permitidos),
            },
        )

    parecer_limpo = parecer.strip() if parecer else None
    if novo_status in (StatusSolicitacao.indeferida, StatusSolicitacao.cancelada) and not parecer_limpo:
        raise ParecerObrigatorioError(
            details={"status": novo_status.value}
        )

    anterior = s.status
    s.status = novo_status

    session.add(
        SolicitacaoEvento(
            solicitacao_id=s.id,
            usuario_id=requester.id,
            tipo=TipoEventoSolicitacao.status_alterado,
            de_status=anterior,
            para_status=novo_status,
            comentario=parecer_limpo,
        )
    )
    await audit_service.log_event(
        session,
        acao=AcaoAudit.solicitacao_status_alterado,
        entidade=EntidadeAudit.solicitacao,
        actor=requester,
        entidade_id=s.id,
        entidade_label=_solicitacao_label(s),
        detalhes={
            "de": anterior.value,
            "para": novo_status.value,
            "parecer": parecer_limpo,
        },
        request=request,
    )

    await session.commit()
    await session.refresh(s)
    log.info(
        "solicitacao.status_alterado",
        solicitacao_id=str(s.id),
        de=anterior.value,
        para=novo_status.value,
        por=str(requester.id),
    )
    return s
