"""Endpoints de Municípios (cadastro estático — lista somente leitura)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_session
from app.models.municipio import Municipio
from app.models.usuario import Usuario  # noqa: F401 — usado pelo Depends
from app.schemas.common import Envelope
from app.schemas.municipio import MunicipioOut

router = APIRouter(prefix="/municipios", tags=["municipios"])


@router.get(
    "",
    response_model=Envelope[list[MunicipioOut]],
    summary="Lista todos os municípios disponíveis (Outros vai por último)",
)
async def listar(
    session: AsyncSession = Depends(get_session),
    _: Usuario = Depends(get_current_user),
) -> Envelope[list[MunicipioOut]]:
    stmt = select(Municipio).order_by(Municipio.eh_outros.asc(), Municipio.nome.asc())
    rows = (await session.execute(stmt)).scalars().all()
    return Envelope(data=[MunicipioOut.model_validate(m) for m in rows])
