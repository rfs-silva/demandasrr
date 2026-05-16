from __future__ import annotations

from starlette.requests import Request

from app.core.client_ip import resolve_client_ip


def _request(*, headers: list[tuple[bytes, bytes]] | None = None, client=("10.0.0.9", 1234)) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": headers or [],
        "client": client,
    }
    return Request(scope)


def test_resolve_client_ip_prefere_x_forwarded_for() -> None:
    request = _request(
        headers=[(b"x-forwarded-for", b"187.22.1.9, 172.18.0.5")],
        client=("172.18.0.5", 5555),
    )
    assert resolve_client_ip(request) == "187.22.1.9"


def test_resolve_client_ip_usa_x_real_ip_quando_nao_ha_x_forwarded_for() -> None:
    request = _request(
        headers=[(b"x-real-ip", b"201.10.10.3")],
        client=("172.18.0.5", 5555),
    )
    assert resolve_client_ip(request) == "201.10.10.3"


def test_resolve_client_ip_faz_fallback_para_request_client() -> None:
    request = _request(client=("172.18.0.5", 5555))
    assert resolve_client_ip(request) == "172.18.0.5"