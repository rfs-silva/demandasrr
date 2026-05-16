"""Testa o mapa de transições de status (puramente lógica, sem banco)."""

from __future__ import annotations

from types import SimpleNamespace

from app.models.enums import PerfilUsuario
from app.models.enums import StatusSolicitacao
from app.services.solicitacao_service import _TRANSITIONS, _status_permitidos_para


def _allowed(de: StatusSolicitacao, para: StatusSolicitacao) -> bool:
    return para in _TRANSITIONS.get(de, set())


def test_cadastrada_para_em_analise():
    assert _allowed(StatusSolicitacao.cadastrada, StatusSolicitacao.em_analise)


def test_em_analise_para_atendida_indeferida_cancelada():
    assert _allowed(StatusSolicitacao.em_analise, StatusSolicitacao.atendida)
    assert _allowed(StatusSolicitacao.em_analise, StatusSolicitacao.indeferida)
    assert _allowed(StatusSolicitacao.em_analise, StatusSolicitacao.cancelada)


def test_terminais_sem_reabertura_nao_transicionam():
    for terminal in (
        StatusSolicitacao.atendida,
        StatusSolicitacao.indeferida,
    ):
        for destino in StatusSolicitacao:
            assert not _allowed(terminal, destino), f"{terminal} -> {destino} deveria ser bloqueado"


def test_cancelada_pode_voltar_para_em_analise():
    assert _allowed(StatusSolicitacao.cancelada, StatusSolicitacao.em_analise)


def test_cancelada_nao_pode_ir_para_outros_status():
    for destino in (
        StatusSolicitacao.cadastrada,
        StatusSolicitacao.atendida,
        StatusSolicitacao.indeferida,
        StatusSolicitacao.cancelada,
    ):
        assert not _allowed(StatusSolicitacao.cancelada, destino)


def test_pulo_invalido():
    # Não pode pular direto de cadastrada para atendida
    assert not _allowed(StatusSolicitacao.cadastrada, StatusSolicitacao.atendida)
    # Não pode voltar de em_analise para cadastrada
    assert not _allowed(StatusSolicitacao.em_analise, StatusSolicitacao.cadastrada)


def test_admin_pode_ir_para_qualquer_outro_status():
    admin = SimpleNamespace(perfil=PerfilUsuario.administrador)
    permitidos = _status_permitidos_para(admin, StatusSolicitacao.cadastrada)

    assert StatusSolicitacao.cadastrada not in permitidos
    assert permitidos == {
        StatusSolicitacao.em_analise,
        StatusSolicitacao.atendida,
        StatusSolicitacao.indeferida,
        StatusSolicitacao.cancelada,
    }
