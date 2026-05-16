"""solicitacao.titulo — campo curto para identificar a solicitação

Cria a coluna `titulo` em ``solicitacao`` (string 120). Faz backfill a partir
dos primeiros caracteres de ``descricao``. Por fim, marca NOT NULL.

Revision ID: 20260514_0010
Revises: 20260514_0009
Create Date: 2026-05-14

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260514_0010"
down_revision: str | Sequence[str] | None = "20260514_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "solicitacao",
        sa.Column("titulo", sa.String(length=120), nullable=True),
    )
    # Backfill: usa as primeiras 120 letras da descrição trimadas.
    op.execute(
        """
        UPDATE solicitacao
           SET titulo = TRIM(SUBSTRING(descricao FROM 1 FOR 120))
         WHERE titulo IS NULL
        """
    )
    op.alter_column("solicitacao", "titulo", nullable=False)


def downgrade() -> None:
    op.drop_column("solicitacao", "titulo")
