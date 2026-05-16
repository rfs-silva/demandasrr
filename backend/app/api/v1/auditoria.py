"""Endpoint do painel de auditoria. Restrito a administradores."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.core.errors import ForbiddenError
from app.db.session import get_session
from app.models.enums import AcaoAudit, EntidadeAudit, PerfilUsuario
from app.models.usuario import Usuario
from app.schemas.audit import AuditLogOut
from app.schemas.common import Envelope, Meta
from app.services import audit_service


def _so_admin(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    if usuario.perfil != PerfilUsuario.administrador:
        raise ForbiddenError("Apenas administradores podem acessar a auditoria.")
    return usuario


router = APIRouter(
    prefix="/auditoria",
    tags=["auditoria"],
    dependencies=[Depends(_so_admin)],
)


@router.get(
    "",
    response_model=Envelope[list[AuditLogOut]],
    summary="Lista eventos de auditoria (ordem: mais recentes primeiro)",
)
async def listar(
    session: AsyncSession = Depends(get_session),
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    acao: AcaoAudit | None = Query(None),
    entidade: EntidadeAudit | None = Query(None),
    actor_id: UUID | None = Query(None),
    entidade_id: UUID | None = Query(None),
    search: str | None = Query(None, max_length=200),
) -> Envelope[list[AuditLogOut]]:
    rows, total = await audit_service.listar(
        session,
        page=page,
        page_size=page_size,
        acao=acao,
        entidade=entidade,
        actor_id=actor_id,
        entidade_id=entidade_id,
        search=search,
    )
    return Envelope(
        data=[AuditLogOut.model_validate(r) for r in rows],
        meta=Meta(page=page, page_size=page_size, total=total),
    )
