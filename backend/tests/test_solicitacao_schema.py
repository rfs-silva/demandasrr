"""Schemas de Solicitação."""

from __future__ import annotations

from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.schemas.solicitacao import SolicitacaoCreate, StatusUpdate


def _base(**over):
    base = {
        "pessoa_id": str(uuid4()),
        "area": "saude",
        "descricao": "Solicitação de consulta especializada para acompanhamento.",
    }
    base.update(over)
    return base


def test_create_aceita_payload_valido():
    s = SolicitacaoCreate(**_base())
    assert s.area.value == "saude"


@pytest.mark.parametrize(
    "area",
    [
        "gestao_economia",
        "desenvolvimento_sustentavel",
        "saude",
        "bem_estar",
        "educacao",
        "seguranca",
        "infraestrutura",
        "ciencia_tecnologia",
    ],
)
def test_create_aceita_todas_as_areas(area):
    SolicitacaoCreate(**_base(area=area))


def test_create_rejeita_area_antiga():
    # 'social' e 'outros' não existem mais
    with pytest.raises(ValidationError):
        SolicitacaoCreate(**_base(area="social"))


def test_descricao_minima():
    with pytest.raises(ValidationError):
        SolicitacaoCreate(**_base(descricao="curta"))


def test_descricao_maxima():
    with pytest.raises(ValidationError):
        SolicitacaoCreate(**_base(descricao="a" * 2001))


def test_status_update_aceita_valores_conhecidos():
    for v in ("cadastrada", "em_analise", "atendida", "indeferida", "cancelada"):
        StatusUpdate(status=v)


def test_status_update_aceita_parecer_com_trim():
    s = StatusUpdate(status="indeferida", parecer="  parecer tecnico  ")
    assert s.parecer == "parecer tecnico"


def test_status_update_rejeita_valor_desconhecido():
    with pytest.raises(ValidationError):
        StatusUpdate(status="foobar")
