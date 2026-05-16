"""Testa regras dos schemas de Usuário (sem banco)."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.usuario import UsuarioCreate, UsuarioSenhaUpdate


def _base(**over):
    base = {
        "nome": "Maria Silva",
        "login": "maria",
        "senha": "Senha123",
        "perfil": "apoio",
    }
    base.update(over)
    return base


def test_create_basico():
    u = UsuarioCreate(**_base())
    assert u.login == "maria"
    assert u.perfil.value == "apoio"


@pytest.mark.parametrize(
    "senha",
    [
        "curta",          # < 8
        "tudoletras",     # sem dígito
        "12345678",       # sem letra
    ],
)
def test_senha_invalida(senha):
    with pytest.raises(ValidationError):
        UsuarioCreate(**_base(senha=senha))


@pytest.mark.parametrize(
    "login",
    [
        "ma",            # < 3
        "maria silva",   # espaço
        "maria@silva",   # caractere proibido
        "x" * 51,        # > 50
    ],
)
def test_login_invalido(login):
    with pytest.raises(ValidationError):
        UsuarioCreate(**_base(login=login))


def test_senha_update_aceita_valido():
    UsuarioSenhaUpdate(senha="Senha123")


def test_senha_update_rejeita_invalido():
    with pytest.raises(ValidationError):
        UsuarioSenhaUpdate(senha="aaaaaaaa")
