"""Repositório de refresh tokens (rotação + revogação)."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken


async def create(
    session: AsyncSession,
    *,
    usuario_id: UUID,
    expires_at: datetime,
    user_agent: str | None = None,
    ip: str | None = None,
) -> RefreshToken:
    token = RefreshToken(
        usuario_id=usuario_id,
        expires_at=expires_at,
        user_agent=user_agent,
        ip=ip,
    )
    session.add(token)
    await session.flush()
    return token


async def get(session: AsyncSession, jti: UUID) -> RefreshToken | None:
    return await session.get(RefreshToken, jti)


async def revoke(session: AsyncSession, token: RefreshToken) -> None:
    if token.revoked_at is None:
        token.revoked_at = datetime.now(timezone.utc)
        await session.flush()


def is_active(token: RefreshToken) -> bool:
    if token.revoked_at is not None:
        return False
    return token.expires_at > datetime.now(timezone.utc)
