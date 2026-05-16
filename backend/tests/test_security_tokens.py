"""Roundtrip de JWT: encode → decode preserva claims e respeita o tipo."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    h = hash_password("S3nhaForte!")
    assert verify_password("S3nhaForte!", h)
    assert not verify_password("outra", h)


def test_access_token_roundtrip():
    sub = uuid4()
    token, _ = create_access_token(subject=sub, perfil="administrador")
    payload = decode_token(token, expected_type="access")
    assert payload["sub"] == str(sub)
    assert payload["perfil"] == "administrador"
    assert payload["type"] == "access"
    assert "jti" in payload


def test_refresh_token_roundtrip():
    sub = uuid4()
    jti = uuid4()
    token, _ = create_refresh_token(subject=sub, jti=jti)
    payload = decode_token(token, expected_type="refresh")
    assert payload["sub"] == str(sub)
    assert payload["jti"] == str(jti)
    assert payload["type"] == "refresh"


def test_decode_rejects_wrong_type():
    token, _ = create_access_token(subject=uuid4(), perfil="apoio")
    with pytest.raises(TokenError):
        decode_token(token, expected_type="refresh")


def test_decode_rejects_garbage():
    with pytest.raises(TokenError):
        decode_token("not-a-jwt", expected_type="access")
