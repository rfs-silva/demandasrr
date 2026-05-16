"""audit_log — painel de auditoria global

Cria a tabela `audit_log` com snapshots do ator (nome/login/perfil) e payload
JSONB para detalhes (diff/motivo/extras). Indexada por created_at, acao,
entidade+entidade_id e actor.

Revision ID: 20260514_0009
Revises: 20260514_0008
Create Date: 2026-05-14

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260514_0009"
down_revision: str | Sequence[str] | None = "20260514_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


ACOES = (
    "login_sucesso",
    "login_falhou",
    "logout",
    "senha_propria_alterada",
    "usuario_criado",
    "usuario_atualizado",
    "usuario_inativado",
    "usuario_senha_resetada",
    "solicitacao_criada",
    "solicitacao_editada",
    "solicitacao_status_alterado",
    "solicitacao_comentario",
    "anexo_upload",
    "anexo_removido",
)

ENTIDADES = ("usuario", "solicitacao", "anexo", "sistema")


def upgrade() -> None:
    op.execute(
        "CREATE TYPE acao_audit_enum AS ENUM ("
        + ", ".join(f"'{a}'" for a in ACOES)
        + ")"
    )
    op.execute(
        "CREATE TYPE entidade_audit_enum AS ENUM ("
        + ", ".join(f"'{e}'" for e in ENTIDADES)
        + ")"
    )

    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuario.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("actor_login", sa.String(50), nullable=True),
        sa.Column("actor_nome", sa.String(150), nullable=True),
        sa.Column("actor_perfil", sa.String(30), nullable=True),
        sa.Column(
            "acao",
            postgresql.ENUM(*ACOES, name="acao_audit_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "entidade",
            postgresql.ENUM(
                *ENTIDADES, name="entidade_audit_enum", create_type=False
            ),
            nullable=False,
        ),
        sa.Column("entidade_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("entidade_label", sa.String(200), nullable=True),
        sa.Column("detalhes", postgresql.JSONB, nullable=True),
        sa.Column("ip", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
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
    op.create_index("ix_audit_log_created", "audit_log", ["created_at"])
    op.create_index("ix_audit_log_acao", "audit_log", ["acao"])
    op.create_index(
        "ix_audit_log_entidade", "audit_log", ["entidade", "entidade_id"]
    )
    op.create_index("ix_audit_log_actor", "audit_log", ["actor_id"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_actor", table_name="audit_log")
    op.drop_index("ix_audit_log_entidade", table_name="audit_log")
    op.drop_index("ix_audit_log_acao", table_name="audit_log")
    op.drop_index("ix_audit_log_created", table_name="audit_log")
    op.drop_table("audit_log")
    op.execute("DROP TYPE IF EXISTS entidade_audit_enum")
    op.execute("DROP TYPE IF EXISTS acao_audit_enum")
