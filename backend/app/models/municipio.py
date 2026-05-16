"""Modelo Município (Roraima + 'Outros' para localidades não listadas)."""

from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPK


class Municipio(UUIDPK, TimestampMixin, Base):
    __tablename__ = "municipio"

    nome: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    # Quando True, o cadastro de Pessoa exige campo `localidade` (comunidade/vila/vicinal).
    eh_outros: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
