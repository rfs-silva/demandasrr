"""Schemas do log de auditoria."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import AcaoAudit, EntidadeAudit


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime

    actor_id: UUID | None
    actor_login: str | None
    actor_nome: str | None
    actor_perfil: str | None

    acao: AcaoAudit
    entidade: EntidadeAudit
    entidade_id: UUID | None
    entidade_label: str | None

    detalhes: dict[str, Any] | None
    ip: str | None
