"""Modelo Usuario."""

from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPK
from app.models.enums import PerfilUsuario, Situacao

if TYPE_CHECKING:
    from app.models.municipio import Municipio
    from app.models.pessoa import Pessoa
    from app.models.solicitacao import Solicitacao


class Usuario(UUIDPK, TimestampMixin, Base):
    __tablename__ = "usuario"
    __table_args__ = (
        Index("ix_usuario_login_lower", "login", unique=True),
        Index("ix_usuario_cpf", "cpf"),
    )

    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    login: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    perfil: Mapped[PerfilUsuario] = mapped_column(
        SAEnum(PerfilUsuario, name="perfil_usuario_enum", native_enum=True, create_type=False),
        nullable=False,
        default=PerfilUsuario.suporte,
        server_default=PerfilUsuario.suporte.value,
    )
    situacao: Mapped[Situacao] = mapped_column(
        SAEnum(Situacao, name="situacao_enum", native_enum=True, create_type=False),
        nullable=False,
        default=Situacao.ativo,
        server_default=Situacao.ativo.value,
    )

    # ---- Dados de identificação (suporte/gestor) ----
    cpf: Mapped[str | None] = mapped_column(String(11), nullable=True, unique=True)
    municipio_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("municipio.id", ondelete="SET NULL"),
        nullable=True,
    )
    localidade: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contato: Mapped[str | None] = mapped_column(String(50), nullable=True)
    data_nascimento: Mapped[date | None] = mapped_column(Date(), nullable=True)

    # ---- Controle ----
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    eh_root: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Flag controlada pelo admin para liberar criação de usuários ao governador.
    pode_criar_usuarios: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    # Flag controlada pelo admin para liberar criação de solicitações a
    # suporte/governador (gestor_solicitante e admin sempre podem).
    pode_criar_solicitacoes: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    # Flag controlada pelo admin para permitir ao suporte reabrir solicitações
    # canceladas, movendo-as de volta para "em análise".
    pode_reabrir_solicitacoes: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    # Flag controlada pelo admin para liberar a visualização do status real
    # ao gestor_solicitante (por padrão ele vê sempre "Cadastrada").
    ver_status_solicitacao: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Vínculo legacy com Pessoa (criada automaticamente pelo service)
    pessoa_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("pessoa.id", ondelete="SET NULL"),
        nullable=True,
    )
    ultimo_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    municipio: Mapped["Municipio | None"] = relationship(lazy="joined")
    pessoa: Mapped["Pessoa | None"] = relationship(back_populates="usuario")
    solicitacoes: Mapped[list["Solicitacao"]] = relationship(
        back_populates="usuario",
        passive_deletes=True,
    )
