"""Instância global do limiter (slowapi)."""

from __future__ import annotations

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.client_ip import resolve_client_ip
from app.core.config import get_settings


def _key(request) -> str:  # type: ignore[no-untyped-def]
    client_ip = resolve_client_ip(request)
    if client_ip:
        return client_ip
    return get_remote_address(request)


limiter = Limiter(key_func=_key, default_limits=[])


def login_rate_limit() -> str:
    """Retorna a string de limite configurada (ex.: '5/minute')."""
    return get_settings().LOGIN_RATE_LIMIT
