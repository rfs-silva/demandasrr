"""Schemas de Município."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, ConfigDict


class MunicipioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    eh_outros: bool
