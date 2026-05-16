"""initial schema: pessoa, usuario, solicitacao

Revision ID: 20260513_0001
Revises:
Create Date: 2026-05-13

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260513_0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SITUACAO_VALUES = ("ativo", "inativo")
PERFIL_VALUES = ("apoio", "gestor", "administrador")
AREA_VALUES = ("saude", "educacao", "seguranca", "social", "outros")
STATUS_VALUES = (
    "cadastrada",
    "em_analise",
    "atendida",
    "indeferida",
    "cancelada",
)


def _enum(name: str, values: tuple[str, ...]) -> postgresql.ENUM:
    """Cria uma referência ao ENUM já criado (sem disparar CREATE TYPE)."""
    return postgresql.ENUM(*values, name=name, create_type=False)


def upgrade() -> None:
    # ---- Criar todos os tipos ENUM uma única vez, explicitamente ----
    op.execute("CREATE TYPE situacao_enum AS ENUM ('ativo', 'inativo')")
    op.execute(
        "CREATE TYPE perfil_usuario_enum AS ENUM ('apoio', 'gestor', 'administrador')"
    )
    op.execute(
        "CREATE TYPE area_solicitacao_enum AS ENUM ('saude', 'educacao', 'seguranca', 'social', 'outros')"
    )
    op.execute(
        "CREATE TYPE status_solicitacao_enum AS ENUM "
        "('cadastrada', 'em_analise', 'atendida', 'indeferida', 'cancelada')"
    )

    # -------- pessoa --------
    op.create_table(
        "pessoa",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nome", sa.String(150), nullable=False),
        sa.Column("cpf", sa.String(11), nullable=False),
        sa.Column("municipio", sa.String(100), nullable=False),
        sa.Column(
            "situacao",
            _enum("situacao_enum", SITUACAO_VALUES),
            nullable=False,
            server_default="ativo",
        ),
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
        sa.UniqueConstraint("cpf", name="uq_pessoa_cpf"),
    )
    op.create_index("ix_pessoa_municipio", "pessoa", ["municipio"])
    op.create_index("ix_pessoa_cpf", "pessoa", ["cpf"], unique=True)

    # -------- usuario --------
    op.create_table(
        "usuario",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nome", sa.String(150), nullable=False),
        sa.Column("login", sa.String(50), nullable=False),
        sa.Column("senha_hash", sa.String(255), nullable=False),
        sa.Column(
            "perfil",
            _enum("perfil_usuario_enum", PERFIL_VALUES),
            nullable=False,
            server_default="apoio",
        ),
        sa.Column(
            "situacao",
            _enum("situacao_enum", SITUACAO_VALUES),
            nullable=False,
            server_default="ativo",
        ),
        sa.Column(
            "pessoa_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pessoa.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("ultimo_login", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint("login", name="uq_usuario_login"),
    )
    # Índice funcional para unicidade case-insensitive do login
    op.execute(
        "CREATE UNIQUE INDEX ix_usuario_login_lower ON usuario (LOWER(login))"
    )

    # -------- solicitacao --------
    op.create_table(
        "solicitacao",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "pessoa_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pessoa.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "usuario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuario.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("municipio", sa.String(100), nullable=False),
        sa.Column(
            "area",
            _enum("area_solicitacao_enum", AREA_VALUES),
            nullable=False,
        ),
        sa.Column("descricao", sa.Text(), nullable=False),
        sa.Column(
            "status",
            _enum("status_solicitacao_enum", STATUS_VALUES),
            nullable=False,
            server_default="cadastrada",
        ),
        sa.Column(
            "data_solicitacao",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
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
        sa.CheckConstraint(
            "char_length(descricao) >= 10 AND char_length(descricao) <= 2000",
            name="ck_solicitacao_descricao_len",
        ),
    )
    op.create_index("ix_solicitacao_municipio", "solicitacao", ["municipio"])
    op.create_index("ix_solicitacao_area", "solicitacao", ["area"])
    op.create_index("ix_solicitacao_status", "solicitacao", ["status"])
    op.create_index("ix_solicitacao_data", "solicitacao", ["data_solicitacao"])
    op.create_index("ix_solicitacao_usuario", "solicitacao", ["usuario_id"])
    op.create_index("ix_solicitacao_pessoa", "solicitacao", ["pessoa_id"])


def downgrade() -> None:
    op.drop_index("ix_solicitacao_pessoa", table_name="solicitacao")
    op.drop_index("ix_solicitacao_usuario", table_name="solicitacao")
    op.drop_index("ix_solicitacao_data", table_name="solicitacao")
    op.drop_index("ix_solicitacao_status", table_name="solicitacao")
    op.drop_index("ix_solicitacao_area", table_name="solicitacao")
    op.drop_index("ix_solicitacao_municipio", table_name="solicitacao")
    op.drop_table("solicitacao")

    op.execute("DROP INDEX IF EXISTS ix_usuario_login_lower")
    op.drop_table("usuario")

    op.drop_index("ix_pessoa_cpf", table_name="pessoa")
    op.drop_index("ix_pessoa_municipio", table_name="pessoa")
    op.drop_table("pessoa")

    op.execute("DROP TYPE IF EXISTS status_solicitacao_enum")
    op.execute("DROP TYPE IF EXISTS area_solicitacao_enum")
    op.execute("DROP TYPE IF EXISTS perfil_usuario_enum")
    op.execute("DROP TYPE IF EXISTS situacao_enum")
