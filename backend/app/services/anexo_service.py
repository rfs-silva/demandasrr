"""Casos de uso de anexos de solicitação."""

from __future__ import annotations

import io
import os
from uuid import UUID, uuid4

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, ForbiddenError, NotFoundError
from app.core.file_validation import (
    ArquivoMuitoGrandeError,
    sanitize_filename,
    validate_upload,
)
from app.core.logging import get_logger
from app.core.storage import delete_object, put_object
from app.models.enums import (
    AcaoAudit,
    EntidadeAudit,
    PerfilUsuario,
    TipoEventoSolicitacao,
)
from app.models.solicitacao_anexo import SolicitacaoAnexo
from app.models.solicitacao_evento import SolicitacaoEvento
from app.models.usuario import Usuario
from app.repositories import anexo_repo, solicitacao_repo
from app.services import audit_service

log = get_logger("anexo")


class LimiteAnexosError(AppError):
    code = "LIMITE_ANEXOS_ATINGIDO"
    default_status = 409
    default_message = "Limite de anexos para esta solicitação foi atingido"


async def upload(
    session: AsyncSession,
    *,
    solicitacao_id: UUID,
    requester: Usuario,
    filename: str,
    content_type: str,
    raw_bytes: bytes,
    request: Request | None = None,
) -> SolicitacaoAnexo:
    settings = get_settings()

    solicitacao = await solicitacao_repo.get_by_id(session, solicitacao_id)
    if solicitacao is None:
        raise NotFoundError("Solicitação não encontrada")
    # Governador é read-only.
    if requester.perfil == PerfilUsuario.governador:
        raise ForbiddenError("Governador não pode anexar arquivos.")
    # Gestor solicitante só anexa nas próprias.
    if (
        requester.perfil == PerfilUsuario.gestor_solicitante
        and solicitacao.usuario_id != requester.id
    ):
        raise ForbiddenError("Sem permissão para anexar a esta solicitação")

    count = await anexo_repo.count_by_solicitacao(session, solicitacao_id)
    if count >= settings.MAX_ANEXOS_POR_SOLICITACAO:
        raise LimiteAnexosError(
            f"Máximo de {settings.MAX_ANEXOS_POR_SOLICITACAO} anexos por solicitação.",
            details={"limite": settings.MAX_ANEXOS_POR_SOLICITACAO},
        )

    size = len(raw_bytes)
    if size > settings.max_upload_bytes:
        raise ArquivoMuitoGrandeError(
            f"Tamanho máximo permitido: {settings.MAX_UPLOAD_MB} MB.",
            details={"max_bytes": settings.max_upload_bytes, "size_bytes": size},
        )

    safe_name = sanitize_filename(filename)
    tipo = validate_upload(
        filename=safe_name,
        content_type=content_type,
        size_bytes=size,
        head=raw_bytes[:32],
        max_bytes=settings.max_upload_bytes,
    )

    anexo_id = uuid4()
    ext = os.path.splitext(safe_name)[1].lower() or tipo.extensao
    storage_key = f"solicitacoes/{solicitacao_id}/{anexo_id}{ext}"

    # Sobe ao MinIO/S3 antes de persistir o registro — se falhar, nada vaza para o banco.
    await put_object(
        storage_key,
        io.BytesIO(raw_bytes),
        content_type=tipo.mime,
        content_length=size,
    )

    anexo = SolicitacaoAnexo(
        id=anexo_id,
        solicitacao_id=solicitacao_id,
        usuario_id=requester.id,
        filename_original=safe_name,
        content_type=tipo.mime,
        tamanho_bytes=size,
        storage_key=storage_key,
    )
    try:
        await anexo_repo.add(session, anexo)
        # Registra evento interno na timeline — equipe interna (suporte,
        # governador, admin) enxerga o andamento; o solicitante não.
        session.add(
            SolicitacaoEvento(
                solicitacao_id=solicitacao_id,
                usuario_id=requester.id,
                tipo=TipoEventoSolicitacao.anexo_adicionado,
                de_status=None,
                para_status=None,
                comentario=safe_name,
                interno=True,
            )
        )
        await audit_service.log_event(
            session,
            acao=AcaoAudit.anexo_upload,
            entidade=EntidadeAudit.anexo,
            actor=requester,
            entidade_id=anexo.id,
            entidade_label=safe_name,
            detalhes={
                "solicitacao_id": str(solicitacao_id),
                "mime": tipo.mime,
                "size": size,
            },
            request=request,
        )
        await session.commit()
    except Exception:
        # rollback do storage — best-effort
        await session.rollback()
        await delete_object(storage_key)
        raise

    # recarrega com usuario
    refreshed = await anexo_repo.get(session, anexo.id)
    log.info(
        "anexo.upload",
        anexo_id=str(anexo.id),
        solicitacao_id=str(solicitacao_id),
        usuario_id=str(requester.id),
        size=size,
        mime=tipo.mime,
    )
    return refreshed  # type: ignore[return-value]


async def remover(
    session: AsyncSession,
    *,
    anexo_id: UUID,
    requester: Usuario,
    request: Request | None = None,
) -> None:
    anexo = await anexo_repo.get(session, anexo_id)
    if anexo is None:
        raise NotFoundError("Anexo não encontrado")

    solicitacao = await solicitacao_repo.get_by_id(session, anexo.solicitacao_id)
    if solicitacao is None:
        raise NotFoundError("Solicitação não encontrada")

    # Cada anexo só pode ser removido por quem o enviou. Nem suporte nem
    # administrador apagam anexos alheios — preserva integridade dos uploads
    # do solicitante e dá auditoria limpa.
    if anexo.usuario_id != requester.id:
        raise ForbiddenError("Apenas quem enviou o anexo pode removê-lo")

    key = anexo.storage_key
    filename = anexo.filename_original
    solicitacao_id = anexo.solicitacao_id
    await anexo_repo.remove(session, anexo)
    # Registra evento interno na timeline.
    session.add(
        SolicitacaoEvento(
            solicitacao_id=solicitacao_id,
            usuario_id=requester.id,
            tipo=TipoEventoSolicitacao.anexo_removido,
            de_status=None,
            para_status=None,
            comentario=filename,
            interno=True,
        )
    )
    await audit_service.log_event(
        session,
        acao=AcaoAudit.anexo_removido,
        entidade=EntidadeAudit.anexo,
        actor=requester,
        entidade_id=anexo_id,
        entidade_label=filename,
        detalhes={"solicitacao_id": str(solicitacao_id)},
        request=request,
    )
    await session.commit()
    await delete_object(key)
    log.info("anexo.removido", anexo_id=str(anexo_id), por=str(requester.id))


async def obter_para_download(
    session: AsyncSession,
    *,
    anexo_id: UUID,
    requester: Usuario,
) -> SolicitacaoAnexo:
    anexo = await anexo_repo.get(session, anexo_id)
    if anexo is None:
        raise NotFoundError("Anexo não encontrado")
    solicitacao = await solicitacao_repo.get_by_id(session, anexo.solicitacao_id)
    if solicitacao is None:
        raise NotFoundError("Solicitação não encontrada")
    if (
        requester.perfil == PerfilUsuario.gestor_solicitante
        and solicitacao.usuario_id != requester.id
    ):
        raise ForbiddenError("Sem permissão para baixar este anexo")
    return anexo
