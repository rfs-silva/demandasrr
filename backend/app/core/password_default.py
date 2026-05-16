"""Geração de senhas temporárias derivadas do CPF.

- Criação de usuário: usa os **4 últimos dígitos do CPF**.
- Reset administrativo: usa os **4 últimos dígitos do CPF**.

O usuário é forçado a trocar essa senha temporária no primeiro acesso por
uma senha pessoal que atende às regras de complexidade.
"""

from __future__ import annotations

from app.core.cpf import somente_digitos


def gerar_senha_padrao(*, cpf: str, nome: str = "") -> str:  # noqa: ARG001
    """Retorna os 4 últimos dígitos do CPF.

    ``nome`` é aceito por compatibilidade de assinatura, mas não é usado.
    """
    cpf_dig = somente_digitos(cpf)
    return cpf_dig[-4:] if len(cpf_dig) >= 4 else cpf_dig.zfill(4)


def gerar_senha_reset(*, cpf: str) -> str:
    """Retorna os 4 últimos dígitos do CPF para reset administrativo."""
    cpf_dig = somente_digitos(cpf)
    return cpf_dig[-4:] if len(cpf_dig) >= 4 else cpf_dig.zfill(4)
