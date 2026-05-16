"""solicitacao_evento — linha do tempo / auditoria

Cria a tabela de eventos para acompanhar a evolução de cada solicitação.
Faz backfill: registra evento "criada" para cada solicitação já existente.

Revision ID: 20260513_0005
Revises: 20260513_0004
Create Date: 2026-05-13

"""
from __future__ import annotations

from typing import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260513_0005"
down_revision: str | Sequence[str] | None = "20260513_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE tipo_evento_solicitacao_enum AS ENUM "
        "('criada', 'status_alterado', 'comentario')"
    )

    op.create_table(
        "solicitacao_evento",
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
        sa.Column(
            "tipo",
            postgresql.ENUM(
                "criada",
                "status_alterado",
                "comentario",
                name="tipo_evento_solicitacao_enum",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "de_status",
            postgresql.ENUM(name="status_solicitacao_enum", create_type=False),
            nullable=True,
        ),
        sa.Column(
            "para_status",
            postgresql.ENUM(name="status_solicitacao_enum", create_type=False),
            nullable=True,
        ),
        sa.Column("comentario", sa.String(500), nullable=True),
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
        "ix_solicitacao_evento_solicitacao",
        "solicitacao_evento",
        ["solicitacao_id"],
    )
    op.create_index(
        "ix_solicitacao_evento_created",
        "solicitacao_evento",
        ["created_at"],
    )

    # Backfill: para cada solicitação existente sem evento "criada",
    # gera um evento usando o mesmo usuário responsável e a data_solicitacao.
    conn = op.get_bind()
    rows = conn.execute(
        sa.text(
            """
            SELECT s.id, s.usuario_id, s.status, s.data_solicitacao
              FROM solicitacao s
             WHERE NOT EXISTS (
                 SELECT 1 FROM solicitacao_evento e
                  WHERE e.solicitacao_id = s.id AND e.tipo = 'criada'
             )
            """
        )
    ).fetchall()
    if rows:
        conn.execute(
            sa.text(
                """
                INSERT INTO solicitacao_evento
                   (id, solicitacao_id, usuario_id, tipo,
                    de_status, para_status, comentario, created_at, updated_at)
                VALUES
                   (:id, :sid, :uid, 'criada',
                    NULL, CAST(:para AS status_solicitacao_enum),
                    NULL, :ts, :ts)
                """
            ),
            [
                {
                    "id": uuid4(),
                    "sid": r.id,
                    "uid": r.usuario_id,
                    "para": r.status if isinstance(r.status, str) else r.status.value,
                    "ts": r.data_solicitacao,
                }
                for r in rows
            ],
        )


def downgrade() -> None:
    op.drop_index("ix_solicitacao_evento_created", table_name="solicitacao_evento")
    op.drop_index("ix_solicitacao_evento_solicitacao", table_name="solicitacao_evento")
    op.drop_table("solicitacao_evento")
    op.execute("DROP TYPE IF EXISTS tipo_evento_solicitacao_enum")
