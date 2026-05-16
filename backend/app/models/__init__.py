"""Models SQLAlchemy."""

from sqlalchemy import func, select
from sqlalchemy.orm import column_property

from app.models.audit_log import AuditLog
from app.models.enums import (
    AcaoAudit,
    AreaSolicitacao,
    EntidadeAudit,
    PerfilUsuario,
    Situacao,
    StatusSolicitacao,
    TipoEventoSolicitacao,
)
from app.models.municipio import Municipio
from app.models.pessoa import Pessoa
from app.models.refresh_token import RefreshToken
from app.models.solicitacao import Solicitacao
from app.models.solicitacao_anexo import SolicitacaoAnexo
from app.models.solicitacao_evento import SolicitacaoEvento
from app.models.usuario import Usuario

# Carregado em toda query de Solicitacao via subquery escalar correlacionada.
# Pequeno custo (1 SELECT por linha em alguns dialetos) compensado pela
# simplicidade de não precisar mexer em cada list/get do repositório.
Solicitacao.qtd_anexos = column_property(
    select(func.count(SolicitacaoAnexo.id))
    .where(SolicitacaoAnexo.solicitacao_id == Solicitacao.id)
    .correlate_except(SolicitacaoAnexo)
    .scalar_subquery(),
    deferred=False,
)

__all__ = [
    "AcaoAudit",
    "AreaSolicitacao",
    "AuditLog",
    "EntidadeAudit",
    "Municipio",
    "PerfilUsuario",
    "Pessoa",
    "RefreshToken",
    "Situacao",
    "Solicitacao",
    "SolicitacaoAnexo",
    "SolicitacaoEvento",
    "StatusSolicitacao",
    "TipoEventoSolicitacao",
    "Usuario",
]
