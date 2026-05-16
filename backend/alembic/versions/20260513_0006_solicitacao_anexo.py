"""solicitacao_anexo — anexos armazenados em MinIO/S3

Revision ID: 20260513_0006
Revises: 20260513_0005
Create Date: 2026-05-13

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260513_0006"
down_revision: str | Sequence[str] | None = "20260513_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "solicitacao_anexo",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "solicitacao_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("solicitacao.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "usuario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuario.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("filename_original", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("tamanho_bytes", sa.BigInteger(), nullable=False),
        sa.Column("storage_key", sa.String(500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_solicitacao_anexo_solicitacao",
        "solicitacao_anexo",
        ["solicitacao_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_solicitacao_anexo_solicitacao", table_name="solicitacao_anexo")
    op.drop_table("solicitacao_anexo")
