"""Endpoints de Solicitações."""

from __future__ import annotations

import csv
import io
from collections.abc import AsyncIterator
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cpf_privacy import cpf_para_viewer
from app.core.deps import get_current_user, require_role
from app.db.session import get_session
from app.models.enums import (
    AreaSolicitacao,
    PerfilUsuario,
    StatusSolicitacao,
)
from app.models.usuario import Usuario
from app.repositories import solicitacao_repo
from app.repositories.solicitacao_repo import SolicitacaoFiltros
from app.schemas.common import Envelope, Meta
from app.schemas.solicitacao import (
    ComentarioCreate,
    SolicitacaoCreate,
    SolicitacaoEventoOut,
    SolicitacaoOut,
    SolicitacaoUpdate,
    StatusUpdate,
    TopSolicitanteOut,
    UsuarioResumo,
)
from app.services import solicitacao_service

router = APIRouter(prefix="/solicitacoes", tags=["solicitacoes"])


def _ocultar_status_para(usuario: Usuario) -> bool:
    """Gestor solicitante vê sempre "Cadastrada" — a não ser que o admin tenha
    liberado a visualização do status real via flag ``ver_status_solicitacao``.
    """
    return (
        usuario.perfil == PerfilUsuario.gestor_solicitante
        and not usuario.ver_status_solicitacao
    )


def _filtros_para(
    usuario: Usuario,
    *,
    municipio: str | None,
    area: AreaSolicitacao | None,
    status_param: StatusSolicitacao | None,
    data_de: datetime | None,
    data_ate: datetime | None,
    search: str | None,
    usuario_id: UUID | None = None,
) -> SolicitacaoFiltros:
    # gestor_solicitante só vê as suas (independente do que mandou no filtro);
    # equipe interna pode filtrar por um solicitante específico via query string.
    if usuario.perfil == PerfilUsuario.gestor_solicitante:
        filtro_usuario = usuario.id
    else:
        filtro_usuario = usuario_id
    return SolicitacaoFiltros(
        municipio=municipio,
        area=area,
        status=status_param,
        data_de=data_de,
        data_ate=data_ate,
        search=search,
        usuario_id=filtro_usuario,
    )


# ---------------- LIST ----------------

@router.get(
    "",
    response_model=Envelope[list[SolicitacaoOut]],
    summary="Lista solicitações com filtros e paginação (ordem: mais recentes primeiro)",
)
async def listar(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    municipio: str | None = Query(None, max_length=100),
    area: AreaSolicitacao | None = Query(None),
    status_param: StatusSolicitacao | None = Query(None, alias="status"),
    data_de: datetime | None = Query(None, alias="data_de"),
    data_ate: datetime | None = Query(None, alias="data_ate"),
    search: str | None = Query(None, max_length=200),
    usuario_id: UUID | None = Query(None, alias="usuario_id"),
) -> Envelope[list[SolicitacaoOut]]:
    filtros = _filtros_para(
        usuario,
        municipio=municipio,
        area=area,
        status_param=status_param,
        data_de=data_de,
        data_ate=data_ate,
        search=search,
        usuario_id=usuario_id,
    )
    rows, total = await solicitacao_repo.list_paged(
        session, page=page, page_size=page_size, filtros=filtros
    )
    ocultar = _ocultar_status_para(usuario)
    data = [
        SolicitacaoOut.from_orm_for(s, viewer=usuario, ocultar_status=ocultar)
        for s in rows
    ]
    return Envelope(data=data, meta=Meta(page=page, page_size=page_size, total=total))


# ---------------- CREATE ----------------

