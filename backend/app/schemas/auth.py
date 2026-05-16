"""Schemas de autenticação."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginIn(BaseModel):
    login: str = Field(min_length=3, max_length=50, description="Login do usuário")
    senha: str = Field(min_length=1, max_length=128)


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=10)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    login: str
    perfil: str
    contato: str | None = None
    must_change_password: bool
    eh_root: bool
    pode_criar_usuarios: bool
    pode_criar_solicitacoes: bool
    pode_reabrir_solicitacoes: bool
    ver_status_solicitacao: bool
    pessoa_id: UUID | None = None


class MeUpdate(BaseModel):
    """Edição dos dados próprios pelo usuário autenticado.

    Campos imutáveis (login, cpf, perfil, situacao, flags) **não entram aqui**:
    são alterados apenas pelo módulo de Usuários, por quem tem permissão.
    """

    nome: str | None = Field(default=None, min_length=3, max_length=150)
    municipio_id: UUID | None = None
    localidade: str | None = Field(default=None, max_length=200)
    contato: str | None = Field(default=None, max_length=50)
    data_nascimento: date | None = None

    @field_validator("nome", "localidade", "contato")
    @classmethod
    def _trim(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None
