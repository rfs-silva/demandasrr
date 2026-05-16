"""Endpoints de autenticação."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import resolve_client_ip
from app.core.config import get_settings
from app.core.errors import InvalidTokenError
from app.core.deps import get_current_user
from app.core.rate_limit import limiter, login_rate_limit
from app.db.session import get_session
from app.models.usuario import Usuario
from app.schemas.auth import LoginIn, MeOut, MeUpdate, RefreshIn, TokenOut
from app.schemas.common import Envelope
from app.schemas.usuario import MinhaSenhaUpdate
from app.services import auth_service, usuario_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_meta(request: Request) -> tuple[str | None, str | None]:
    ua = request.headers.get("user-agent")
    ip = resolve_client_ip(request)
    return ua, ip


def _refresh_cookie_path() -> str:
    settings = get_settings()
    return f"{settings.API_V1_PREFIX}/auth"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=settings.refresh_cookie_secure,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=_refresh_cookie_path(),
        domain=settings.REFRESH_COOKIE_DOMAIN,
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path=_refresh_cookie_path(),
        domain=settings.REFRESH_COOKIE_DOMAIN,
        secure=settings.refresh_cookie_secure,
        httponly=True,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


def _disable_auth_cache(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    response.headers["Vary"] = "Cookie"


def _resolve_refresh_token(request: Request, body: RefreshIn | None) -> str:
    settings = get_settings()
    cookie_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if body is not None:
        return body.refresh_token
    raise InvalidTokenError("refresh token ausente")


@router.post(
    "/login",
    response_model=Envelope[TokenOut],
    summary="Autentica e devolve access token; refresh fica em cookie HttpOnly",
)
@limiter.limit(login_rate_limit())
async def login(
    request: Request,
    response: Response,
    body: LoginIn,
    session: AsyncSession = Depends(get_session),
) -> Envelope[TokenOut]:
    ua, ip = _client_meta(request)
    _, access, refresh, expires_in = await auth_service.authenticate(
        session,
        login=body.login,
        senha=body.senha,
        user_agent=ua,
        ip=ip,
        request=request,
    )
    _set_refresh_cookie(response, refresh)
    _disable_auth_cache(response)
    return Envelope(data=TokenOut(access_token=access, expires_in=expires_in))


@router.post(
    "/refresh",
    response_model=Envelope[TokenOut],
    summary="Rotaciona o refresh token em cookie e emite novo access",
)
async def refresh(
    request: Request,
    response: Response,
    body: RefreshIn | None = None,
    session: AsyncSession = Depends(get_session),
) -> Envelope[TokenOut]:
    ua, ip = _client_meta(request)
    access, refresh_token, expires_in = await auth_service.refresh(
        session,
        refresh_token=_resolve_refresh_token(request, body),
        user_agent=ua,
        ip=ip,
    )
    _set_refresh_cookie(response, refresh_token)
    _disable_auth_cache(response)
    return Envelope(data=TokenOut(access_token=access, expires_in=expires_in))


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoga o refresh token atual e limpa o cookie",
)
async def logout(
    request: Request,
    response: Response,
    body: RefreshIn | None = None,
    session: AsyncSession = Depends(get_session),
) -> None:
    settings = get_settings()
    refresh_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    if not refresh_token and body is not None:
        refresh_token = body.refresh_token
    if refresh_token:
        await auth_service.logout(session, refresh_token=refresh_token, request=request)
    _clear_refresh_cookie(response)
    _disable_auth_cache(response)


@router.get(
    "/me",
    response_model=Envelope[MeOut],
    summary="Dados do usuário autenticado",
)
async def me(usuario: Usuario = Depends(get_current_user)) -> Envelope[MeOut]:
    return Envelope(
        data=MeOut(
            id=usuario.id,
            nome=usuario.nome,
            login=usuario.login,
            perfil=usuario.perfil.value,
            contato=usuario.contato,
            must_change_password=usuario.must_change_password,
            eh_root=usuario.eh_root,
            pode_criar_usuarios=usuario.pode_criar_usuarios,
            pode_criar_solicitacoes=usuario.pode_criar_solicitacoes,
            pode_reabrir_solicitacoes=usuario.pode_reabrir_solicitacoes,
            ver_status_solicitacao=usuario.ver_status_solicitacao,
            pessoa_id=usuario.pessoa_id,
        )
    )


@router.patch(
    "/me",
    response_model=Envelope[MeOut],
    summary="Edita os próprios dados (nome, município, contato, data de nascimento)",
)
async def atualizar_meu_perfil(
    request: Request,
    body: MeUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[MeOut]:
    refreshed = await usuario_service.atualizar_proprio(
        session,
        requester=usuario,
        nome=body.nome,
        municipio_id=body.municipio_id,
        localidade=body.localidade,
        contato=body.contato,
        data_nascimento=body.data_nascimento,
        request=request,
    )
    return Envelope(
        data=MeOut(
            id=refreshed.id,
            nome=refreshed.nome,
            login=refreshed.login,
            perfil=refreshed.perfil.value,
            contato=refreshed.contato,
            must_change_password=refreshed.must_change_password,
            eh_root=refreshed.eh_root,
            pode_criar_usuarios=refreshed.pode_criar_usuarios,
            pode_criar_solicitacoes=refreshed.pode_criar_solicitacoes,
            pode_reabrir_solicitacoes=refreshed.pode_reabrir_solicitacoes,
            ver_status_solicitacao=refreshed.ver_status_solicitacao,
            pessoa_id=refreshed.pessoa_id,
        )
    )


@router.patch(
    "/me/senha",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Troca a própria senha (limpa must_change_password)",
)
async def trocar_minha_senha(
    request: Request,
    body: MinhaSenhaUpdate,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> None:
    await usuario_service.alterar_propria_senha(
        session, requester=usuario, body=body, request=request
    )