@router.post(
    "",
    response_model=Envelope[SolicitacaoOut],
    status_code=status.HTTP_201_CREATED,
    summary="Cria solicitação vinculada ao usuário autenticado",
)
async def criar(
    body: SolicitacaoCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[SolicitacaoOut]:
    solicitacao = await solicitacao_service.criar(
        session, body=body, autor=usuario, request=request
    )
    return Envelope(
        data=SolicitacaoOut.from_orm_for(
            solicitacao,
            viewer=usuario,
            ocultar_status=_ocultar_status_para(usuario),
        )
    )


# ---------------- EXPORT CSV ----------------
# IMPORTANTE: declarar antes das rotas com `/{id}` para não colidir.

_CSV_HEADERS = [
    "data",
    "municipio",
    "pessoa_nome",
    "pessoa_cpf",
    "area",
    "descricao",
    "status",
    "usuario_responsavel",
]


async def _csv_stream(
    session: AsyncSession,
    filtros: SolicitacaoFiltros,
    *,
    viewer: Usuario,
) -> AsyncIterator[bytes]:
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)

    def _drain() -> bytes:
        v = buf.getvalue().encode("utf-8")
        buf.seek(0)
        buf.truncate(0)
        return v

    writer.writerow(_CSV_HEADERS)
    # BOM UTF-8 para Excel abrir corretamente acentos
    yield b"\xef\xbb\xbf" + _drain()

    async for s in solicitacao_repo.iter_all(session, filtros=filtros):
        dono = getattr(s.pessoa, "usuario", None)
        cpf_visivel = cpf_para_viewer(
            cpf_raw=s.pessoa.cpf,
            dono_perfil=dono.perfil if dono is not None else None,
            dono_id=dono.id if dono is not None else None,
            viewer_id=viewer.id,
            viewer_perfil=viewer.perfil,
        ) or ""
        writer.writerow(
            [
                s.data_solicitacao.isoformat(),
                s.municipio,
                s.pessoa.nome,
                cpf_visivel,
                s.area.value,
                s.descricao.replace("\n", " ").replace("\r", " "),
                s.status.value,
                s.usuario.login,
            ]
        )
        yield _drain()


