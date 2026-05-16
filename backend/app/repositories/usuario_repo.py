"""Repositório de acesso a Usuario."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, or_, select, update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import PerfilUsuario, Situacao
from app.models.refresh_token import RefreshToken
from app.models.usuario import Usuario


async def get_by_login(session: AsyncSession, login: str) -> Usuario | None:
    stmt = select(Usuario).where(func.lower(Usuario.login) == login.lower())
    return (await session.execute(stmt)).scalar_one_or_none()


async def get_by_id(session: AsyncSession, usuario_id: UUID) -> Usuario | None:
    return await session.get(Usuario, usuario_id)


async def touch_last_login(session: AsyncSession, usuario: Usuario) -> None:
    usuario.ultimo_login = datetime.now(timezone.utc)
    await session.flush()


async def list_paged(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    search: str | None,
    perfil: str | None,
    incluir_inativos: bool,
    viewer_perfil: PerfilUsuario,
) -> tuple[list[Usuario], int]:
    base = select(Usuario)
    count_base = select(func.count()).select_from(Usuario)

    filters = []
    if not incluir_inativos:
        filters.append(Usuario.situacao == Situacao.ativo)
    if perfil:
        filters.append(Usuario.perfil == perfil)
    if viewer_perfil != PerfilUsuario.administrador:
        filters.append(Usuario.perfil != PerfilUsuario.administrador)
    if search:
        like = f"%{search}%"
        filters.append(or_(Usuario.nome.ilike(like), Usuario.login.ilike(like)))

    for f in filters:
        base = base.where(f)
        count_base = count_base.where(f)

    base = (
        base.order_by(Usuario.nome.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    total = (await session.execute(count_base)).scalar_one()
    rows = (await session.execute(base)).scalars().all()
    return list(rows), int(total)


async def add(session: AsyncSession, usuario: Usuario) -> Usuario:
    session.add(usuario)
    await session.flush()
    return usuario


async def revoke_all_refresh_tokens(session: AsyncSession, usuario_id: UUID) -> int:
    """Revoga todos os refresh tokens ativos do usuário. Retorna quantidade afetada."""
    stmt = (
        sql_update(RefreshToken)
        .where(
            RefreshToken.usuario_id == usuario_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    result = await session.execute(stmt)
    return result.rowcount or 0
