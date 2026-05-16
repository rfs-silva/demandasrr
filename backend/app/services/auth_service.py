"""Casos de uso de autenticação."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import (
    InactiveUserError,
    InvalidCredentialsError,
    InvalidTokenError,
    TooManyAttemptsError,
)
from app.core.logging import get_logger
from app.core.security import (
    TokenError,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models.enums import AcaoAudit, EntidadeAudit, Situacao
from app.models.usuario import Usuario
from app.repositories import refresh_token_repo, usuario_repo
from app.services import audit_service

log = get_logger("auth")


def _normalize_login(raw: str) -> str:
    """Aceita CPF com ou sem máscara. Se ficar com 11 dígitos, retorna só dígitos;
    caso contrário, retorna a entrada com strip — para suportar logins não-CPF como `admin`.
    """
    from app.core.cpf import somente_digitos

    raw = (raw or "").strip()
    digits = somente_digitos(raw)
    if len(digits) == 11:
        return digits
    return raw


async def authenticate(
    session: AsyncSession,
    *,
    login: str,
    senha: str,
    user_agent: str | None = None,
    ip: str | None = None,
    request=None,
) -> tuple[Usuario, str, str, int]:
    """Valida credenciais e emite par (access, refresh).

    Retorna ``(usuario, access, refresh, expires_in_seconds)``.
    """
    settings = get_settings()
    login_norm = _normalize_login(login)

    # Lockout por IP — complementa o slowapi para frear brute-force lento.
    # Conta `login_falhou` registrado em audit_log na janela configurada.
    if ip:
        falhas = await audit_service.contar_falhas_login_recentes(
            session,
            ip=ip,
            minutos=settings.LOGIN_LOCKOUT_WINDOW_MIN,
        )
        if falhas >= settings.LOGIN_LOCKOUT_THRESHOLD:
            log.warning(
                "auth.login.locked",
                ip=ip,
                falhas=falhas,
                janela_min=settings.LOGIN_LOCKOUT_WINDOW_MIN,
            )
            raise TooManyAttemptsError(
                f"Muitas tentativas a partir do seu IP. "
                f"Aguarde {settings.LOGIN_LOCKOUT_WINDOW_MIN} minutos e tente novamente.",
                headers={"Retry-After": str(settings.LOGIN_LOCKOUT_WINDOW_MIN * 60)},
            )

    usuario = await usuario_repo.get_by_login(session, login_norm)
    if usuario is None or not verify_password(senha, usuario.senha_hash):
        log.info("auth.login.failed", login=login_norm, ip=ip)
        # Em paralelo, registra a tentativa em sessão dedicada (a sessão atual
        # vai estourar exceção e dar rollback).
        try:
            await audit_service.log_em_nova_sessao(
                acao=AcaoAudit.login_falhou,
                entidade=EntidadeAudit.sistema,
                actor=None,
                entidade_label=login_norm,
                detalhes={"login_tentado": login_norm},
                request=request,
            )
        except Exception:  # pragma: no cover
            log.exception("audit.login_falhou.persist_failed")
        raise InvalidCredentialsError()

    if usuario.situacao != Situacao.ativo:
        log.info("auth.login.inactive", login=login, ip=ip)
        raise InactiveUserError()

    refresh_row = await refresh_token_repo.create(
        session,
        usuario_id=usuario.id,
        expires_at=_refresh_expires_at(),
        user_agent=user_agent,
        ip=ip,
    )

    access_token, access_exp = create_access_token(
        subject=usuario.id, perfil=usuario.perfil.value
    )
    refresh_token, _ = create_refresh_token(subject=usuario.id, jti=refresh_row.id)

    await usuario_repo.touch_last_login(session, usuario)
    await audit_service.log_event(
        session,
        acao=AcaoAudit.login_sucesso,
        entidade=EntidadeAudit.usuario,
        actor=usuario,
        entidade_id=usuario.id,
        entidade_label=usuario.nome,
        request=request,
    )
    await session.commit()

    log.info("auth.login.ok", login=usuario.login, usuario_id=str(usuario.id), ip=ip)
    return (
        usuario,
        access_token,
        refresh_token,
        settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def refresh(
    session: AsyncSession,
    *,
    refresh_token: str,
    user_agent: str | None = None,
    ip: str | None = None,
) -> tuple[str, str, int]:
    """Rotaciona o refresh token: revoga o atual, emite novo par."""
    settings = get_settings()
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except TokenError as exc:
        raise InvalidTokenError(str(exc)) from exc

    try:
        jti = UUID(payload["jti"])
        usuario_id = UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise InvalidTokenError("claims do token malformadas") from exc

    row = await refresh_token_repo.get(session, jti)
    if row is None or not refresh_token_repo.is_active(row):
        raise InvalidTokenError("refresh token revogado ou expirado")
    if row.usuario_id != usuario_id:
        raise InvalidTokenError("token não corresponde ao usuário")

    usuario = await usuario_repo.get_by_id(session, usuario_id)
    if usuario is None or usuario.situacao != Situacao.ativo:
        raise InvalidTokenError("usuário inválido")

    # Revoga o antigo e emite um novo (rotação)
    await refresh_token_repo.revoke(session, row)
    new_row = await refresh_token_repo.create(
        session,
        usuario_id=usuario.id,
        expires_at=_refresh_expires_at(),
        user_agent=user_agent,
        ip=ip,
    )
    new_access, _ = create_access_token(subject=usuario.id, perfil=usuario.perfil.value)
    new_refresh, _ = create_refresh_token(subject=usuario.id, jti=new_row.id)

    await session.commit()
    log.info(
        "auth.refresh.ok",
        usuario_id=str(usuario.id),
        ip=ip,
        old_jti=str(jti),
        new_jti=str(new_row.id),
    )
    return new_access, new_refresh, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


async def logout(
    session: AsyncSession,
    *,
    refresh_token: str,
    request=None,
) -> None:
    """Revoga o refresh token atual. Idempotente."""
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
        jti = UUID(payload["jti"])
    except (TokenError, KeyError, ValueError):
        # logout silencioso: token malformado já é como se não existisse
        return

    row = await refresh_token_repo.get(session, jti)
    if row is not None:
        usuario = await usuario_repo.get_by_id(session, row.usuario_id)
        await refresh_token_repo.revoke(session, row)
        await audit_service.log_event(
            session,
            acao=AcaoAudit.logout,
            entidade=EntidadeAudit.usuario,
            actor=usuario,
            entidade_id=row.usuario_id,
            entidade_label=usuario.nome if usuario else None,
            request=request,
        )
        await session.commit()
        log.info("auth.logout.ok", usuario_id=str(row.usuario_id), jti=str(jti))


def _refresh_expires_at() -> datetime:
    settings = get_settings()
    return datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
