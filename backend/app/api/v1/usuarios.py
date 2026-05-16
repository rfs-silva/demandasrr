"""Endpoints de Usuários — suporte e administrador podem operar.

Suporte NÃO pode mexer em administradores nem na conta root.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.errors import ForbiddenError
from app.db.session import get_session
from app.models.enums import PerfilUsuario
from app.models.usuario import Usuario
from app.repositories import usuario_repo
from app.schemas.common import Envelope, Meta
from app.schemas.usuario import (
    UsuarioCreate,
    UsuarioCriadoOut,
    UsuarioOut,
    UsuarioSenhaUpdate,
    UsuarioUpdate,
)
from app.services import usuario_service


def _exige_acesso_a_usuarios(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    """Quem pode acessar o módulo de usuários:

    - Administrador e Suporte: sempre.
    - Governador: apenas se o admin liberou via flag `pode_criar_usuarios`.
    - Gestor solicitante: nunca.
    """
    if usuario.perfil == PerfilUsuario.administrador:
        return usuario
    if usuario.perfil == PerfilUsuario.suporte:
        return usuario
    if usuario.perfil == PerfilUsuario.governador and usuario.pode_criar_usuarios:
        return usuario
    raise ForbiddenError("Sem permissão para gerenciar usuários.")


router = APIRouter(
    prefix="/usuarios",
    tags=["usuarios"],
    dependencies=[Depends(_exige_acesso_a_usuarios)],
)


@router.get(
    "",
    response_model=Envelope[list[UsuarioOut]],
    summary="Lista usuários",
)
async def listar(
    session: AsyncSession = Depends(get_session),
    viewer: Usuario = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=150),
    perfil: PerfilUsuario | None = Query(None),
    incluir_inativos: bool = Query(True),
) -> Envelope[list[UsuarioOut]]:
    rows, total = await usuario_repo.list_paged(
        session,
        page=page,
        page_size=page_size,
        search=search,
        perfil=perfil.value if perfil else None,
        incluir_inativos=incluir_inativos,
        viewer_perfil=viewer.perfil,
    )
    return Envelope(
        data=[UsuarioOut.from_orm(u, viewer=viewer) for u in rows],
        meta=Meta(page=page, page_size=page_size, total=total),
    )


@router.post(
    "",
    response_model=Envelope[UsuarioCriadoOut],
    status_code=status.HTTP_201_CREATED,
    summary="Cria usuário (senha temporária gerada automaticamente)",
)
async def criar(
    body: UsuarioCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    requester: Usuario = Depends(get_current_user),
) -> Envelope[UsuarioCriadoOut]:
    usuario, senha = await usuario_service.criar(
        session, body=body, requester=requester, request=request
    )
    return Envelope(
        data=UsuarioCriadoOut(
            usuario=UsuarioOut.from_orm(usuario, viewer=requester),
            senha_temporaria=senha,
        )
    )


@router.get(
    "/{usuario_id}",
    response_model=Envelope[UsuarioOut],
    summary="Detalha usuário",
)
async def obter(
    usuario_id: UUID,
    session: AsyncSession = Depends(get_session),
    viewer: Usuario = Depends(get_current_user),
) -> Envelope[UsuarioOut]:
    usuario = await usuario_service.obter(session, usuario_id)
    return Envelope(data=UsuarioOut.from_orm(usuario, viewer=viewer))


@router.put(
    "/{usuario_id}",
    response_model=Envelope[UsuarioOut],
    summary="Atualiza usuário",
)
async def atualizar(
    usuario_id: UUID,
    body: UsuarioUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    requester: Usuario = Depends(get_current_user),
) -> Envelope[UsuarioOut]:
    usuario = await usuario_service.atualizar(
        session,
        usuario_id=usuario_id,
        body=body,
        requester=requester,
        request=request,
    )
    return Envelope(data=UsuarioOut.from_orm(usuario, viewer=requester))


@router.patch(
    "/{usuario_id}/senha",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reset administrativo da senha para os 4 últimos dígitos do CPF",
)
async def alterar_senha(
    usuario_id: UUID,
    body: UsuarioSenhaUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    requester: Usuario = Depends(get_current_user),
) -> None:
    await usuario_service.alterar_senha_admin(
        session,
        usuario_id=usuario_id,
        body=body,
        requester=requester,
        request=request,
    )


@router.delete(
    "/{usuario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Inativa usuário (soft delete) e revoga sessões",
)
async def remover(
    usuario_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
    requester: Usuario = Depends(get_current_user),
) -> None:
    await usuario_service.soft_delete(
        session,
        usuario_id=usuario_id,
        requester=requester,
        request=request,
    )
