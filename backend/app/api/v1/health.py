"""Healthcheck endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session

router = APIRouter()


@router.get("/health", summary="Healthcheck")
async def health(session: AsyncSession = Depends(get_session)) -> dict[str, str]:
    """Retorna 200 se a API e o banco estão respondendo."""
    db_status = "ok"
    try:
        await session.execute(text("SELECT 1"))
    except Exception:  # pragma: no cover - exposto via status http
        db_status = "down"

    return {"status": "ok", "db": db_status}
