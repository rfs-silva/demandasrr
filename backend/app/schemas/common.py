"""Schemas comuns: envelopes de resposta padronizados."""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class Meta(BaseModel):
    page: int = 1
    page_size: int = 20
    total: int = 0


class Envelope(BaseModel, Generic[T]):
    data: T
    meta: Meta | None = None


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody = Field(...)
