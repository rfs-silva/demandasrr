"""usuario.pode_criar_solicitacoes — flag controlada pelo admin

Adiciona a coluna ``pode_criar_solicitacoes`` em ``usuario``.

Regras de criação de solicitação:
  - ``gestor_solicitante``: sempre pode (cria a própria demanda).
  - ``administrador``: sempre pode.
  - ``suporte``/``governador``: só quando esta flag estiver ``True``.

Backfill: admin recebe ``true``; demais perfis ficam ``false`` (default).

Revision ID: 20260514_0011
Revises: 20260514_0010
Create Date: 2026-05-14

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260514_0011"
down_revision: str | Sequence[str] | None = "20260514_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "usuario",
        sa.Column(
            "pode_criar_solicitacoes",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    # Admin sempre pode; o flag em si só tem efeito em suporte/governador,
    # mas marcar admin=true mantém consistência se algum lugar olhar a coluna.
    op.execute(
        "UPDATE usuario SET pode_criar_solicitacoes = true "
        "WHERE perfil = 'administrador'"
    )


def downgrade() -> None:
    op.drop_column("usuario", "pode_criar_solicitacoes")
