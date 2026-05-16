"""Roteador agregado da API v1."""

from fastapi import APIRouter

from app.api.v1 import (
    anexos,
    auditoria,
    auth,
    health,
    municipios,
    pessoas,
    solicitacoes,
    usuarios,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router)
api_router.include_router(municipios.router)
api_router.include_router(pessoas.router)
api_router.include_router(solicitacoes.router)
api_router.include_router(anexos.router)
api_router.include_router(usuarios.router)
api_router.include_router(auditoria.router)
