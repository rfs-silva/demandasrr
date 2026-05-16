"""usuario.ver_status_solicitacao — flag de visibilidade do status real

Regra: por padrão, o gestor_solicitante vê todas as suas solicitações como
"Cadastrada", independentemente do status real (em análise, atendida, etc.).
O admin pode liberar a visualização ativando esta flag para um usuário
específico, e a partir daí ele acompanha o fluxo real da demanda.

Aplica-se apenas ao perfil ``gestor_solicitante``. Os demais perfis ignoram
a flag (sempre veem o status real).

Backfill: ``true`` apenas para admin (consistência — admin sempre vê tudo).

Revision ID: 20260514_0012
Revises: 20260514_0011
Create Date: 2026-05-14

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260514_0012"
down_revision: str | Sequence[str] | None = "20260514_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "usuario",
        sa.Column(
            "ver_status_solicitacao",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.execute(
        "UPDATE usuario SET ver_status_solicitacao = true "
        "WHERE perfil = 'administrador'"
    )


def downgrade() -> None:
    op.drop_column("usuario", "ver_status_solicitacao")
