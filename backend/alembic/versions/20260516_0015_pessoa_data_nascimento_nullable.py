"""pessoa.data_nascimento nullable

Revision ID: 20260516_0015
Revises: 20260515_0014
Create Date: 2026-05-16

"""
from __future__ import annotations

from typing import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260516_0015"
down_revision: str | Sequence[str] | None = "20260515_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "pessoa",
        "data_nascimento",
        existing_type=sa.Date(),
        nullable=True,
    )


def downgrade() -> None:
    op.execute("UPDATE pessoa SET data_nascimento = DATE '1900-01-01' WHERE data_nascimento IS NULL")
    op.alter_column(
        "pessoa",
        "data_nascimento",
        existing_type=sa.Date(),
        nullable=False,
    )