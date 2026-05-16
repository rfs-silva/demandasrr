"""Dependências reutilizáveis: usuário autenticado e RBAC."""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, InactiveUserError, InvalidTokenError
from app.core.security import TokenError, decode_token
from app.db.session import get_session
from app.models.enums import PerfilUsuario, Situacao
from app.models.usuario import Usuario
from app.repositories import usuario_repo

# auto_error=False para podermos lançar nosso próprio erro padronizado.
_bearer = HTTPBearer(auto_error=False, bearerFormat="JWT")


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> Usuario:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise InvalidTokenError("Authorization Bearer ausente")

    try:
        payload = decode_token(credentials.credentials, expected_type="access")
        usuario_id = UUID(payload["sub"])
    except (TokenError, KeyError, ValueError) as exc:
        raise InvalidTokenError(str(exc) or "token inválido") from exc

    usuario = await usuario_repo.get_by_id(session, usuario_id)
    if usuario is None:
        raise InvalidTokenError("usuário não encontrado")
    if usuario.situacao != Situacao.ativo:
        raise InactiveUserError()

    # Anexa info ao request para logs subsequentes.
    request.state.usuario_id = str(usuario.id)
    request.state.perfil = usuario.perfil.value
    return usuario


def require_role(
    *roles: PerfilUsuario | str,
) -> Callable[[Usuario], Usuario]:
    """Cria uma dependência que valida o perfil do usuário autenticado."""
    allowed: set[str] = {r.value if isinstance(r, PerfilUsuario) else r for r in roles}

    async def _checker(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if usuario.perfil.value not in allowed:
            raise ForbiddenError(
                "perfil insuficiente para esta operação",
                details={"required": sorted(allowed), "current": usuario.perfil.value},
            )
        return usuario

    return _checker
