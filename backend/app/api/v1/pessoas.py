"""Endpoints de Pessoas."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_role
from app.db.session import get_session
from app.models.enums import PerfilUsuario
from app.models.usuario import Usuario
from app.schemas.common import Envelope, Meta
from app.schemas.pessoa import PessoaCreate, PessoaOut, PessoaUpdate
from app.services import pessoa_service
from app.repositories import pessoa_repo

router = APIRouter(prefix="/pessoas", tags=["pessoas"])


@router.get(
    "",
    response_model=Envelope[list[PessoaOut]],
    summary="Lista pessoas com paginação e busca",
)
async def listar(
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=150),
    municipio_id: UUID | None = Query(None),
    incluir_inativos: bool = Query(False),
) -> Envelope[list[PessoaOut]]:
    # somente admin pode ver inativos
    if incluir_inativos and usuario.perfil != PerfilUsuario.administrador:
        incluir_inativos = False

    rows, total = await pessoa_repo.list_paged(
        session,
        page=page,
        page_size=page_size,
        search=search,
        municipio_id=municipio_id,
        incluir_inativos=incluir_inativos,
    )
    data = [PessoaOut.from_orm_for(p, viewer=usuario) for p in rows]
    return Envelope(data=data, meta=Meta(page=page, page_size=page_size, total=total))


@router.post(
    "",
    response_model=Envelope[PessoaOut],
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra pessoa",
    dependencies=[Depends(require_role(PerfilUsuario.administrador))],
)
async def criar(
    body: PessoaCreate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[PessoaOut]:
    pessoa = await pessoa_service.criar(session, body)
    return Envelope(data=PessoaOut.from_orm_for(pessoa, viewer=usuario))


@router.get(
    "/{pessoa_id}",
    response_model=Envelope[PessoaOut],
    summary="Detalha pessoa",
)
async def obter(
    pessoa_id: UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[PessoaOut]:
    pessoa = await pessoa_service.obter(session, pessoa_id)
    return Envelope(data=PessoaOut.from_orm_for(pessoa, viewer=usuario))


@router.put(
    "/{pessoa_id}",
    response_model=Envelope[PessoaOut],
    summary="Atualiza pessoa (CPF é imutável)",
    dependencies=[Depends(require_role(PerfilUsuario.administrador))],
)
async def atualizar(
    pessoa_id: UUID,
    body: PessoaUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[PessoaOut]:
    pessoa = await pessoa_service.atualizar(session, pessoa_id, body)
    return Envelope(data=PessoaOut.from_orm_for(pessoa, viewer=usuario))


@router.delete(
    "/{pessoa_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Inativa pessoa (soft delete)",
    dependencies=[Depends(require_role(PerfilUsuario.administrador))],
)
async def remover(
    pessoa_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    await pessoa_service.soft_delete(session, pessoa_id)
