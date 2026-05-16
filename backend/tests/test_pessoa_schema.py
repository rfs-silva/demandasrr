"""Testa as regras dos schemas Pydantic de Pessoa (sem banco)."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.pessoa import PessoaCreate, PessoaUpdate


def _base(**over):
    base = {
        "nome": "Maria Silva",
        "cpf": "529.982.247-25",
        "data_nascimento": "1985-04-10",
        "municipio_id": str(uuid4()),
    }
    base.update(over)
    return base


def test_create_basico_normaliza_cpf():
    p = PessoaCreate(**_base())
    assert p.cpf == "52998224725"
    assert p.nome == "Maria Silva"


def test_create_aceita_localidade():
    p = PessoaCreate(**_base(localidade="  Vila Vista Alegre  "))
    assert p.localidade == "Vila Vista Alegre"


def test_create_strips_empty_localidade():
    p = PessoaCreate(**_base(localidade="   "))
    assert p.localidade is None


@pytest.mark.parametrize("cpf", ["123", "11111111111", "abcdefghijk", ""])
def test_cpf_invalido_rejeitado(cpf):
    with pytest.raises(ValidationError):
        PessoaCreate(**_base(cpf=cpf))


def test_data_nascimento_futuro_rejeitada():
    futura = (date.today() + timedelta(days=1)).isoformat()
    with pytest.raises(ValidationError):
        PessoaCreate(**_base(data_nascimento=futura))


def test_data_nascimento_muito_antiga_rejeitada():
    with pytest.raises(ValidationError):
        PessoaCreate(**_base(data_nascimento="1899-12-31"))


def test_nome_minimo():
    with pytest.raises(ValidationError):
        PessoaCreate(**_base(nome="ab"))


def test_update_parcial_aceita_subset():
    u = PessoaUpdate(nome="Novo Nome")
    assert u.nome == "Novo Nome"
    assert u.municipio_id is None
    assert u.localidade is None
