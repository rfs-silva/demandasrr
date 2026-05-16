"""Utilitários de segurança: hash bcrypt + emissão/verificação de JWT."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import UUID, uuid4

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings

# ---------- Senha ----------

_BCRYPT_ROUNDS = 12
_MAX_PASSWORD_BYTES = 72  # bcrypt trunca em 72 bytes — truncamos no encode também


def _normalize_password(plain: str) -> bytes:
    """bcrypt aceita no máximo 72 bytes; chunks adicionais são silenciosamente
    ignorados. Truncar explicitamente evita o ``ValueError`` lançado pelo
    bcrypt >= 4.1 e mantém o comportamento determinístico.
    """
    return plain.encode("utf-8")[:_MAX_PASSWORD_BYTES]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_normalize_password(plain), bcrypt.gensalt(_BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_normalize_password(plain), hashed.encode("utf-8"))
    except ValueError:
        return False


# ---------- JWT ----------

TokenType = Literal["access", "refresh"]


class TokenError(Exception):
    """Erro de validação/decodificação de token."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(
    *,
    subject: UUID | str,
    perfil: str,
    extra_claims: dict[str, Any] | None = None,
) -> tuple[str, datetime]:
    settings = get_settings()
    expires = _now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "perfil": perfil,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int(expires.timestamp()),
        "jti": uuid4().hex,
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def create_refresh_token(
    *,
    subject: UUID | str,
    jti: UUID,
) -> tuple[str, datetime]:
    """O ``jti`` corresponde ao id da linha em ``refresh_token`` (rotacionável)."""
    settings = get_settings()
    expires = _now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(subject),
        "type": "refresh",
        "iat": int(_now().timestamp()),
        "exp": int(expires.timestamp()),
        "jti": str(jti),
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def decode_token(token: str, *, expected_type: TokenType) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise TokenError("token inválido ou expirado") from exc

    if payload.get("type") != expected_type:
        raise TokenError(f"tipo de token incorreto (esperado {expected_type})")
    if "sub" not in payload:
        raise TokenError("token sem subject")
    return payload
