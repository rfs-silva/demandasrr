"""pessoa.data_nascimento

Revision ID: 20260513_0003
Revises: 20260513_0002
Create Date: 2026-05-13

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260513_0003"
down_revision: str | Sequence[str] | None = "20260513_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Adiciona com default sentinela só para tolerar linhas legadas;
    # remove o default para forçar fornecimento explícito em novos inserts.
    op.add_column(
        "pessoa",
        sa.Column(
            "data_nascimento",
            sa.Date(),
            nullable=False,
            server_default=sa.text("'1900-01-01'"),
        ),
    )
    op.alter_column("pessoa", "data_nascimento", server_default=None)


def downgrade() -> None:
    op.drop_column("pessoa", "data_nascimento")
