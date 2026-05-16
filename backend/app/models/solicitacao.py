"""Modelo Solicitacao."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy import (
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPK
from app.models.enums import AreaSolicitacao, StatusSolicitacao

if TYPE_CHECKING:
    from app.models.pessoa import Pessoa
    from app.models.solicitacao_anexo import SolicitacaoAnexo
    from app.models.solicitacao_evento import SolicitacaoEvento
    from app.models.usuario import Usuario


class Solicitacao(UUIDPK, TimestampMixin, Base):
    __tablename__ = "solicitacao"
    __table_args__ = (
        Index("ix_solicitacao_municipio", "municipio"),
        Index("ix_solicitacao_area", "area"),
        Index("ix_solicitacao_status", "status"),
        Index("ix_solicitacao_data", "data_solicitacao"),
        Index("ix_solicitacao_usuario", "usuario_id"),
        Index("ix_solicitacao_pessoa", "pessoa_id"),
        CheckConstraint(
            "char_length(descricao) >= 10 AND char_length(descricao) <= 2000",
            name="ck_solicitacao_descricao_len",
        ),
    )

    pessoa_id: Mapped[UUID] = mapped_column(
        ForeignKey("pessoa.id", ondelete="RESTRICT"),
        nullable=False,
    )
    usuario_id: Mapped[UUID] = mapped_column(
        ForeignKey("usuario.id", ondelete="RESTRICT"),
        nullable=False,
    )
    municipio: Mapped[str] = mapped_column(String(100), nullable=False)
    area: Mapped[AreaSolicitacao] = mapped_column(
        SAEnum(AreaSolicitacao, name="area_solicitacao_enum", native_enum=True),
        nullable=False,
    )
    titulo: Mapped[str] = mapped_column(String(120), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[StatusSolicitacao] = mapped_column(
        SAEnum(StatusSolicitacao, name="status_solicitacao_enum", native_enum=True),
        nullable=False,
        default=StatusSolicitacao.cadastrada,
        server_default=StatusSolicitacao.cadastrada.value,
    )
    data_solicitacao: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    pessoa: Mapped["Pessoa"] = relationship(back_populates="solicitacoes")
    usuario: Mapped["Usuario"] = relationship(back_populates="solicitacoes")
    eventos: Mapped[list["SolicitacaoEvento"]] = relationship(
        back_populates="solicitacao",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SolicitacaoEvento.created_at.asc()",
    )
    anexos: Mapped[list["SolicitacaoAnexo"]] = relationship(
        back_populates="solicitacao",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="SolicitacaoAnexo.created_at.desc()",
    )
