"""refator perfil + dados do usuário + anotações internas

- Renomeia 'apoio' → 'suporte' no enum perfil_usuario_enum.
- Adiciona valor 'editada' no enum tipo_evento_solicitacao_enum.
- Adiciona em `usuario`:
    cpf, municipio_id, localidade, contato, data_nascimento,
    must_change_password (default false), eh_root (default false).
- Adiciona em `solicitacao_evento`: `interno` (boolean, default false).
- Backfill: marca o admin do seed como eh_root.

Revision ID: 20260513_0007
Revises: 20260513_0006
Create Date: 2026-05-13

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260513_0007"
down_revision: str | Sequence[str] | None = "20260513_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1) perfil_usuario_enum: apoio → suporte (workflow drop+recreate)
    op.execute("ALTER TABLE usuario ALTER COLUMN perfil DROP DEFAULT")
    op.execute("ALTER TABLE usuario ALTER COLUMN perfil TYPE varchar(20) USING perfil::text")
    op.execute("UPDATE usuario SET perfil = 'suporte' WHERE perfil = 'apoio'")
    op.execute("DROP TYPE perfil_usuario_enum")
    op.execute(
        "CREATE TYPE perfil_usuario_enum AS ENUM ('suporte', 'gestor', 'administrador')"
    )
    op.execute(
        "ALTER TABLE usuario ALTER COLUMN perfil "
        "TYPE perfil_usuario_enum USING perfil::perfil_usuario_enum"
    )
    op.execute("ALTER TABLE usuario ALTER COLUMN perfil SET DEFAULT 'suporte'")

    # 2) tipo_evento_solicitacao_enum: +editada
    op.execute("ALTER TYPE tipo_evento_solicitacao_enum ADD VALUE IF NOT EXISTS 'editada'")

    # 3) Novas colunas em usuario
    op.add_column("usuario", sa.Column("cpf", sa.String(11), nullable=True))
    op.add_column(
        "usuario",
        sa.Column(
            "municipio_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("municipio.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("usuario", sa.Column("localidade", sa.String(200), nullable=True))
    op.add_column("usuario", sa.Column("contato", sa.String(50), nullable=True))
    op.add_column("usuario", sa.Column("data_nascimento", sa.Date(), nullable=True))
    op.add_column(
        "usuario",
        sa.Column(
            "must_change_password",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "usuario",
        sa.Column(
            "eh_root",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # Índices
    op.create_index("ix_usuario_cpf", "usuario", ["cpf"])
    op.create_unique_constraint("uq_usuario_cpf", "usuario", ["cpf"])

    # 4) Anotações internas: campo `interno` em solicitacao_evento
    op.add_column(
        "solicitacao_evento",
        sa.Column(
            "interno",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    # 5) Backfill: admin do seed = eh_root=true
    op.execute("UPDATE usuario SET eh_root = true WHERE LOWER(login) = 'admin'")


def downgrade() -> None:
    op.drop_column("solicitacao_evento", "interno")

    op.drop_constraint("uq_usuario_cpf", "usuario", type_="unique")
    op.drop_index("ix_usuario_cpf", table_name="usuario")
    op.drop_column("usuario", "eh_root")
    op.drop_column("usuario", "must_change_password")
    op.drop_column("usuario", "data_nascimento")
    op.drop_column("usuario", "contato")
    op.drop_column("usuario", "localidade")
    op.drop_column("usuario", "municipio_id")
    op.drop_column("usuario", "cpf")

    # 'editada' não é removível via ALTER TYPE; deixaremos o valor no enum.

    # perfil: reverte 'suporte' → 'apoio'
    op.execute("ALTER TABLE usuario ALTER COLUMN perfil DROP DEFAULT")
    op.execute("ALTER TABLE usuario ALTER COLUMN perfil TYPE varchar(20) USING perfil::text")
    op.execute("UPDATE usuario SET perfil = 'apoio' WHERE perfil = 'suporte'")
    op.execute("DROP TYPE perfil_usuario_enum")
    op.execute(
        "CREATE TYPE perfil_usuario_enum AS ENUM ('apoio', 'gestor', 'administrador')"
    )
    op.execute(
        "ALTER TABLE usuario ALTER COLUMN perfil "
        "TYPE perfil_usuario_enum USING perfil::perfil_usuario_enum"
    )
    op.execute("ALTER TABLE usuario ALTER COLUMN perfil SET DEFAULT 'apoio'")
