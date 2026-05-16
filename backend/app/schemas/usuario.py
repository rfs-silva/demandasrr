"""Schemas de Usuário."""

from __future__ import annotations

from datetime import date, datetime
import re
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.cpf import CPFInvalido, validar
from app.core.cpf_privacy import cpf_para_viewer
from app.models.enums import PerfilUsuario, Situacao
from app.schemas.municipio import MunicipioOut


_LOGIN_RE = re.compile(r"^[A-Za-z0-9._-]{3,50}$")


def _validar_senha(s: str) -> str:
    if len(s) < 6:
        raise ValueError("Senha deve ter ao menos 6 caracteres")
    if len(s) > 128:
        raise ValueError("Senha muito longa")
    if not any(c.isalpha() for c in s) or not any(c.isdigit() for c in s):
        raise ValueError("Senha deve conter letras e números")
    return s


class UsuarioCreate(BaseModel):
    """Cadastro de usuário (suporte/gestor/admin).

    O login é sempre derivado do CPF do usuário.
    Senha inicial = `4 últimos dígitos do CPF`; o usuário é forçado a trocar
    no primeiro acesso.
    """

    nome: str = Field(min_length=3, max_length=150)
    login: str | None = Field(default=None, min_length=3, max_length=50)
    cpf: str = Field(min_length=11, max_length=14)
    municipio_id: UUID
    perfil: PerfilUsuario = PerfilUsuario.suporte
    localidade: str | None = Field(default=None, max_length=200)
    contato: str | None = Field(default=None, max_length=50)
    data_nascimento: date | None = None
    # Flags: só efetivadas se o requester for administrador (service valida).
    pode_criar_usuarios: bool | None = None
    pode_criar_solicitacoes: bool | None = None
    pode_reabrir_solicitacoes: bool | None = None
    ver_status_solicitacao: bool | None = None

    @field_validator("cpf")
    @classmethod
    def _valida_cpf(cls, v: str) -> str:
        try:
            return validar(v)
        except CPFInvalido as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("login")
    @classmethod
    def _valida_login(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip()
        if not _LOGIN_RE.fullmatch(value):
            raise ValueError(
                "Login deve ter 3 a 50 caracteres e usar apenas letras, números, ponto, hífen ou sublinhado"
            )
        return value

    @field_validator("nome", "localidade", "contato")
    @classmethod
    def _trim(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class UsuarioUpdate(BaseModel):
    """Edição de usuário. Login/CPF são imutáveis após o cadastro."""

    nome: str | None = Field(default=None, min_length=3, max_length=150)
    perfil: PerfilUsuario | None = None
    municipio_id: UUID | None = None
    localidade: str | None = Field(default=None, max_length=200)
    contato: str | None = Field(default=None, max_length=50)
    data_nascimento: date | None = None
    situacao: Situacao | None = None
    pode_criar_usuarios: bool | None = None
    pode_criar_solicitacoes: bool | None = None
    pode_reabrir_solicitacoes: bool | None = None
    ver_status_solicitacao: bool | None = None

    @field_validator("nome", "localidade", "contato")
    @classmethod
    def _trim(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class UsuarioSenhaUpdate(BaseModel):
    """Reset administrativo da senha.

    A senha não é informada manualmente: o serviço sempre reseta para os
    4 últimos dígitos do CPF do usuário alvo.
    """


class MinhaSenhaUpdate(BaseModel):
    """Troca da própria senha (após primeiro login ou voluntária)."""

    senha_atual: str = Field(min_length=1, max_length=128)
    nova_senha: str = Field(min_length=6, max_length=128)

    @field_validator("nova_senha")
    @classmethod
    def _valida(cls, v: str) -> str:
        return _validar_senha(v)


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    login: str
    cpf: str | None
    perfil: PerfilUsuario
    situacao: Situacao
    municipio: MunicipioOut | None
    localidade: str | None
    contato: str | None
    data_nascimento: date | None
    must_change_password: bool
    eh_root: bool
    pode_criar_usuarios: bool
    pode_criar_solicitacoes: bool
    pode_reabrir_solicitacoes: bool
    ver_status_solicitacao: bool
    ultimo_login: datetime | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm(cls, u, *, viewer=None) -> "UsuarioOut":
        """Monta o DTO aplicando a regra de privacidade do CPF.

        Quando ``u`` é um governador, o CPF só é entregue (mascarado) para o
        próprio governador ou para um administrador. Para os demais perfis o
        campo fica oculto. ``viewer=None`` mantém compat com chamadas internas
        em que ainda não temos contexto do solicitante: nesse modo nenhum CPF
        é divulgado.
        """
        viewer_id = getattr(viewer, "id", None)
        viewer_perfil = getattr(viewer, "perfil", None)
        cpf_visivel = cpf_para_viewer(
            cpf_raw=u.cpf,
            dono_perfil=u.perfil,
            dono_id=u.id,
            viewer_id=viewer_id,
            viewer_perfil=viewer_perfil,
        )
        return cls(
            id=u.id,
            nome=u.nome,
            login=u.login,
            cpf=cpf_visivel,
            perfil=u.perfil,
            situacao=u.situacao,
            municipio=MunicipioOut.model_validate(u.municipio) if u.municipio else None,
            localidade=u.localidade,
            contato=u.contato,
            data_nascimento=u.data_nascimento,
            must_change_password=u.must_change_password,
            eh_root=u.eh_root,
            pode_criar_usuarios=u.pode_criar_usuarios,
            pode_criar_solicitacoes=u.pode_criar_solicitacoes,
            pode_reabrir_solicitacoes=u.pode_reabrir_solicitacoes,
            ver_status_solicitacao=u.ver_status_solicitacao,
            ultimo_login=u.ultimo_login,
            created_at=u.created_at,
            updated_at=u.updated_at,
        )


class UsuarioCriadoOut(BaseModel):
    """Resposta de criação inclui a senha temporária para informar ao usuário."""

    usuario: UsuarioOut
    senha_temporaria: str
