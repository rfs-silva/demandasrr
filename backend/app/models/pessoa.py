"""Modelo Pessoa."""

from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPK
from app.models.enums import Situacao

if TYPE_CHECKING:
    from app.models.municipio import Municipio
    from app.models.solicitacao import Solicitacao
    from app.models.usuario import Usuario


class Pessoa(UUIDPK, TimestampMixin, Base):
    __tablename__ = "pessoa"
    __table_args__ = (
        Index("ix_pessoa_municipio_id", "municipio_id"),
        Index("ix_pessoa_cpf", "cpf", unique=True),
    )

    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    cpf: Mapped[str] = mapped_column(String(11), nullable=False, unique=True)
    data_nascimento: Mapped[date | None] = mapped_column(Date(), nullable=True)

    municipio_id: Mapped[UUID] = mapped_column(
        ForeignKey("municipio.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # Comunidade, vila, vicinal etc. — obrigatório quando municipio for 'Outros'.
    localidade: Mapped[str | None] = mapped_column(String(200), nullable=True)

    situacao: Mapped[Situacao] = mapped_column(
        SAEnum(Situacao, name="situacao_enum", native_enum=True, create_type=False),
        nullable=False,
        default=Situacao.ativo,
        server_default=Situacao.ativo.value,
    )

    municipio: Mapped["Municipio"] = relationship(lazy="joined")
    solicitacoes: Mapped[list["Solicitacao"]] = relationship(
        back_populates="pessoa",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    usuario: Mapped["Usuario | None"] = relationship(
        back_populates="pessoa",
        uselist=False,
    )
