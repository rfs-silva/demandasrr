"""municípios de RR + novas áreas + localidade

- Cria tabela `municipio` com 15 municípios de Roraima + "Outros".
- Reescreve enum `area_solicitacao_enum` (substitui 'social'/'outros' por:
  gestao_economia, desenvolvimento_sustentavel, bem_estar, infraestrutura,
  ciencia_tecnologia).
- Em `pessoa`: substitui coluna textual `municipio` por `municipio_id` (FK)
  + `localidade` opcional (comunidade/vila/vicinal).
- Migra dados existentes (mapeamento case-insensitive de nome → município).

Revision ID: 20260513_0004
Revises: 20260513_0003
Create Date: 2026-05-13

"""
from __future__ import annotations

from typing import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260513_0004"
down_revision: str | Sequence[str] | None = "20260513_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Lista oficial: 15 municípios de RR + Outros
MUNICIPIOS_RR = [
    "Alto Alegre",
    "Amajari",
    "Boa Vista",
    "Bonfim",
    "Cantá",
    "Caracaraí",
    "Caroebe",
    "Iracema",
    "Mucajaí",
    "Normandia",
    "Pacaraima",
    "Rorainópolis",
    "São João da Baliza",
    "São Luiz",
    "Uiramutã",
]

NEW_AREAS = (
    "gestao_economia",
    "desenvolvimento_sustentavel",
    "saude",
    "bem_estar",
    "educacao",
    "seguranca",
    "infraestrutura",
    "ciencia_tecnologia",
)

# Mapeamento de áreas antigas → novas (usado no UPDATE).
AREA_REMAP = {
    "social": "bem_estar",
    "outros": "gestao_economia",
}


def upgrade() -> None:
    # ---------- 1) Tabela municipio + seed ----------
    op.create_table(
        "municipio",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nome", sa.String(100), nullable=False),
        sa.Column("eh_outros", sa.Boolean(), nullable=False, server_default=sa.false()),
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
        sa.UniqueConstraint("nome", name="uq_municipio_nome"),
    )

    municipio_tbl = sa.table(
        "municipio",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("nome", sa.String),
        sa.column("eh_outros", sa.Boolean),
    )
    rows = [{"id": uuid4(), "nome": nome, "eh_outros": False} for nome in MUNICIPIOS_RR]
    rows.append({"id": uuid4(), "nome": "Outros", "eh_outros": True})
    op.bulk_insert(municipio_tbl, rows)

    # ---------- 2) Pessoa: adicionar municipio_id + localidade ----------
    op.add_column(
        "pessoa",
        sa.Column("municipio_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("pessoa", sa.Column("localidade", sa.String(200), nullable=True))

    # 2.1) Migra dados: casa `pessoa.municipio` (texto) com `municipio.nome`
    # case-insensitive. Pessoas sem match vão para "Outros" + localidade = nome original.
    op.execute(
        """
        UPDATE pessoa p
           SET municipio_id = m.id
          FROM municipio m
         WHERE LOWER(p.municipio) = LOWER(m.nome)
        """
    )
    op.execute(
        """
        UPDATE pessoa
           SET municipio_id = (SELECT id FROM municipio WHERE eh_outros = TRUE LIMIT 1),
               localidade   = municipio
         WHERE municipio_id IS NULL
        """
    )

    op.alter_column("pessoa", "municipio_id", nullable=False)

    # FK + índices
    op.drop_index("ix_pessoa_municipio", table_name="pessoa")
    op.create_foreign_key(
        "fk_pessoa_municipio",
        "pessoa",
        "municipio",
        ["municipio_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_index("ix_pessoa_municipio_id", "pessoa", ["municipio_id"])
    op.drop_column("pessoa", "municipio")

    # ---------- 3) Reescrever enum area_solicitacao_enum ----------
    # Não dá para remover valores; estratégia: converter coluna para text → remap → recriar enum → recast.
    op.execute("ALTER TABLE solicitacao ALTER COLUMN area TYPE varchar(50) USING area::text")
    for old, new in AREA_REMAP.items():
        op.execute(f"UPDATE solicitacao SET area = '{new}' WHERE area = '{old}'")
    op.execute("DROP TYPE area_solicitacao_enum")
    values_sql = ", ".join(f"'{v}'" for v in NEW_AREAS)
    op.execute(f"CREATE TYPE area_solicitacao_enum AS ENUM ({values_sql})")
    op.execute(
        "ALTER TABLE solicitacao ALTER COLUMN area "
        "TYPE area_solicitacao_enum USING area::area_solicitacao_enum"
    )


def downgrade() -> None:
    # Downgrade: traz de volta enum antigo (perde valores novos não mapeáveis).
    op.execute("ALTER TABLE solicitacao ALTER COLUMN area TYPE varchar(50) USING area::text")
    op.execute(
        "UPDATE solicitacao SET area = 'outros' "
        "WHERE area NOT IN ('saude','educacao','seguranca','social','outros')"
    )
    op.execute("DROP TYPE area_solicitacao_enum")
    op.execute(
        "CREATE TYPE area_solicitacao_enum AS ENUM "
        "('saude','educacao','seguranca','social','outros')"
    )
    op.execute(
        "ALTER TABLE solicitacao ALTER COLUMN area "
        "TYPE area_solicitacao_enum USING area::area_solicitacao_enum"
    )

    # Restaura coluna municipio textual em pessoa
    op.add_column("pessoa", sa.Column("municipio", sa.String(100), nullable=True))
    op.execute(
        """
        UPDATE pessoa
           SET municipio = COALESCE(
             (SELECT nome FROM municipio WHERE municipio.id = pessoa.municipio_id),
             pessoa.localidade
           )
        """
    )
    op.alter_column("pessoa", "municipio", nullable=False)
    op.create_index("ix_pessoa_municipio", "pessoa", ["municipio"])
    op.drop_index("ix_pessoa_municipio_id", table_name="pessoa")
    op.drop_constraint("fk_pessoa_municipio", "pessoa", type_="foreignkey")
    op.drop_column("pessoa", "localidade")
    op.drop_column("pessoa", "municipio_id")

    op.drop_table("municipio")
