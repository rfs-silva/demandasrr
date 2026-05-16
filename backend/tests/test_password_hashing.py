"""Hash + verify de senha (bcrypt)."""

from __future__ import annotations

import pytest

from app.core.security import hash_password, verify_password


def test_hash_e_verify_roundtrip():
    h = hash_password("Senha!Forte123")
    assert h.startswith("$2")  # prefixo bcrypt
    assert verify_password("Senha!Forte123", h)
    assert not verify_password("outraCoisa", h)


def test_hash_distinto_a_cada_execucao():
    a = hash_password("mesma")
    b = hash_password("mesma")
    assert a != b  # salt aleatório


def test_verify_invalido_falha_sem_excecao():
    assert not verify_password("qualquer", "$2b$12$invalid.hash")


@pytest.mark.parametrize(
    "senha",
    [
        "a" * 100,  # senha extremamente longa — não deve quebrar (truncamos 72 bytes)
        "Sénh@ ÁccénTos áéíóú",
        " " * 50,
    ],
)
def test_aceita_senhas_extremas(senha):
    h = hash_password(senha)
    assert verify_password(senha, h)
