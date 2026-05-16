"""Log de auditoria global — registra ações sensíveis no sistema."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPK
from app.models.enums import AcaoAudit, EntidadeAudit

if TYPE_CHECKING:
    from app.models.usuario import Usuario


class AuditLog(UUIDPK, TimestampMixin, Base):
    """Evento auditável.

    Guarda **snapshots** do ator (nome/login/perfil) para que o log siga
    legível mesmo se o usuário for renomeado ou inativado depois.
    """

    __tablename__ = "audit_log"
    __table_args__ = (
        Index("ix_audit_log_created", "created_at"),
        Index("ix_audit_log_acao", "acao"),
        Index("ix_audit_log_entidade", "entidade", "entidade_id"),
        Index("ix_audit_log_actor", "actor_id"),
    )

    actor_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("usuario.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_login: Mapped[str | None] = mapped_column(String(50), nullable=True)
    actor_nome: Mapped[str | None] = mapped_column(String(150), nullable=True)
    actor_perfil: Mapped[str | None] = mapped_column(String(30), nullable=True)

    acao: Mapped[AcaoAudit] = mapped_column(
        SAEnum(AcaoAudit, name="acao_audit_enum", native_enum=True),
        nullable=False,
    )
    entidade: Mapped[EntidadeAudit] = mapped_column(
        SAEnum(EntidadeAudit, name="entidade_audit_enum", native_enum=True),
        nullable=False,
    )
    entidade_id: Mapped[UUID | None] = mapped_column(nullable=True)
    entidade_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    """Descrição curta do alvo (ex.: nome do usuário, "Solicitação #abc12345")."""

    detalhes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    """Payload extra: diff de campos, motivo, status anterior/atual, etc."""

    ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    actor: Mapped["Usuario | None"] = relationship(foreign_keys=[actor_id])
