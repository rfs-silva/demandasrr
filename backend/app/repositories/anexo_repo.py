"""Repositório de anexos de solicitação."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.solicitacao_anexo import SolicitacaoAnexo


async def get(session: AsyncSession, anexo_id: UUID) -> SolicitacaoAnexo | None:
    stmt = (
        select(SolicitacaoAnexo)
        .where(SolicitacaoAnexo.id == anexo_id)
        .options(selectinload(SolicitacaoAnexo.usuario))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_by_solicitacao(
    session: AsyncSession, solicitacao_id: UUID
) -> list[SolicitacaoAnexo]:
    stmt = (
        select(SolicitacaoAnexo)
        .where(SolicitacaoAnexo.solicitacao_id == solicitacao_id)
        .options(selectinload(SolicitacaoAnexo.usuario))
        .order_by(SolicitacaoAnexo.created_at.desc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def count_by_solicitacao(session: AsyncSession, solicitacao_id: UUID) -> int:
    stmt = select(func.count()).select_from(SolicitacaoAnexo).where(
        SolicitacaoAnexo.solicitacao_id == solicitacao_id,
    )
    return int((await session.execute(stmt)).scalar_one())


async def add(session: AsyncSession, anexo: SolicitacaoAnexo) -> SolicitacaoAnexo:
    session.add(anexo)
    await session.flush()
    return anexo


async def remove(session: AsyncSession, anexo: SolicitacaoAnexo) -> None:
    await session.delete(anexo)
    await session.flush()
