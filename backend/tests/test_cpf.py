"""Testes do validador de CPF."""

from __future__ import annotations

import pytest

from app.core.cpf import CPFInvalido, formatar, is_valid, mascarar, somente_digitos, validar


@pytest.mark.parametrize(
    "valor",
    [
        "11144477735",      # válido conhecido
        "111.444.777-35",   # com máscara
        " 111.444.777-35 ", # espaços
        "529.982.247-25",
    ],
)
def test_cpf_validos(valor):
    assert is_valid(valor)
    assert validar(valor) == somente_digitos(valor)


@pytest.mark.parametrize(
    "valor",
    [
        "12345678900",     # dígitos verificadores incorretos
        "111.444.777-30",  # check digit alterado
        "00000000000",     # blocked: todos iguais
        "11111111111",
        "99999999999",
        "1234567890",      # 10 dígitos
        "123456789012",    # 12 dígitos
        "abcdefghijk",     # não numérico
        "",                # vazio
        None,              # None
    ],
)
def test_cpf_invalidos(valor):
    assert not is_valid(valor or "")
    with pytest.raises(CPFInvalido):
        validar(valor or "")


def test_formatar():
    assert formatar("11144477735") == "111.444.777-35"
    assert formatar("111.444.777-35") == "111.444.777-35"


def test_mascarar():
    assert mascarar("11144477735") == "***.***.***-35"
    assert mascarar("xx") == "***"
