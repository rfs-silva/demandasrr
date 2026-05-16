"""Validação e formatação de CPF.

Algoritmo oficial dos dígitos verificadores (módulo 11) — o mesmo que a
Receita Federal usa para validar o checksum. Não consulta nenhum serviço
externo: apenas garante que o número é estruturalmente válido.
"""

from __future__ import annotations

import re

_ONLY_DIGITS = re.compile(r"\D+")

# CPFs com todos os dígitos iguais passam no algoritmo mas são inválidos
# por convenção (são "padrões reservados" / casos clássicos de teste falho).
_BLOCKED = {str(d) * 11 for d in range(10)}


class CPFInvalido(ValueError):
    """CPF não passou na validação estrutural."""


def somente_digitos(cpf: str) -> str:
    """Remove pontuação. Aceita ``123.456.789-09`` ou ``12345678909``."""
    return _ONLY_DIGITS.sub("", cpf or "")


def _digito(cpf: str, peso_inicial: int) -> int:
    soma = sum(int(d) * (peso_inicial - i) for i, d in enumerate(cpf[: peso_inicial - 1]))
    resto = (soma * 10) % 11
    return 0 if resto == 10 else resto


def is_valid(cpf: str) -> bool:
    """Retorna True se ``cpf`` (com ou sem máscara) é estruturalmente válido."""
    cpf = somente_digitos(cpf)
    if len(cpf) != 11 or not cpf.isdigit():
        return False
    if cpf in _BLOCKED:
        return False
    return _digito(cpf, 10) == int(cpf[9]) and _digito(cpf, 11) == int(cpf[10])


def validar(cpf: str) -> str:
    """Normaliza para 11 dígitos. Lança ``CPFInvalido`` se inválido."""
    digits = somente_digitos(cpf)
    if not is_valid(digits):
        raise CPFInvalido("CPF inválido")
    return digits


def formatar(cpf: str) -> str:
    """``12345678909`` → ``123.456.789-09`` (não valida)."""
    cpf = somente_digitos(cpf)
    if len(cpf) != 11:
        return cpf
    return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"


def mascarar(cpf: str) -> str:
    """``12345678909`` → ``***.***.***-09`` (para exibir a perfis sem permissão total)."""
    cpf = somente_digitos(cpf)
    if len(cpf) != 11:
        return "***"
    return f"***.***.***-{cpf[9:]}"
