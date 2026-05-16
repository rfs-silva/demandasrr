"""Repositório de Solicitação."""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import defer, lazyload, selectinload

from app.models.enums import AreaSolicitacao, StatusSolicitacao
from app.models.pessoa import Pessoa
from app.models.solicitacao import Solicitacao


@dataclass(slots=True)
class SolicitacaoFiltros:
    municipio: str | None = None
    area: AreaSolicitacao | None = None
    status: StatusSolicitacao | None = None
    data_de: datetime | None = None
    data_ate: datetime | None = None
    search: str | None = None
    # Restringe ao solicitante (autor) escolhido. Para o ``gestor_solicitante``
    # é preenchido com o próprio id pelo controller; para a equipe interna
    # pode vir como filtro escolhido na tela gerencial.
    usuario_id: UUID | None = None


def _apply_filters(stmt, filtros: SolicitacaoFiltros):
    if filtros.usuario_id is not None:
        stmt = stmt.where(Solicitacao.usuario_id == filtros.usuario_id)
    if filtros.municipio:
        stmt = stmt.where(Solicitacao.municipio.ilike(f"%{filtros.municipio}%"))
    if filtros.area is not None:
        stmt = stmt.where(Solicitacao.area == filtros.area)
    if filtros.status is not None:
        stmt = stmt.where(Solicitacao.status == filtros.status)
    if filtros.data_de is not None:
        stmt = stmt.where(Solicitacao.data_solicitacao >= filtros.data_de)
    if filtros.data_ate is not None:
        stmt = stmt.where(Solicitacao.data_solicitacao <= filtros.data_ate)
    if filtros.search:
        like = f"%{filtros.search}%"
        codigo_search = "".join(ch for ch in filtros.search.lower() if ch.isalnum())
        codigo_expr = func.lower(
            func.concat("dm", func.replace(cast(Solicitacao.id, String), "-", ""))
        )
        stmt = stmt.join(Pessoa, Solicitacao.pessoa_id == Pessoa.id).where(
            or_(
                Solicitacao.descricao.ilike(like),
                Solicitacao.titulo.ilike(like),
                Solicitacao.municipio.ilike(like),
                Pessoa.nome.ilike(like),
                codigo_expr.like(f"%{codigo_search}%") if codigo_search else False,
            )
        )
    return stmt


async def list_paged(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    filtros: SolicitacaoFiltros,
) -> tuple[list[Solicitacao], int]:
    base = (
        select(Solicitacao)
        .options(
            selectinload(Solicitacao.pessoa).selectinload(Pessoa.usuario),
            selectinload(Solicitacao.usuario),
        )
    )
    count_base = select(func.count()).select_from(Solicitacao)

    base = _apply_filters(base, filtros)
    count_base = _apply_filters(count_base, filtros)

    base = (
        base.order_by(Solicitacao.data_solicitacao.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    total = (await session.execute(count_base)).scalar_one()
    rows = (await session.execute(base)).scalars().unique().all()
    return list(rows), int(total)


async def iter_all(
    session: AsyncSession,
    *,
    filtros: SolicitacaoFiltros,
    chunk_size: int = 500,
) -> AsyncIterator[Solicitacao]:
    """Itera resultados em chunks (para export CSV de grandes volumes).

    ``defer(qtd_anexos)`` evita pagar a subquery escalar de contagem por linha:
    o CSV nunca consome esse campo.
    """
    stmt = (
        select(Solicitacao)
        .options(
            selectinload(Solicitacao.pessoa).selectinload(Pessoa.usuario),
            selectinload(Solicitacao.usuario),
            defer(Solicitacao.qtd_anexos),
        )
        .order_by(Solicitacao.data_solicitacao.desc())
    )
    stmt = _apply_filters(stmt, filtros)

    result = await session.stream(stmt.execution_options(yield_per=chunk_size))
    async for row in result.scalars():
        yield row


async def get_by_id(session: AsyncSession, solicitacao_id: UUID) -> Solicitacao | None:
    stmt = (
        select(Solicitacao)
        .where(Solicitacao.id == solicitacao_id)
        .options(
            selectinload(Solicitacao.pessoa).selectinload(Pessoa.usuario),
            selectinload(Solicitacao.usuario),
        )
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def add(session: AsyncSession, solicitacao: Solicitacao) -> Solicitacao:
    session.add(solicitacao)
    await session.flush()
    return solicitacao


async def list_eventos(
    session: AsyncSession,
    solicitacao_id: UUID,
    *,
    incluir_internos: bool = True,
) -> list:
    from app.models.solicitacao_evento import SolicitacaoEvento

    stmt = (
        select(SolicitacaoEvento)
        .where(SolicitacaoEvento.solicitacao_id == solicitacao_id)
        .options(selectinload(SolicitacaoEvento.usuario))
        .order_by(SolicitacaoEvento.created_at.asc())
    )
    if not incluir_internos:
        stmt = stmt.where(SolicitacaoEvento.interno.is_(False))
    return list((await session.execute(stmt)).scalars().all())


async def get_evento_with_user(session: AsyncSession, evento_id: UUID):
    from app.models.solicitacao_evento import SolicitacaoEvento

    stmt = (
        select(SolicitacaoEvento)
        .where(SolicitacaoEvento.id == evento_id)
        .options(selectinload(SolicitacaoEvento.usuario))
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def top_solicitantes(
    session: AsyncSession,
    *,
    filtros: SolicitacaoFiltros,
    limit: int = 10,
) -> list[tuple["app.models.usuario.Usuario", int]]:  # type: ignore[name-defined]
    """Ranking de solicitantes pelo nº de demandas dentro do filtro.

    Agrega em uma única query (``GROUP BY usuario_id``) e devolve já as linhas
    do usuário hidratadas. Útil tanto para a tela gerencial ("quem mais
    solicitou") quanto para dashboards.
    """
    from app.models.usuario import Usuario

    qtd = func.count(Solicitacao.id).label("qtd")
    stmt = (
        select(Usuario, qtd)
        .join(Usuario, Usuario.id == Solicitacao.usuario_id)
        .options(lazyload(Usuario.municipio))
    )
    stmt = _apply_filters(stmt, filtros)
    stmt = (
        stmt.group_by(Usuario.id)
        .order_by(qtd.desc(), Usuario.nome.asc())
        .limit(max(1, min(limit, 50)))
    )
    rows = (await session.execute(stmt)).all()
    return [(row[0], int(row[1])) for row in rows]
