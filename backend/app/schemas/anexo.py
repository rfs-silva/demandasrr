"""Schemas de Anexo."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.solicitacao import UsuarioResumo


class AnexoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename_original: str
    content_type: str
    tamanho_bytes: int
    usuario: UsuarioResumo
    created_at: datetime

    @classmethod
    def from_orm(cls, anexo) -> "AnexoOut":
        return cls(
            id=anexo.id,
            filename_original=anexo.filename_original,
            content_type=anexo.content_type,
            tamanho_bytes=anexo.tamanho_bytes,
            usuario=UsuarioResumo(
                id=anexo.usuario.id,
                nome=anexo.usuario.nome,
                login=anexo.usuario.login,
            ),
            created_at=anexo.created_at,
        )
