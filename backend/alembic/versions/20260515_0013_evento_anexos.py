"""adiciona anexo_adicionado/anexo_removido em tipo_evento_solicitacao_enum

Cada upload ou remoção de anexo passa a virar evento interno na timeline da
solicitação (visível apenas para a equipe interna: suporte, governador, admin).
O solicitante não vê esses eventos.

Revision ID: 20260515_0013
Revises: 20260514_0012
Create Date: 2026-05-15

"""
from __future__ import annotations

from typing import Sequence

from alembic import op

revision: str = "20260515_0013"
down_revision: str | Sequence[str] | None = "20260514_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE não roda dentro de transação automática do
    # Alembic — usamos AUTOCOMMIT na conexão.
    bind = op.get_bind()
    bind.exec_driver_sql("COMMIT")
    bind.exec_driver_sql(
        "ALTER TYPE tipo_evento_solicitacao_enum ADD VALUE IF NOT EXISTS 'anexo_adicionado'"
    )
    bind.exec_driver_sql(
        "ALTER TYPE tipo_evento_solicitacao_enum ADD VALUE IF NOT EXISTS 'anexo_removido'"
    )
    bind.exec_driver_sql("BEGIN")


def downgrade() -> None:
    # Postgres não permite remover valores de um enum. Para reverter seria
    # necessário recriar o tipo. Deixamos como no-op.
    pass
