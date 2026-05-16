"""usuario.pode_reabrir_solicitacoes — flag de reabertura controlada pelo admin

Adiciona a coluna ``pode_reabrir_solicitacoes`` em ``usuario``.

Regras:
  - ``administrador``: sempre pode reabrir solicitações canceladas.
  - ``suporte``: só quando esta flag estiver ``True``.
  - demais perfis: sem efeito.

Backfill: administrador recebe ``true``; demais perfis ficam ``false``.

Revision ID: 20260515_0014
Revises: 20260515_0013
Create Date: 2026-05-15
"""

from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260515_0014"
down_revision: str | Sequence[str] | None = "20260515_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "usuario",
        sa.Column(
            "pode_reabrir_solicitacoes",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.execute(
        "UPDATE usuario SET pode_reabrir_solicitacoes = true "
        "WHERE perfil = 'administrador'"
    )


def downgrade() -> None:
    op.drop_column("usuario", "pode_reabrir_solicitacoes")