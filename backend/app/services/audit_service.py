"""Serviço de auditoria — registra ações sensíveis em ``audit_log``.

Pensado para ser chamado dentro da mesma transação que a ação principal:
a função apenas faz ``session.add``/``flush``; o commit fica com o caller.

Para eventos sem transação aberta (ex.: login falhou), há ``log_em_nova_sessao``,
que abre uma sessão dedicada e comita imediatamente.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import Request
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.client_ip import resolve_client_ip
from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.audit_log import AuditLog
from app.models.enums import AcaoAudit, EntidadeAudit
from app.models.usuario import Usuario

log = get_logger("audit")


def _request_info(request: Request | None) -> tuple[str | None, str | None]:
    if request is None:
        return None, None
    ip = resolve_client_ip(request)
    ua = request.headers.get("user-agent")
    return ip, ua[:500] if ua else None


def _actor_snapshot(actor: Usuario | None) -> dict[str, Any]:
    if actor is None:
        return {
            "actor_id": None,
            "actor_login": None,
            "actor_nome": None,
            "actor_perfil": None,
        }
    return {
        "actor_id": actor.id,
        "actor_login": actor.login,
        "actor_nome": actor.nome,
        "actor_perfil": actor.perfil.value if hasattr(actor.perfil, "value") else str(actor.perfil),
    }


async def log_event(
    session: AsyncSession,
    *,
    acao: AcaoAudit,
    entidade: EntidadeAudit,
    actor: Usuario | None,
    entidade_id: UUID | None = None,
    entidade_label: str | None = None,
    detalhes: dict[str, Any] | None = None,
    request: Request | None = None,
) -> AuditLog:
    """Registra um evento de auditoria na sessão atual (sem commit)."""
    ip, ua = _request_info(request)
    evento = AuditLog(
        acao=acao,
        entidade=entidade,
        entidade_id=entidade_id,
        entidade_label=(entidade_label or None),
        detalhes=detalhes or None,
        ip=ip,
        user_agent=ua,
        **_actor_snapshot(actor),
    )
    session.add(evento)
    try:
        await session.flush()
    except Exception:  # pragma: no cover — defensivo
        log.exception("audit.flush_failed", acao=acao.value)
        raise
    return evento


async def log_em_nova_sessao(
    *,
    acao: AcaoAudit,
    entidade: EntidadeAudit,
    actor: Usuario | None,
    entidade_id: UUID | None = None,
    entidade_label: str | None = None,
    detalhes: dict[str, Any] | None = None,
    request: Request | None = None,
) -> None:
    """Abre uma sessão dedicada para logar e comita.

    Útil em pontos sem transação ativa (ex.: tentativa de login que falhou
    antes do request entrar no handler com session)."""
    async with SessionLocal() as session:
        await log_event(
            session,
            acao=acao,
            entidade=entidade,
            actor=actor,
            entidade_id=entidade_id,
            entidade_label=entidade_label,
            detalhes=detalhes,
            request=request,
        )
        await session.commit()


async def contar_falhas_login_recentes(
    session: AsyncSession,
    *,
    ip: str,
    minutos: int,
) -> int:
    """Conta `login_falhou` desse IP nos últimos N minutos. Base do lockout."""
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import func, select

    desde = datetime.now(timezone.utc) - timedelta(minutes=minutos)
    stmt = (
        select(func.count())
        .select_from(AuditLog)
        .where(
            AuditLog.acao == AcaoAudit.login_falhou,
            AuditLog.ip == ip,
            AuditLog.created_at >= desde,
        )
    )
    return int((await session.execute(stmt)).scalar_one())


async def listar(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    acao: AcaoAudit | None = None,
    entidade: EntidadeAudit | None = None,
    actor_id: UUID | None = None,
    entidade_id: UUID | None = None,
    search: str | None = None,
) -> tuple[list[AuditLog], int]:
    """Lista paginada de eventos, ordem mais recente primeiro."""
    from sqlalchemy import func, or_

    base = select(AuditLog).options(selectinload(AuditLog.actor))
    count_base = select(func.count()).select_from(AuditLog)

    if acao is not None:
        base = base.where(AuditLog.acao == acao)
        count_base = count_base.where(AuditLog.acao == acao)
    if entidade is not None:
        base = base.where(AuditLog.entidade == entidade)
        count_base = count_base.where(AuditLog.entidade == entidade)
    if actor_id is not None:
        base = base.where(AuditLog.actor_id == actor_id)
        count_base = count_base.where(AuditLog.actor_id == actor_id)
    if entidade_id is not None:
        base = base.where(AuditLog.entidade_id == entidade_id)
        count_base = count_base.where(AuditLog.entidade_id == entidade_id)
    if search:
        like = f"%{search.lower()}%"
        cond = or_(
            func.lower(AuditLog.actor_login).like(like),
            func.lower(AuditLog.actor_nome).like(like),
            func.lower(AuditLog.entidade_label).like(like),
        )
        base = base.where(cond)
        count_base = count_base.where(cond)

    total = (await session.execute(count_base)).scalar_one()

    stmt = (
        base.order_by(desc(AuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await session.execute(stmt)).scalars().all()
    return list(rows), int(total)
