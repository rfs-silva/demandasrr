"""Import único de todos os models para o Alembic descobrir o metadata."""

from app.db.base import Base  # noqa: F401
from app.models.municipio import Municipio  # noqa: F401
from app.models.pessoa import Pessoa  # noqa: F401
from app.models.refresh_token import RefreshToken  # noqa: F401
from app.models.solicitacao import Solicitacao  # noqa: F401
from app.models.solicitacao_anexo import SolicitacaoAnexo  # noqa: F401
from app.models.solicitacao_evento import SolicitacaoEvento  # noqa: F401
from app.models.usuario import Usuario  # noqa: F401
