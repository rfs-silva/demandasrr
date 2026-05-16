"""hierarquia de perfis: gestor_solicitante + suporte + governador + administrador

- Reescreve enum perfil_usuario_enum:
    Antes: suporte | gestor | administrador
    Depois: gestor_solicitante | suporte | governador | administrador
- Migra: usuários `gestor` viram `suporte` (eram operacionais).
- Adiciona `pode_criar_usuarios` em `usuario` (flag controlada pelo admin
  — usada para liberar criação de usuários ao governador).
- Backfill: admin e suporte ganham pode_criar_usuarios=true.

Revision ID: 20260514_0008
Revises: 20260513_0007
Create Date: 2026-05-14

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260514_0008"
down_revision: str | Sequence[str] | None = "20260513_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1) enum: drop+recreate com novos valores
    op.execute("ALTER TABLE usuario ALTER COLUMN perfil DROP DEFAULT")
    op.execute(
        "ALTER TABLE usuario ALTER COLUMN perfil TYPE varchar(30) USING perfil::text"
    )
    # gestor (antigo papel operacional) → suporte
    op.execute("UPDATE usuario SET perfil = 'suporte' WHERE perfil = 'gestor'")
    op.execute("DROP TYPE perfil_usuario_enum")
    op.execute(
        "CREATE TYPE perfil_usuario_enum AS ENUM "
        "('gestor_solicitante', 'suporte', 'governador', 'administrador')"
    )
    op.execute(
        "ALTER TABLE usuario ALTER COLUMN perfil "
        "TYPE perfil_usuario_enum USING perfil::perfil_usuario_enum"
    )
    op.execute(
        "ALTER TABLE usuario ALTER COLUMN perfil SET DEFAULT 'gestor_solicitante'"
    )

    # 2) flag pode_criar_usuarios
    op.add_column(
        "usuario",
        sa.Column(
            "pode_criar_usuarios",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Backfill: admin e suporte podem criar; demais (governador, gestor_solicitante) não
    op.execute(
        "UPDATE usuario SET pode_criar_usuarios = true "
        "WHERE perfil IN ('administrador', 'suporte')"
    )


def downgrade() -> None:
    op.drop_column("usuario", "pode_criar_usuarios")

    # enum: volta para o conjunto antigo (perde gestor_solicitante/governador)
    op.execute("ALTER TABLE usuario ALTER COLUMN perfil DROP DEFAULT")
    op.execute(
        "ALTER TABLE usuario ALTER COLUMN perfil TYPE varchar(30) USING perfil::text"
    )
    # gestor_solicitante volta para suporte; governador também
    op.execute(
        "UPDATE usuario SET perfil = 'suporte' "
        "WHERE perfil IN ('gestor_solicitante', 'governador')"
    )
    op.execute("DROP TYPE perfil_usuario_enum")
    op.execute(
        "CREATE TYPE perfil_usuario_enum AS ENUM "
        "('suporte', 'gestor', 'administrador')"
    )
    op.execute(
        "ALTER TABLE usuario ALTER COLUMN perfil "
        "TYPE perfil_usuario_enum USING perfil::perfil_usuario_enum"
    )
    op.execute("ALTER TABLE usuario ALTER COLUMN perfil SET DEFAULT 'suporte'")
