"""Entrypoint FastAPI."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1 import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.rate_limit import limiter
from app.core.request_guard import inspect_request_target
from app.core.storage import ensure_bucket

configure_logging()
log = get_logger("app")


@asynccontextmanager
async def lifespan(_: FastAPI) -> Any:
    settings = get_settings()
    log.info("app.startup", env=settings.APP_ENV, name=settings.APP_NAME)
    try:
        await ensure_bucket()
    except Exception as exc:  # noqa: BLE001 — log but don't crash app
        log.warning("storage.bucket_init_falhou", error=str(exc))
    yield
    log.info("app.shutdown")


def _error_payload(code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details is not None:
        body["error"]["details"] = details
    return body


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # --- Rate limiter ---
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    # --- CORS ---
    # Em produção, mantemos lista vazia se nada foi configurado: a app vive
    # atrás do nginx no mesmo domínio (mesma-origem) e não precisa abrir CORS.
    # Em dev (sem o reverse proxy), abrimos para o Vite local explicitamente.
    cors_origins = settings.BACKEND_CORS_ORIGINS
    if not cors_origins and settings.APP_ENV != "production":
        cors_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_target_guard(request: Request, call_next):
        blocked = inspect_request_target(
            request.url.path,
            request.url.query,
        )
        if blocked is not None:
            return JSONResponse(
                status_code=blocked.status_code,
                content=_error_payload(blocked.code, blocked.message),
            )
        return await call_next(request)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    # ---------- Exception handlers padronizados ----------

    @app.exception_handler(HTTPException)
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail and "message" in detail:
            payload = _error_payload(
                detail["code"], detail["message"], detail.get("details")
            )
        elif exc.status_code == 404:
            payload = _error_payload("NOT_FOUND", "Rota nao encontrada.")
        else:
            payload = _error_payload("HTTP_ERROR", str(detail))
        return JSONResponse(status_code=exc.status_code, content=payload, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_payload("VALIDATION_ERROR", "Dados inválidos", exc.errors()),
        )

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(_: Request, exc: RateLimitExceeded) -> JSONResponse:
        return JSONResponse(
            status_code=429,
            content=_error_payload(
                "RATE_LIMITED",
                f"Limite de requisições excedido: {exc.detail}",
            ),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, _: Exception) -> JSONResponse:
        log.exception("unhandled_error", path=request.url.path)
        return JSONResponse(
            status_code=500,
            content=_error_payload(
                "INTERNAL_ERROR",
                "Ocorreu um problema interno. Tente novamente em instantes.",
            ),
        )

    return app


app = create_app()
