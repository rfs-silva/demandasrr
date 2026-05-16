"""Endpoints de anexos das solicitações."""

from __future__ import annotations

from urllib.parse import quote
from uuid import UUID

from fastapi import APIRouter, Depends, File, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.core.errors import AppError
from app.core.storage import stream_object
from app.db.session import get_session
from app.models.usuario import Usuario
from app.repositories import anexo_repo
from app.schemas.anexo import AnexoOut
from app.schemas.common import Envelope
from app.services import anexo_service

router = APIRouter(prefix="/solicitacoes/{solicitacao_id}/anexos", tags=["anexos"])


class _PayloadTooLarge(AppError):
    code = "ARQUIVO_MUITO_GRANDE"
    default_status = 413
    default_message = "Arquivo excede o tamanho máximo"


@router.get(
    "",
    response_model=Envelope[list[AnexoOut]],
    summary="Lista anexos da solicitação",
)
async def listar(
    solicitacao_id: UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[list[AnexoOut]]:
    # Reaproveita o gate de visualização da solicitação
    from app.services import solicitacao_service

    await solicitacao_service.obter(
        session, solicitacao_id=solicitacao_id, requester=usuario
    )
    rows = await anexo_repo.list_by_solicitacao(session, solicitacao_id)
    return Envelope(data=[AnexoOut.from_orm(r) for r in rows])


@router.post(
    "",
    response_model=Envelope[AnexoOut],
    status_code=status.HTTP_201_CREATED,
    summary="Faz upload de um arquivo (PDF, imagem, .docx, .xlsx — máx. 10 MB)",
)
async def upload(
    solicitacao_id: UUID,
    request: Request,
    arquivo: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> Envelope[AnexoOut]:
    settings = get_settings()

    # Lê com guarda de tamanho ANTES de qualquer validação
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await arquivo.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > settings.max_upload_bytes:
            raise _PayloadTooLarge(
                f"Tamanho máximo permitido: {settings.MAX_UPLOAD_MB} MB.",
                details={"max_bytes": settings.max_upload_bytes},
            )
        chunks.append(chunk)
    raw = b"".join(chunks)

    anexo = await anexo_service.upload(
        session,
        solicitacao_id=solicitacao_id,
        requester=usuario,
        filename=arquivo.filename or "arquivo",
        content_type=arquivo.content_type or "application/octet-stream",
        raw_bytes=raw,
        request=request,
    )
    return Envelope(data=AnexoOut.from_orm(anexo))


@router.delete(
    "/{anexo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove um anexo",
)
async def remover(
    solicitacao_id: UUID,  # noqa: ARG001 — capturado pela rota mas validamos via anexo_id
    anexo_id: UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> None:
    await anexo_service.remover(
        session, anexo_id=anexo_id, requester=usuario, request=request
    )


@router.get(
    "/{anexo_id}/download",
    summary="Stream do arquivo (inline para imagens/PDF; attachment para outros)",
)
async def download(
    solicitacao_id: UUID,  # noqa: ARG001
    anexo_id: UUID,
    session: AsyncSession = Depends(get_session),
    usuario: Usuario = Depends(get_current_user),
) -> StreamingResponse:
    anexo = await anexo_service.obter_para_download(
        session, anexo_id=anexo_id, requester=usuario
    )

    inline_mimes = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
    disposition = "inline" if anexo.content_type in inline_mimes else "attachment"
    # ASCII fallback sem aspas/backslash/controles. Tudo fora desse conjunto vira
    # underscore para impedir CRLF/quote-injection no header.
    ascii_safe = "".join(
        ch if 32 <= ord(ch) < 127 and ch not in '"\\' else "_"
        for ch in anexo.filename_original
    ) or "arquivo"
    encoded = quote(anexo.filename_original, safe="")
    cd = (
        f'{disposition}; filename="{ascii_safe}"; '
        f"filename*=UTF-8''{encoded}"
    )

    return StreamingResponse(
        stream_object(anexo.storage_key),
        media_type=anexo.content_type,
        headers={
            "Content-Disposition": cd,
            "Content-Length": str(anexo.tamanho_bytes),
        },
    )
