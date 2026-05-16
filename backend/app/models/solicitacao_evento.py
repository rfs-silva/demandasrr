"""Modelo SolicitacaoEvento — linha do tempo / auditoria de mudanças."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPK
from app.models.enums import StatusSolicitacao, TipoEventoSolicitacao

if TYPE_CHECKING:
    from app.models.solicitacao import Solicitacao
    from app.models.usuario import Usuario


class SolicitacaoEvento(UUIDPK, TimestampMixin, Base):
    __tablename__ = "solicitacao_evento"
    __table_args__ = (
        Index("ix_solicitacao_evento_solicitacao", "solicitacao_id"),
        Index("ix_solicitacao_evento_created", "created_at"),
    )

    solicitacao_id: Mapped[UUID] = mapped_column(
        ForeignKey("solicitacao.id", ondelete="CASCADE"),
        nullable=False,
    )
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuario.id", ondelete="RESTRICT"),
        nullable=False,
    )
    tipo: Mapped[TipoEventoSolicitacao] = mapped_column(
        SAEnum(
            TipoEventoSolicitacao,
            name="tipo_evento_solicitacao_enum",
            native_enum=True,
        ),
        nullable=False,
    )
    de_status: Mapped[StatusSolicitacao | None] = mapped_column(
        SAEnum(
            StatusSolicitacao,
            name="status_solicitacao_enum",
            native_enum=True,
            create_type=False,
        ),
        nullable=True,
    )
    para_status: Mapped[StatusSolicitacao | None] = mapped_column(
        SAEnum(
            StatusSolicitacao,
            name="status_solicitacao_enum",
            native_enum=True,
            create_type=False,
        ),
        nullable=True,
    )
    comentario: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Eventos `interno=True` são visíveis apenas para gestor/administrador.
    interno: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    solicitacao: Mapped["Solicitacao"] = relationship(back_populates="eventos")
    usuario: Mapped["Usuario"] = relationship()
