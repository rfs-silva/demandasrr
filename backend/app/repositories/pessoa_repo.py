"""Repositório de Pessoa."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.models.enums import Situacao
from app.models.municipio import Municipio
from app.models.pessoa import Pessoa


async def get_by_id(session: AsyncSession, pessoa_id: UUID) -> Pessoa | None:
    stmt = (
        select(Pessoa)
        .where(Pessoa.id == pessoa_id)
        .options(joinedload(Pessoa.municipio), selectinload(Pessoa.usuario))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_by_cpf(session: AsyncSession, cpf: str) -> Pessoa | None:
    stmt = (
        select(Pessoa)
        .where(Pessoa.cpf == cpf)
        .options(joinedload(Pessoa.municipio), selectinload(Pessoa.usuario))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_paged(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None,
    municipio_id: UUID | None,
    incluir_inativos: bool,
) -> tuple[list[Pessoa], int]:
    base = select(Pessoa).options(
        joinedload(Pessoa.municipio), selectinload(Pessoa.usuario)
    )
    count_base = select(func.count()).select_from(Pessoa)

    filters = []
    if not incluir_inativos:
        filters.append(Pessoa.situacao == Situacao.ativo)
    if municipio_id is not None:
        filters.append(Pessoa.municipio_id == municipio_id)
    if search:
        like = f"%{search}%"
        filters.append(
            or_(
                Pessoa.nome.ilike(like),
                Pessoa.cpf.like(f"%{search}%"),
                Pessoa.localidade.ilike(like),
            )
        )

    for f in filters:
        base = base.where(f)
        count_base = count_base.where(f)

    base = base.order_by(Pessoa.nome.asc()).offset((page - 1) * page_size).limit(page_size)
    total = (await session.execute(count_base)).scalar_one()
    rows = (await session.execute(base)).scalars().unique().all()
    return list(rows), int(total)


async def add(session: AsyncSession, pessoa: Pessoa) -> Pessoa:
    session.add(pessoa)
    await session.flush()
    return pessoa


async def municipio_by_id(session: AsyncSession, mid: UUID) -> Municipio | None:
    return await session.get(Municipio, mid)
