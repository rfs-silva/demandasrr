"""Smoke tests dos endpoints públicos usando ASGI transport (sem rede)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_login_sem_credenciais_retorna_422(client):
    r = await client.post("/api/v1/auth/login", json={})
    assert r.status_code == 422
    body = r.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_endpoint_protegido_sem_token_retorna_401(client):
    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 401
    body = r.json()
    assert body["error"]["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_endpoint_pessoas_sem_token_retorna_401(client):
    r = await client.get("/api/v1/pessoas")
    assert r.status_code == 401
    body = r.json()
    assert body["error"]["code"] == "INVALID_TOKEN"


@pytest.mark.asyncio
async def test_swagger_acessivel(client):
    r = await client.get("/api/openapi.json")
    assert r.status_code == 200
    spec = r.json()
    assert "/api/v1/health" in spec["paths"]
    assert "/api/v1/auth/login" in spec["paths"]
    assert "/api/v1/municipios" in spec["paths"]


@pytest.mark.asyncio
async def test_login_define_refresh_em_cookie_httponly(client, monkeypatch):
    async def fake_authenticate(*args, **kwargs):
        return SimpleNamespace(id="user-1"), "access.jwt", "refresh.jwt", 900

    monkeypatch.setattr(
        "app.api.v1.auth.auth_service.authenticate",
        fake_authenticate,
    )

    r = await client.post(
        "/api/v1/auth/login",
        json={"login": "admin", "senha": "Segura!123"},
    )

    assert r.status_code == 200
    assert r.json()["data"]["access_token"] == "access.jwt"
    assert "refresh_token" not in r.json()["data"]
    cookie = r.headers.get("set-cookie", "")
    assert "demandasrr_refresh=refresh.jwt" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/auth" in cookie


@pytest.mark.asyncio
async def test_refresh_aceita_cookie_sem_body(client, monkeypatch):
    async def fake_refresh(*args, **kwargs):
        assert kwargs["refresh_token"] == "cookie.refresh"
        return "novo.access", "novo.refresh", 900

    monkeypatch.setattr("app.api.v1.auth.auth_service.refresh", fake_refresh)
    client.cookies.set("demandasrr_refresh", "cookie.refresh")

    r = await client.post("/api/v1/auth/refresh")

    assert r.status_code == 200
    assert r.json()["data"]["access_token"] == "novo.access"
    assert "refresh_token" not in r.json()["data"]
    cookie = r.headers.get("set-cookie", "")
    assert "demandasrr_refresh=novo.refresh" in cookie
