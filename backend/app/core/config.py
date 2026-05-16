"""Configurações da aplicação carregadas a partir do ambiente."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Defaults que NUNCA podem chegar em produção — a app falha no startup.
_INSECURE_JWT_DEFAULTS = frozenset({"dev-only-change-me-please-32chars-min"})
_INSECURE_ADMIN_PASSWORDS = frozenset({"ChangeMe!123"})
_INSECURE_MINIO_PASSWORDS = frozenset({"demandas_minio_change_me_32chars"})


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- App ----
    APP_NAME: str = "Demandas RR"
    APP_ENV: Literal["development", "production", "test"] = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_PREFIX: str = "/api/v1"

    # ---- DB ----
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://demandas:demandas@db:5432/demandasrr",
        description="URL SQLAlchemy assíncrona (asyncpg)",
    )

    # ---- JWT ----
    JWT_SECRET_KEY: str = Field(default="dev-only-change-me-please-32chars-min")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_COOKIE_NAME: str = "demandasrr_refresh"
    REFRESH_COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    REFRESH_COOKIE_DOMAIN: str | None = None

    # ---- Segurança ----
    # NoDecode evita o JSON-parse automático do pydantic-settings: o validator
    # abaixo faz split por vírgula da string vinda do ambiente.
    BACKEND_CORS_ORIGINS: Annotated[list[str], NoDecode] = Field(default_factory=list)
    LOGIN_RATE_LIMIT: str = "5/minute"
    # Lockout adicional ao rate-limit: bloqueia o IP após N falhas em X minutos.
    # Complementa o slowapi (que é por minuto) para deter brute-force lento.
    LOGIN_LOCKOUT_THRESHOLD: int = 10
    LOGIN_LOCKOUT_WINDOW_MIN: int = 15

    # ---- Seed ----
    ADMIN_NOME: str = "Administrador"
    ADMIN_LOGIN: str = "admin"
    ADMIN_PASSWORD: str = "ChangeMe!123"
    SEED_TEST_USERS: bool = False

    # ---- Storage (MinIO / S3-compatible) ----
    STORAGE_ENDPOINT: str = "http://minio:9000"
    STORAGE_BUCKET: str = "solicitacoes-anexos"
    STORAGE_REGION: str = "us-east-1"
    MINIO_ROOT_USER: str = "demandas_minio"
    MINIO_ROOT_PASSWORD: str = "demandas_minio_change_me_32chars"
    MAX_UPLOAD_MB: int = 10
    MAX_ANEXOS_POR_SOLICITACAO: int = 20

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    @property
    def refresh_cookie_secure(self) -> bool:
        return self.APP_ENV == "production"

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def split_cors(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("REFRESH_COOKIE_DOMAIN", mode="before")
    @classmethod
    def normalize_cookie_domain(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def validate_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET_KEY deve ter no mínimo 32 caracteres")
        return v

    @model_validator(mode="after")
    def _proibir_defaults_em_producao(self) -> "Settings":
        if self.APP_ENV != "production":
            return self
        if self.JWT_SECRET_KEY in _INSECURE_JWT_DEFAULTS:
            raise ValueError("JWT_SECRET_KEY ainda é o valor padrão — gere um novo segredo antes de subir em produção.")
        if self.ADMIN_PASSWORD in _INSECURE_ADMIN_PASSWORDS:
            raise ValueError("ADMIN_PASSWORD ainda é o valor padrão — defina uma senha forte para o admin root.")
        if self.MINIO_ROOT_PASSWORD in _INSECURE_MINIO_PASSWORDS:
            raise ValueError("MINIO_ROOT_PASSWORD ainda é o valor padrão — gere uma senha forte para o MinIO.")
        if not self.BACKEND_CORS_ORIGINS:
            # Em produção a app vive atrás do nginx no mesmo domínio, mas garantir
            # uma lista explícita evita configurações ambíguas.
            raise ValueError(
                "BACKEND_CORS_ORIGINS é obrigatório em produção (informe a origem pública, ex.: https://demandasrr.sistemasme.com)."
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
