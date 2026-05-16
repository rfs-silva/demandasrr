"""Casos de uso de Usuário."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select

from fastapi import Request

from app.core.cpf import somente_digitos
from app.core.errors import AppError, ConflictError, NotFoundError
from app.core.logging import get_logger
from app.core.password_default import gerar_senha_padrao, gerar_senha_reset
from app.core.security import hash_password, verify_password
from app.models.enums import AcaoAudit, EntidadeAudit, PerfilUsuario, Situacao
from app.models.pessoa import Pessoa
from app.models.usuario import Usuario
from app.repositories import pessoa_repo, usuario_repo
from app.schemas.usuario import (
    MinhaSenhaUpdate,
    UsuarioCreate,
    UsuarioSenhaUpdate,
    UsuarioUpdate,
)
from app.services import audit_service

log = get_logger("usuario")


class LoginDuplicadoError(ConflictError):
    code = "LOGIN_DUPLICADO"
    default_message = "Login/CPF já em uso"


class CpfDuplicadoUsuarioError(ConflictError):
    code = "CPF_DUPLICADO"
    default_message = "Já existe um usuário com este CPF"


class AutoModificacaoError(AppError):
    code = "AUTO_MODIFICACAO_BLOQUEADA"
    default_status = 409
    default_message = "Você não pode realizar esta operação sobre o próprio usuário"


class RootProtegidoError(AppError):
    code = "ROOT_PROTEGIDO"
    default_status = 403
    default_message = "A conta administrador root só pode ser modificada por ela mesma"


class SenhaAtualIncorretaError(AppError):
    code = "SENHA_ATUAL_INVALIDA"
    default_status = 400
    default_message = "Senha atual incorreta"


def _bloqueia_se_root(target: Usuario, requester: Usuario) -> None:
    """Suporte/outros não podem mexer no root. Apenas o root pode mexer no root."""
    if target.eh_root and target.id != requester.id:
        raise RootProtegidoError()


async def _ensure_pessoa_para_usuario(
    session: AsyncSession,
    *,
    usuario: Usuario,
) -> Pessoa | None:
    """Cria/atualiza a Pessoa correspondente ao usuário com os mesmos dados.

    Usa o CPF como chave. Se já existir uma Pessoa com aquele CPF, vincula;
    se não, cria. Mantém os dados sincronizados.
    """
    if not usuario.cpf or not usuario.municipio_id:
        # admin/root pode não ter cpf/municipio
        return None

    pessoa = await pessoa_repo.get_by_cpf(session, usuario.cpf)
    if pessoa is None:
        pessoa = Pessoa(
            nome=usuario.nome,
            cpf=usuario.cpf,
            data_nascimento=usuario.data_nascimento or _data_nascimento_placeholder(),
            municipio_id=usuario.municipio_id,
            localidade=usuario.localidade,
            situacao=Situacao.ativo,
        )
        session.add(pessoa)
        await session.flush()
    else:
        pessoa.nome = usuario.nome
        pessoa.municipio_id = usuario.municipio_id
        pessoa.localidade = usuario.localidade
        if usuario.data_nascimento is not None:
            pessoa.data_nascimento = usuario.data_nascimento

    usuario.pessoa_id = pessoa.id
    await session.flush()
    return pessoa


def _data_nascimento_placeholder():
    """Placeholder quando o usuário não informa (campo opcional do usuário,
    mas a Pessoa precisa). Coerente com o sentinela da migration 0003."""
    from datetime import date

    return date(1900, 1, 1)


def _perfis_permitidos_para_criar_por(requester: Usuario) -> frozenset[PerfilUsuario]:
    """Define quais perfis o `requester` pode atribuir ao criar/editar um usuário.

    Regras:
    - **Administrador**: pode criar qualquer perfil.
    - **Suporte**: pode criar `gestor_solicitante` e `suporte` (igual ou abaixo).
    - **Governador**: só se tiver flag `pode_criar_usuarios` — mesmo conjunto que o suporte.
    - **Gestor solicitante**: não pode criar ninguém.
    """
    if requester.perfil == PerfilUsuario.administrador:
        return frozenset(PerfilUsuario)
    if requester.perfil == PerfilUsuario.suporte:
        return frozenset({PerfilUsuario.gestor_solicitante, PerfilUsuario.suporte})
    if (
        requester.perfil == PerfilUsuario.governador
        and requester.pode_criar_usuarios
    ):
        return frozenset({PerfilUsuario.gestor_solicitante, PerfilUsuario.suporte})
    return frozenset()


async def criar(
    session: AsyncSession,
    *,
    body: UsuarioCreate,
    requester: Usuario,
    request: Request | None = None,
) -> tuple[Usuario, str]:
    """Cria usuário. Retorna o usuário + senha temporária em texto plano."""
    if requester.perfil != PerfilUsuario.administrador:
        raise AppError(
            "Apenas administradores podem criar usuários.",
            status_code=403,
        )

    login = somente_digitos(body.cpf)

    permitidos = _perfis_permitidos_para_criar_por(requester)
    if not permitidos:
        raise AppError(
            "Seu perfil não tem permissão para criar usuários.",
            status_code=403,
        )
    if body.perfil not in permitidos:
        raise AppError(
            f"Você não pode atribuir o perfil '{body.perfil.value}'.",
            status_code=403,
            details={"permitidos": sorted(p.value for p in permitidos)},
        )

    if await usuario_repo.get_by_login(session, login) is not None:
        raise LoginDuplicadoError(details={"login": login})

    # CPF duplicado entre usuários
    stmt = select(Usuario).where(Usuario.cpf == body.cpf)
    if (await session.execute(stmt)).scalar_one_or_none() is not None:
        raise CpfDuplicadoUsuarioError(details={"cpf": body.cpf})

    senha_padrao = gerar_senha_padrao(cpf=body.cpf, nome=body.nome)

    # Flags privilegiadas: só admin pode setar na criação. Caso contrário, ignora.
    flag_usuarios = (
        bool(body.pode_criar_usuarios)
        if body.pode_criar_usuarios is not None
        and requester.perfil == PerfilUsuario.administrador
        else False
    )
    flag_solicitacoes = (
        bool(body.pode_criar_solicitacoes)
        if body.pode_criar_solicitacoes is not None
        and requester.perfil == PerfilUsuario.administrador
        else False
    )
    flag_reabrir = (
        bool(body.pode_reabrir_solicitacoes)
        if body.pode_reabrir_solicitacoes is not None
        and requester.perfil == PerfilUsuario.administrador
        else False
    )
    flag_ver_status = (
        bool(body.ver_status_solicitacao)
        if body.ver_status_solicitacao is not None
        and requester.perfil == PerfilUsuario.administrador
        else False
    )

    usuario = Usuario(
        nome=body.nome,
        login=login,
        senha_hash=hash_password(senha_padrao),
        perfil=body.perfil,
        situacao=Situacao.ativo,
        cpf=body.cpf,
        municipio_id=body.municipio_id,
        localidade=body.localidade,
        contato=body.contato,
        data_nascimento=body.data_nascimento,
        must_change_password=True,
        eh_root=False,
        pode_criar_usuarios=flag_usuarios,
        pode_criar_solicitacoes=flag_solicitacoes,
        pode_reabrir_solicitacoes=flag_reabrir,
        ver_status_solicitacao=flag_ver_status,
    )
    try:
        await usuario_repo.add(session, usuario)
        await _ensure_pessoa_para_usuario(session, usuario=usuario)
        await audit_service.log_event(
            session,
            acao=AcaoAudit.usuario_criado,
            entidade=EntidadeAudit.usuario,
            actor=requester,
            entidade_id=usuario.id,
            entidade_label=usuario.nome,
            detalhes={
                "login": usuario.login,
                "perfil": usuario.perfil.value,
                "municipio_id": str(usuario.municipio_id) if usuario.municipio_id else None,
            },
            request=request,
        )
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise LoginDuplicadoError(details={"login": login}) from exc

    # Recarrega com municipio e pessoa
    refreshed = await _carregar_completo(session, usuario.id)
    log.info(
        "usuario.criado",
        usuario_id=str(usuario.id),
        login=usuario.login,
        perfil=usuario.perfil.value,
    )
    return refreshed, senha_padrao  # type: ignore[return-value]


async def _carregar_completo(session: AsyncSession, usuario_id: UUID) -> Usuario | None:
    stmt = (
        select(Usuario)
        .where(Usuario.id == usuario_id)
        .options(selectinload(Usuario.municipio))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def atualizar(
    session: AsyncSession,
    *,
    usuario_id: UUID,
    body: UsuarioUpdate,
    requester: Usuario,
    request: Request | None = None,
) -> Usuario:
    usuario = await usuario_repo.get_by_id(session, usuario_id)
    if usuario is None:
        raise NotFoundError("Usuário não encontrado")

    _bloqueia_se_root(usuario, requester)

    # Auto-proteção: não rebaixa o próprio perfil nem se inativa
    if requester.id == usuario.id:
        if body.perfil is not None and body.perfil != usuario.perfil:
            raise AutoModificacaoError("Não é possível mudar seu próprio perfil")
        if body.situacao is not None and body.situacao != Situacao.ativo:
            raise AutoModificacaoError("Não é possível inativar seu próprio usuário")

    # Quem pode editar quem? Mesmas regras de criação.
    permitidos = _perfis_permitidos_para_criar_por(requester)
    if not permitidos:
        raise AppError(
            "Seu perfil não tem permissão para editar usuários.",
            status_code=403,
        )
    # Não pode editar alguém de perfil acima do dele
    if usuario.perfil not in permitidos and requester.id != usuario.id:
        raise AppError(
            "Você não pode editar um usuário deste perfil.",
            status_code=403,
        )
    if body.perfil is not None and body.perfil not in permitidos:
        raise AppError(
            f"Você não pode atribuir o perfil '{body.perfil.value}'.",
            status_code=403,
            details={"permitidos": sorted(p.value for p in permitidos)},
        )

    diff: dict[str, dict[str, str | None]] = {}

    def _track(campo: str, antes, depois) -> None:
        a = antes.value if hasattr(antes, "value") else (str(antes) if antes is not None else None)
        d = depois.value if hasattr(depois, "value") else (str(depois) if depois is not None else None)
        if a != d:
            diff[campo] = {"de": a, "para": d}

    if body.nome is not None:
        _track("nome", usuario.nome, body.nome)
        usuario.nome = body.nome
    if body.perfil is not None:
        _track("perfil", usuario.perfil, body.perfil)
        usuario.perfil = body.perfil
    if body.municipio_id is not None:
        _track("municipio_id", usuario.municipio_id, body.municipio_id)
        usuario.municipio_id = body.municipio_id
    if body.localidade is not None:
        _track("localidade", usuario.localidade, body.localidade)
        usuario.localidade = body.localidade
    if body.contato is not None:
        _track("contato", usuario.contato, body.contato)
        usuario.contato = body.contato
    if body.data_nascimento is not None:
        _track("data_nascimento", usuario.data_nascimento, body.data_nascimento)
        usuario.data_nascimento = body.data_nascimento
    # Flags privilegiadas — só admin pode alterar.
    if (
        body.pode_criar_usuarios is not None
        and requester.perfil == PerfilUsuario.administrador
    ):
        _track("pode_criar_usuarios", usuario.pode_criar_usuarios, body.pode_criar_usuarios)
        usuario.pode_criar_usuarios = bool(body.pode_criar_usuarios)
    if (
        body.pode_criar_solicitacoes is not None
        and requester.perfil == PerfilUsuario.administrador
    ):
        _track(
            "pode_criar_solicitacoes",
            usuario.pode_criar_solicitacoes,
            body.pode_criar_solicitacoes,
        )
        usuario.pode_criar_solicitacoes = bool(body.pode_criar_solicitacoes)
    if (
        body.pode_reabrir_solicitacoes is not None
        and requester.perfil == PerfilUsuario.administrador
    ):
        _track(
            "pode_reabrir_solicitacoes",
            usuario.pode_reabrir_solicitacoes,
            body.pode_reabrir_solicitacoes,
        )
        usuario.pode_reabrir_solicitacoes = bool(body.pode_reabrir_solicitacoes)
    if (
        body.ver_status_solicitacao is not None
        and requester.perfil == PerfilUsuario.administrador
    ):
        _track(
            "ver_status_solicitacao",
            usuario.ver_status_solicitacao,
            body.ver_status_solicitacao,
        )
        usuario.ver_status_solicitacao = bool(body.ver_status_solicitacao)
    foi_inativado = False
    if body.situacao is not None:
        situacao_anterior = usuario.situacao
        _track("situacao", situacao_anterior, body.situacao)
        usuario.situacao = body.situacao
        if (
            body.situacao == Situacao.inativo
            and situacao_anterior == Situacao.ativo
        ):
            await usuario_repo.revoke_all_refresh_tokens(session, usuario.id)
            foi_inativado = True

    await _ensure_pessoa_para_usuario(session, usuario=usuario)
    if foi_inativado:
        await audit_service.log_event(
            session,
            acao=AcaoAudit.usuario_inativado,
            entidade=EntidadeAudit.usuario,
            actor=requester,
            entidade_id=usuario.id,
            entidade_label=usuario.nome,
            detalhes={"via": "atualizar"},
            request=request,
        )
    elif diff:
        await audit_service.log_event(
            session,
            acao=AcaoAudit.usuario_atualizado,
            entidade=EntidadeAudit.usuario,
            actor=requester,
            entidade_id=usuario.id,
            entidade_label=usuario.nome,
            detalhes={"diff": diff},
            request=request,
        )
    await session.commit()
    refreshed = await _carregar_completo(session, usuario.id)
    log.info("usuario.atualizado", usuario_id=str(usuario.id))
    return refreshed  # type: ignore[return-value]


async def atualizar_proprio(
    session: AsyncSession,
    *,
    requester: Usuario,
    nome: str | None = None,
    municipio_id: UUID | None = None,
    localidade: str | None = None,
    contato: str | None = None,
    data_nascimento: date | None = None,
    request: Request | None = None,
) -> Usuario:
    """Edição dos próprios dados pelo usuário autenticado.

    Campos privilegiados (perfil, situacao, flags, login, cpf) **não** podem
    ser alterados por aqui — só pelo módulo de Usuários.
    """
    diff: dict[str, dict[str, str | None]] = {}

    def _track(campo: str, antes, depois) -> None:
        a = str(antes) if antes is not None else None
        d = str(depois) if depois is not None else None
        if a != d:
            diff[campo] = {"de": a, "para": d}

    if nome is not None and nome != requester.nome:
        _track("nome", requester.nome, nome)
        requester.nome = nome
    if municipio_id is not None and municipio_id != requester.municipio_id:
        _track("municipio_id", requester.municipio_id, municipio_id)
        requester.municipio_id = municipio_id
    if localidade is not None and (localidade or None) != requester.localidade:
        _track("localidade", requester.localidade, localidade or None)
        requester.localidade = localidade or None
    if contato is not None and (contato or None) != requester.contato:
        _track("contato", requester.contato, contato or None)
        requester.contato = contato or None
    if data_nascimento is not None and data_nascimento != requester.data_nascimento:
        _track("data_nascimento", requester.data_nascimento, data_nascimento)
        requester.data_nascimento = data_nascimento

    # Mantém a Pessoa vinculada em sincronia (nome/municipio/data).
    await _ensure_pessoa_para_usuario(session, usuario=requester)

    if diff:
        await audit_service.log_event(
            session,
            acao=AcaoAudit.usuario_atualizado,
            entidade=EntidadeAudit.usuario,
            actor=requester,
            entidade_id=requester.id,
            entidade_label=requester.nome,
            detalhes={"diff": diff, "via": "perfil_proprio"},
            request=request,
        )
    await session.commit()
    refreshed = await _carregar_completo(session, requester.id)
    log.info("usuario.proprio_atualizado", usuario_id=str(requester.id))
    return refreshed  # type: ignore[return-value]


async def alterar_senha_admin(
    session: AsyncSession,
    *,
    usuario_id: UUID,
    body: UsuarioSenhaUpdate,
    requester: Usuario,
    request: Request | None = None,
) -> None:
    usuario = await usuario_repo.get_by_id(session, usuario_id)
    if usuario is None:
        raise NotFoundError("Usuário não encontrado")

    _bloqueia_se_root(usuario, requester)

    if not usuario.cpf:
        raise AppError(
            "Não é possível resetar a senha de um usuário sem CPF vinculado.",
            status_code=400,
        )

    senha_reset = gerar_senha_reset(cpf=usuario.cpf)
    usuario.senha_hash = hash_password(senha_reset)
    # Quando admin/suporte troca a senha de outra pessoa, marca como temporária.
    if requester.id != usuario.id:
        usuario.must_change_password = True
        await usuario_repo.revoke_all_refresh_tokens(session, usuario.id)

    await audit_service.log_event(
        session,
        acao=AcaoAudit.usuario_senha_resetada,
        entidade=EntidadeAudit.usuario,
        actor=requester,
        entidade_id=usuario.id,
        entidade_label=usuario.nome,
        detalhes={
            "alvo_proprio": requester.id == usuario.id,
            "reset_para": "ultimos_4_digitos_cpf",
        },
        request=request,
    )
    await session.commit()
    log.info(
        "usuario.senha_alterada",
        usuario_id=str(usuario.id),
        por=str(requester.id),
    )


async def alterar_propria_senha(
    session: AsyncSession,
    *,
    requester: Usuario,
    body: MinhaSenhaUpdate,
    request: Request | None = None,
) -> None:
    """Usuário trocando a própria senha. Limpa `must_change_password`."""
    if not verify_password(body.senha_atual, requester.senha_hash):
        raise SenhaAtualIncorretaError()
    if body.senha_atual == body.nova_senha:
        raise AppError(
            "A nova senha precisa ser diferente da atual.",
            status_code=400,
        )

    requester.senha_hash = hash_password(body.nova_senha)
    requester.must_change_password = False
    await audit_service.log_event(
        session,
        acao=AcaoAudit.senha_propria_alterada,
        entidade=EntidadeAudit.usuario,
        actor=requester,
        entidade_id=requester.id,
        entidade_label=requester.nome,
        request=request,
    )
    await session.commit()
    log.info("usuario.senha_propria_alterada", usuario_id=str(requester.id))


async def soft_delete(
    session: AsyncSession,
    *,
    usuario_id: UUID,
    requester: Usuario,
    request: Request | None = None,
) -> None:
    if requester.id == usuario_id:
        raise AutoModificacaoError("Não é possível inativar seu próprio usuário")

    usuario = await usuario_repo.get_by_id(session, usuario_id)
    if usuario is None:
        raise NotFoundError("Usuário não encontrado")

    _bloqueia_se_root(usuario, requester)

    # Só pode inativar quem está no conjunto de perfis que esse requester gerencia
    permitidos = _perfis_permitidos_para_criar_por(requester)
    if usuario.perfil not in permitidos:
        raise AppError(
            "Você não pode inativar um usuário deste perfil.",
            status_code=403,
        )

    if usuario.situacao == Situacao.ativo:
        usuario.situacao = Situacao.inativo
        await usuario_repo.revoke_all_refresh_tokens(session, usuario.id)
        await audit_service.log_event(
            session,
            acao=AcaoAudit.usuario_inativado,
            entidade=EntidadeAudit.usuario,
            actor=requester,
            entidade_id=usuario.id,
            entidade_label=usuario.nome,
            request=request,
        )

    await session.commit()
    log.info("usuario.inativado", usuario_id=str(usuario.id))


async def obter(session: AsyncSession, usuario_id: UUID) -> Usuario:
    usuario = await _carregar_completo(session, usuario_id)
    if usuario is None:
        raise NotFoundError("Usuário não encontrado")
    return usuario
