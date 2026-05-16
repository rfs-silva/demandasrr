"""Schemas de Pessoa."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.cpf import CPFInvalido, validar
from app.core.cpf_privacy import cpf_para_viewer
from app.models.enums import Situacao
from app.schemas.municipio import MunicipioOut

_MIN_BIRTH = date(1900, 1, 1)


def _validar_data_nascimento(v: date) -> date:
    if v < _MIN_BIRTH:
        raise ValueError("Data de nascimento muito antiga")
    if v > date.today():
        raise ValueError("Data de nascimento não pode ser no futuro")
    return v


class PessoaBase(BaseModel):
    nome: str = Field(min_length=3, max_length=150)
    municipio_id: UUID
    localidade: str | None = Field(default=None, max_length=200)


class PessoaCreate(PessoaBase):
    cpf: str = Field(min_length=11, max_length=14)
    data_nascimento: date

    @field_validator("cpf")
    @classmethod
    def _valida_cpf(cls, v: str) -> str:
        try:
            return validar(v)
        except CPFInvalido as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("data_nascimento")
    @classmethod
    def _valida_data(cls, v: date) -> date:
        return _validar_data_nascimento(v)

    @field_validator("nome", "localidade")
    @classmethod
    def _trim(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class PessoaUpdate(BaseModel):
    """CPF não é editável — chave natural fixa após o cadastro."""

    nome: str | None = Field(default=None, min_length=3, max_length=150)
    municipio_id: UUID | None = None
    localidade: str | None = Field(default=None, max_length=200)
    data_nascimento: date | None = None
    situacao: Situacao | None = None

    @field_validator("nome", "localidade")
    @classmethod
    def _trim(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("data_nascimento")
    @classmethod
    def _valida_data(cls, v: date | None) -> date | None:
        return _validar_data_nascimento(v) if v is not None else None


class PessoaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    cpf: str
    data_nascimento: date
    municipio: MunicipioOut
    localidade: str | None
    situacao: Situacao
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def _self(self) -> "PessoaOut":
        return self

    @classmethod
    def from_orm_for(cls, pessoa, *, viewer) -> "PessoaOut":
        """Monta o DTO aplicando as regras de privacidade do CPF.

        Se a pessoa está vinculada a um usuário governador, o CPF só é
        entregue (mascarado) para o próprio governador e para o administrador;
        para os demais perfis, fica oculto. Caso contrário, vale a regra
        antiga (admin vê completo, demais veem mascarado).
        """
        dono = pessoa.usuario  # carregado via selectinload
        cpf_visivel = cpf_para_viewer(
            cpf_raw=pessoa.cpf,
            dono_perfil=dono.perfil if dono is not None else None,
            dono_id=dono.id if dono is not None else None,
            viewer_id=getattr(viewer, "id", None),
            viewer_perfil=getattr(viewer, "perfil", None),
        )
        return cls(
            id=pessoa.id,
            nome=pessoa.nome,
            cpf=cpf_visivel or "",
            data_nascimento=pessoa.data_nascimento,
            municipio=MunicipioOut.model_validate(pessoa.municipio),
            localidade=pessoa.localidade,
            situacao=pessoa.situacao,
            created_at=pessoa.created_at,
            updated_at=pessoa.updated_at,
        )
