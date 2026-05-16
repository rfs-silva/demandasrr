"""Cliente S3-compatible (MinIO em dev/prod self-hosted, AWS S3 em produção).

Encapsula aioboto3 num conjunto de helpers async simples.
"""

from __future__ import annotations

import contextlib
from typing import AsyncIterator, BinaryIO

import aioboto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.core.config import get_settings
from app.core.logging import get_logger

log = get_logger("storage")

_session: aioboto3.Session | None = None


def _get_session() -> aioboto3.Session:
    global _session
    if _session is None:
        _session = aioboto3.Session()
    return _session


@contextlib.asynccontextmanager
async def s3_client():
    """Context manager para obter um cliente boto3 async configurado."""
    settings = get_settings()
    session = _get_session()
    async with session.client(
        "s3",
        endpoint_url=settings.STORAGE_ENDPOINT,
        aws_access_key_id=settings.MINIO_ROOT_USER,
        aws_secret_access_key=settings.MINIO_ROOT_PASSWORD,
        region_name=settings.STORAGE_REGION,
        config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "path"}),
    ) as client:
        yield client


async def ensure_bucket() -> None:
    """Cria o bucket se ainda não existe. Idempotente."""
    settings = get_settings()
    async with s3_client() as s3:
        try:
            await s3.head_bucket(Bucket=settings.STORAGE_BUCKET)
            log.info("storage.bucket_ok", bucket=settings.STORAGE_BUCKET)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            if code in ("404", "NoSuchBucket", "NotFound"):
                await s3.create_bucket(Bucket=settings.STORAGE_BUCKET)
                log.info("storage.bucket_created", bucket=settings.STORAGE_BUCKET)
            else:
                raise


async def put_object(
    key: str,
    fileobj: BinaryIO,
    *,
    content_type: str,
    content_length: int,
) -> None:
    settings = get_settings()
    async with s3_client() as s3:
        await s3.put_object(
            Bucket=settings.STORAGE_BUCKET,
            Key=key,
            Body=fileobj,
            ContentType=content_type,
            ContentLength=content_length,
        )


async def delete_object(key: str) -> None:
    settings = get_settings()
    async with s3_client() as s3:
        try:
            await s3.delete_object(Bucket=settings.STORAGE_BUCKET, Key=key)
        except ClientError as exc:
            log.warning("storage.delete_falhou", key=key, error=str(exc))


async def stream_object(key: str) -> AsyncIterator[bytes]:
    """Gera chunks do objeto para streaming HTTP."""
    settings = get_settings()
    async with s3_client() as s3:
        resp = await s3.get_object(Bucket=settings.STORAGE_BUCKET, Key=key)
        body = resp["Body"]
        async for chunk in body.iter_chunks(chunk_size=64 * 1024):
            yield chunk


async def generate_presigned_url(key: str, *, expires_in: int = 300) -> str:
    """URL assinada para download (default 5 min)."""
    settings = get_settings()
    async with s3_client() as s3:
        url = await s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.STORAGE_BUCKET, "Key": key},
            ExpiresIn=expires_in,
        )
        return url
