"""Enums de domínio. Persistidos como ENUM nativo no Postgres."""

from __future__ import annotations

import enum


class Situacao(str, enum.Enum):
    ativo = "ativo"
    inativo = "inativo"


class PerfilUsuario(str, enum.Enum):
    """Hierarquia de perfis, do mais restrito ao mais amplo.

    - ``gestor_solicitante``: vê apenas suas próprias demandas; cria/edita as próprias.
    - ``suporte``: operacional. Atende, comenta, muda status, anexa, exporta,
      cadastra novos usuários (de perfil igual ou inferior).
    - ``governador``: leitura ampla (todas as demandas, painéis, relatórios).
      Por padrão NÃO cria usuários; o admin pode liberar via flag.
    - ``administrador``: acesso total + auditoria.
    """

    gestor_solicitante = "gestor_solicitante"
    suporte = "suporte"
    governador = "governador"
    administrador = "administrador"


class AreaSolicitacao(str, enum.Enum):
    gestao_economia = "gestao_economia"
    desenvolvimento_sustentavel = "desenvolvimento_sustentavel"
    saude = "saude"
    bem_estar = "bem_estar"
    educacao = "educacao"
    seguranca = "seguranca"
    infraestrutura = "infraestrutura"
    ciencia_tecnologia = "ciencia_tecnologia"


class StatusSolicitacao(str, enum.Enum):
    cadastrada = "cadastrada"
    em_analise = "em_analise"
    atendida = "atendida"
    indeferida = "indeferida"
    cancelada = "cancelada"


class TipoEventoSolicitacao(str, enum.Enum):
    """Tipos de evento registrados na linha do tempo de uma solicitação."""

    criada = "criada"
    status_alterado = "status_alterado"
    editada = "editada"
    comentario = "comentario"
    anexo_adicionado = "anexo_adicionado"
    anexo_removido = "anexo_removido"


class AcaoAudit(str, enum.Enum):
    """Ações registradas no log de auditoria global."""

    # Acesso
    login_sucesso = "login_sucesso"
    login_falhou = "login_falhou"
    logout = "logout"
    senha_propria_alterada = "senha_propria_alterada"

    # Usuários
    usuario_criado = "usuario_criado"
    usuario_atualizado = "usuario_atualizado"
    usuario_inativado = "usuario_inativado"
    usuario_senha_resetada = "usuario_senha_resetada"

    # Solicitações (espelho do timeline, mas no painel global)
    solicitacao_criada = "solicitacao_criada"
    solicitacao_editada = "solicitacao_editada"
    solicitacao_status_alterado = "solicitacao_status_alterado"
    solicitacao_comentario = "solicitacao_comentario"

    # Anexos
    anexo_upload = "anexo_upload"
    anexo_removido = "anexo_removido"


class EntidadeAudit(str, enum.Enum):
    """Tipo da entidade alvo de uma ação auditada."""

    usuario = "usuario"
    solicitacao = "solicitacao"
    anexo = "anexo"
    sistema = "sistema"


# Conjuntos úteis para checagens de RBAC:
PERFIS_OPERACIONAIS = frozenset({PerfilUsuario.suporte, PerfilUsuario.administrador})
"""Perfis que podem mudar status / comentar internamente / atender."""

PERFIS_LEITURA_GERAL = frozenset(
    {PerfilUsuario.suporte, PerfilUsuario.governador, PerfilUsuario.administrador}
)
"""Perfis que veem todas as solicitações (não apenas as próprias)."""
