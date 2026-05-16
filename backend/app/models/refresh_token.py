"""Modelo RefreshToken — permite rotação e revogação."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPK

if TYPE_CHECKING:
    from app.models.usuario import Usuario


class RefreshToken(UUIDPK, TimestampMixin, Base):
    __tablename__ = "refresh_token"
    __table_args__ = (
        Index("ix_refresh_token_usuario", "usuario_id"),
        Index("ix_refresh_token_expires", "expires_at"),
    )

    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuario.id", ondelete="CASCADE"),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)

    usuario: Mapped["Usuario"] = relationship()
