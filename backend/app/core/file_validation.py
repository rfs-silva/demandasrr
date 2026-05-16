"""Validação de uploads: extensão, MIME, tamanho e magic bytes.

Não depende de libmagic; faz checagem por assinaturas conhecidas para os
tipos que aceitamos. O objetivo é evitar uploads maliciosos disfarçados
(`malicia.exe.pdf`) e arquivos com MIME incoerente.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass

from app.core.errors import AppError


class ArquivoInvalidoError(AppError):
    code = "ARQUIVO_INVALIDO"
    default_status = 415
    default_message = "Tipo de arquivo não suportado"


class ArquivoMuitoGrandeError(AppError):
    code = "ARQUIVO_MUITO_GRANDE"
    default_status = 413
    default_message = "Arquivo excede o tamanho máximo"


@dataclass(frozen=True)
class TipoArquivo:
    extensao: str
    mime: str
    descricao: str


# Tipos aceitos para anexos de solicitação.
ALLOWED_TYPES: tuple[TipoArquivo, ...] = (
    TipoArquivo(".pdf", "application/pdf", "PDF"),
    TipoArquivo(".jpg", "image/jpeg", "Imagem JPEG"),
    TipoArquivo(".jpeg", "image/jpeg", "Imagem JPEG"),
    TipoArquivo(".png", "image/png", "Imagem PNG"),
    TipoArquivo(".webp", "image/webp", "Imagem WebP"),
    TipoArquivo(".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word (.docx)"),
    TipoArquivo(".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Excel (.xlsx)"),
)

ALLOWED_EXTENSIONS = {t.extensao for t in ALLOWED_TYPES}
ALLOWED_MIMES = {t.mime for t in ALLOWED_TYPES}

_FILENAME_SAFE = re.compile(r"[^A-Za-z0-9._\-\s]+")


def sanitize_filename(name: str) -> str:
    """Remove caracteres perigosos e limita o tamanho do nome."""
    base = os.path.basename(name or "").strip()
    base = _FILENAME_SAFE.sub("_", base)
    # garante extensão no final
    if len(base) > 200:
        base = base[-200:]
    return base or "arquivo"


def detect_kind_from_bytes(head: bytes) -> str | None:
    """Detecta o MIME a partir dos primeiros bytes. Retorna None se desconhecido."""
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    # Office .docx/.xlsx são ZIPs (PK\x03\x04). Não distinguimos sem mais bytes;
    # validação fica por extensão + MIME declarado.
    if head[:4] == b"PK\x03\x04":
        return "application/zip"
    return None


def validate_upload(
    *,
    filename: str,
    content_type: str,
    size_bytes: int,
    head: bytes,
    max_bytes: int,
) -> TipoArquivo:
    """Valida o upload. Retorna o tipo casado ou lança erro de domínio."""
    if size_bytes <= 0:
        raise ArquivoInvalidoError("Arquivo vazio.")
    if size_bytes > max_bytes:
        raise ArquivoMuitoGrandeError(
            f"Tamanho máximo permitido: {max_bytes // (1024 * 1024)} MB.",
            details={"max_bytes": max_bytes, "size_bytes": size_bytes},
        )

    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ArquivoInvalidoError(
            f"Extensão '{ext or '?'}' não suportada.",
            details={"permitidas": sorted(ALLOWED_EXTENSIONS)},
        )

    declared_mime = (content_type or "").lower().split(";")[0].strip()
    if declared_mime not in ALLOWED_MIMES:
        raise ArquivoInvalidoError(
            f"Tipo MIME '{declared_mime or '?'}' não suportado.",
            details={"permitidos": sorted(ALLOWED_MIMES)},
        )

    detected = detect_kind_from_bytes(head)
    # Para imagens e PDF, exigimos coerência com magic bytes.
    if declared_mime in {"application/pdf", "image/jpeg", "image/png", "image/webp"}:
        if detected != declared_mime:
            raise ArquivoInvalidoError(
                "Conteúdo do arquivo não bate com o tipo declarado.",
                details={"declarado": declared_mime, "detectado": detected},
            )
    # Para office, ao menos ser um ZIP é esperado.
    if declared_mime in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }:
        if detected != "application/zip":
            raise ArquivoInvalidoError(
                "Conteúdo do arquivo Office inválido.",
                details={"declarado": declared_mime, "detectado": detected},
            )

    # Retorna o tipo casado (preferindo a extensão como fonte de verdade)
    for t in ALLOWED_TYPES:
        if t.extensao == ext and t.mime == declared_mime:
            return t
    # Caso a combinação extensão+mime não exista exatamente, retorna pela mime.
    for t in ALLOWED_TYPES:
        if t.mime == declared_mime:
            return t
    raise ArquivoInvalidoError("Combinação de extensão e MIME não suportada.")
