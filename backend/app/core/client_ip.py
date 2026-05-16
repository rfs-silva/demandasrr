"""Resolve o IP real do cliente a partir do request HTTP.

Prioriza headers de proxy reverso repassados pelo Nginx para que auditoria,
rate-limit e autenticação usem o IP da máquina do usuário, e não o IP do
container/proxy intermediário.
"""

from __future__ import annotations

from fastapi import Request


def _first_public_candidate(raw: str | None) -> str | None:
    if not raw:
        return None
    for part in raw.split(","):
        candidate = part.strip().strip('"').strip()
        if candidate and candidate.lower() != "unknown":
            return candidate
    return None


def _forwarded_for_value(raw: str | None) -> str | None:
    if not raw:
        return None
    for item in raw.split(";"):
        key, sep, value = item.partition("=")
        if sep and key.strip().lower() == "for":
            return value.strip().strip('"').strip("[]")
    return None


def resolve_client_ip(request: Request | None) -> str | None:
    """Retorna o IP do cliente priorizando headers de proxy confiáveis."""
    if request is None:
        return None

    forwarded_for = _first_public_candidate(request.headers.get("x-forwarded-for"))
    if forwarded_for:
        return forwarded_for

    real_ip = _first_public_candidate(request.headers.get("x-real-ip"))
    if real_ip:
        return real_ip

    forwarded = _forwarded_for_value(request.headers.get("forwarded"))
    if forwarded:
        return forwarded

    return request.client.host if request.client else None