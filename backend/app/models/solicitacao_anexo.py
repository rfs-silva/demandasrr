"""Anexo de Solicitação (arquivos armazenados no MinIO/S3)."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPK

if TYPE_CHECKING:
    from app.models.solicitacao import Solicitacao
    from app.models.usuario import Usuario


class SolicitacaoAnexo(UUIDPK, TimestampMixin, Base):
    __tablename__ = "solicitacao_anexo"
    __table_args__ = (
        Index("ix_solicitacao_anexo_solicitacao", "solicitacao_id"),
    )

    solicitacao_id: Mapped[UUID] = mapped_column(
        ForeignKey("solicitacao.id", ondelete="CASCADE"),
        nullable=False,
    )
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuario.id", ondelete="RESTRICT"),
        nullable=False,
    )
    filename_original: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    tamanho_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # caminho dentro do bucket (ex.: "solicitacoes/<uuid>/<anexo_uuid>.pdf")
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)

    solicitacao: Mapped["Solicitacao"] = relationship(back_populates="anexos")
    usuario: Mapped["Usuario"] = relationship()