@router.get(
    "/export",
    summary="Exporta as solicitações filtradas em CSV (gestor ou administrador)",
    dependencies=[
        Depends(require_role(PerfilUsuario.suporte, PerfilUsuario.administrador))
    ],
)
async def exportar(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
    municipio: str | None = Query(None, max_length=100),
    area: AreaSolicitacao | None = Query(None),
    status_param: StatusSolicitacao | None = Query(None, alias="status"),
    data_de: datetime | None = Query(None, alias="data_de"),
    data_ate: datetime | None = Query(None, alias="data_ate"),
    search: str | None = Query(None, max_length=200),
    usuario_id: UUID | None = Query(None, alias="usuario_id"),
) -> StreamingResponse:
    filtros = _filtros_para(
        usuario,
        municipio=municipio,
        area=area,
        status_param=status_param,
        data_de=data_de,
        data_ate=data_ate,
        search=search,
        usuario_id=usuario_id,
    )
    filename = f"solicitacoes_{datetime.utcnow():%Y%m%d_%H%M%S}.csv"
    return StreamingResponse(
        _csv_stream(session, filtros, viewer=usuario),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------- TOP SOLICITANTES ----------------
# Quem mais abriu demandas dentro do filtro atual (suporte/governador/admin).

@router.get(
    "/top-solicitantes",
    response_model=Envelope[list[TopSolicitanteOut]],
    summary="Ranking de quem mais abriu solicitações dentro do filtro",
    dependencies=[
        Depends(
            require_role(
                PerfilUsuario.suporte,
                PerfilUsuario.governador,
                PerfilUsuario.administrador,
            )
        )
    ],
)
async def top_solicitantes(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
    limit: int = Query(10, ge=1, le=50),
    municipio: str | None = Query(None, max_length=100),
    area: AreaSolicitacao | None = Query(None),
    status_param: StatusSolicitacao | None = Query(None, alias="status"),
    data_de: datetime | None = Query(None, alias="data_de"),
    data_ate: datetime | None = Query(None, alias="data_ate"),
    search: str | None = Query(None, max_length=200),
) -> Envelope[list[TopSolicitanteOut]]:
    filtros = _filtros_para(
        usuario,
        municipio=municipio,
        area=area,
        status_param=status_param,
        data_de=data_de,
        data_ate=data_ate,
        search=search,
        usuario_id=None,  # o ranking ignora filtro de solicitante específico
    )
    rows = await solicitacao_repo.top_solicitantes(session, filtros=filtros, limit=limit)
    return Envelope(
        data=[
            TopSolicitanteOut(
                usuario=UsuarioResumo(id=u.id, nome=u.nome, login=u.login),
                qtd=qtd,
            )
            for u, qtd in rows
        ]
    )


# ---------------- DETAIL ----------------

@router.get(
    "/{solicitacao_id}",
    response_model=Envelope[SolicitacaoOut],
    summary="Detalha solicitação (apoio só acessa as próprias)",
)
async def obter(
    solicitacao_id: UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[SolicitacaoOut]:
    solicitacao = await solicitacao_service.obter(
        session, solicitacao_id=solicitacao_id, requester=usuario
    )
    return Envelope(
        data=SolicitacaoOut.from_orm_for(
            solicitacao,
            viewer=usuario,
            ocultar_status=_ocultar_status_para(usuario),
        )
    )


# ---------------- STATUS PATCH ----------------

@router.patch(
    "/{solicitacao_id}/status",
    response_model=Envelope[SolicitacaoOut],
    summary="Altera o status (gestor ou administrador)",
    dependencies=[
        Depends(require_role(PerfilUsuario.suporte, PerfilUsuario.administrador))
    ],
)
async def alterar_status(
    solicitacao_id: UUID,
    body: StatusUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[SolicitacaoOut]:
    solicitacao = await solicitacao_service.alterar_status(
        session,
        solicitacao_id=solicitacao_id,
        novo_status=body.status,
        parecer=body.parecer,
        requester=usuario,
        request=request,
    )
    return Envelope(
        data=SolicitacaoOut.from_orm_for(
            solicitacao,
            viewer=usuario,
            ocultar_status=_ocultar_status_para(usuario),
        )
    )


# ---------------- EDIÇÃO (DONO, ENQUANTO CADASTRADA) ----------------

@router.put(
    "/{solicitacao_id}",
    response_model=Envelope[SolicitacaoOut],
    summary="Edita a solicitação (apenas o dono, enquanto cadastrada)",
)
async def editar(
    solicitacao_id: UUID,
    body: SolicitacaoUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[SolicitacaoOut]:
    solicitacao = await solicitacao_service.editar(
        session,
        solicitacao_id=solicitacao_id,
        body=body,
        requester=usuario,
        request=request,
    )
    return Envelope(
        data=SolicitacaoOut.from_orm_for(
            solicitacao,
            viewer=usuario,
            ocultar_status=_ocultar_status_para(usuario),
        )
    )


# ---------------- ANOTAÇÕES INTERNAS (GESTOR/ADMIN) ----------------

@router.post(
    "/{solicitacao_id}/comentarios",
    response_model=Envelope[SolicitacaoEventoOut],
    status_code=status.HTTP_201_CREATED,
    summary="Adiciona anotação interna (não visível para o solicitante)",
    dependencies=[
        Depends(require_role(PerfilUsuario.suporte, PerfilUsuario.administrador))
    ],
)
async def comentar(
    solicitacao_id: UUID,
    body: ComentarioCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[SolicitacaoEventoOut]:
    evento = await solicitacao_service.comentar(
        session,
        solicitacao_id=solicitacao_id,
        body=body,
        requester=usuario,
        request=request,
    )
    return Envelope(data=SolicitacaoEventoOut.from_orm(evento))


# ---------------- EVENTOS / TIMELINE ----------------

@router.get(
    "/{solicitacao_id}/eventos",
    response_model=Envelope[list[SolicitacaoEventoOut]],
    summary="Linha do tempo (eventos internos só aparecem para gestor/admin)",
)
async def listar_eventos(
    solicitacao_id: UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[list[SolicitacaoEventoOut]]:
    # respeita o mesmo gate de visualização da solicitação
    await solicitacao_service.obter(
        session, solicitacao_id=solicitacao_id, requester=usuario
    )
    # Toda a equipe interna (suporte, governador, admin) vê os eventos
    # internos — comentários, andamento, anexos. O solicitante nunca vê.
    incluir = usuario.perfil in (
        PerfilUsuario.suporte,
        PerfilUsuario.governador,
        PerfilUsuario.administrador,
    )
    eventos = await solicitacao_repo.list_eventos(
        session, solicitacao_id, incluir_internos=incluir
    )
    # Solicitante sem flag não enxerga mudanças de status na timeline —
    # consistente com o status mascarado na solicitação.
    if _ocultar_status_para(usuario):
        eventos = [e for e in eventos if e.tipo.value != "status_alterado"]
    return Envelope(data=[SolicitacaoEventoOut.from_orm(e) for e in eventos])
