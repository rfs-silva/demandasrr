"""Smoke test: garante que o metadata dos models está bem formado."""

from __future__ import annotations

from app.db.base import Base
import app.db.base_all  # noqa: F401 — registra os models no metadata


EXPECTED_TABLES = {"pessoa", "usuario", "solicitacao"}


def test_metadata_has_expected_tables():
    tables = set(Base.metadata.tables.keys())
    assert EXPECTED_TABLES.issubset(tables), f"faltando: {EXPECTED_TABLES - tables}"


def test_pessoa_has_unique_cpf():
    pessoa = Base.metadata.tables["pessoa"]
    unique_cols = {
        tuple(c.name for c in uc.columns) for uc in pessoa.constraints if uc.__class__.__name__ == "UniqueConstraint"
    }
    assert ("cpf",) in unique_cols


def test_solicitacao_has_descricao_check():
    solicitacao = Base.metadata.tables["solicitacao"]
    check_names = {
        c.name for c in solicitacao.constraints if c.__class__.__name__ == "CheckConstraint"
    }
    assert "ck_solicitacao_descricao_len" in check_names
