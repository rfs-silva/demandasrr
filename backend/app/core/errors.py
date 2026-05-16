"""Exceções HTTP de domínio com payload padronizado.

Formato de resposta (definido em ``schemas.common.ErrorBody``):

    { "error": { "code": "XYZ", "message": "..." } }
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status


class AppError(HTTPException):
    code: str = "ERROR"
    default_status: int = status.HTTP_400_BAD_REQUEST
    default_message: str = "Erro"

    def __init__(
        self,
        message: str | None = None,
        *,
        status_code: int | None = None,
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(
            status_code=status_code or self.default_status,
            detail={
                "code": self.code,
                "message": message or self.default_message,
                "details": details,
            },
            headers=headers,
        )


class InvalidCredentialsError(AppError):
    code = "INVALID_CREDENTIALS"
    default_status = status.HTTP_401_UNAUTHORIZED
    default_message = "Credenciais inválidas"


class InactiveUserError(AppError):
    code = "INACTIVE_USER"
    default_status = status.HTTP_403_FORBIDDEN
    default_message = "Usuário inativo"


class InvalidTokenError(AppError):
    code = "INVALID_TOKEN"
    default_status = status.HTTP_401_UNAUTHORIZED
    default_message = "Token inválido ou expirado"


class ForbiddenError(AppError):
    code = "FORBIDDEN"
    default_status = status.HTTP_403_FORBIDDEN
    default_message = "Permissão negada"


class ConflictError(AppError):
    code = "CONFLICT"
    default_status = status.HTTP_409_CONFLICT
    default_message = "Conflito"


class CpfDuplicadoError(ConflictError):
    code = "CPF_DUPLICADO"
    default_message = "CPF já cadastrado"


class NotFoundError(AppError):
    code = "NOT_FOUND"
    default_status = status.HTTP_404_NOT_FOUND
    default_message = "Não encontrado"


class TooManyAttemptsError(AppError):
    code = "TOO_MANY_ATTEMPTS"
    default_status = status.HTTP_429_TOO_MANY_REQUESTS
    default_message = "Muitas tentativas. Tente novamente em alguns minutos."
