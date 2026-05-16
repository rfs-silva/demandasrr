"""Schemas de Solicitação."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.cpf_privacy import cpf_para_viewer
from app.models.enums import (
    AreaSolicitacao,
    StatusSolicitacao,
    TipoEventoSolicitacao,
)


def codigo_solicitacao(value: UUID | str) -> str:
    raw = str(value).replace("-", "").upper()[:12]
    return f"DM-{raw}"


class SolicitacaoCreate(BaseModel):
    # Solicitante pode omitir pessoa_id — backend usa/cria a Pessoa do próprio.
    pessoa_id: UUID | None = None
    titulo: str = Field(min_length=3, max_length=120)
    area: AreaSolicitacao
    descricao: str = Field(min_length=10, max_length=2000)

    @field_validator("descricao")
    @classmethod
    def _trim(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Descrição deve ter ao menos 10 caracteres após o trim")
        return v

    @field_validator("titulo")
    @classmethod
    def _trim_titulo(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Título deve ter ao menos 3 caracteres após o trim")
        return v


class StatusUpdate(BaseModel):
    status: StatusSolicitacao
    parecer: str | None = Field(default=None, max_length=1000)

    @field_validator("parecer")
    @classmethod
    def _trim_parecer(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip()
        return value or None


class SolicitacaoUpdate(BaseModel):
    """Edição da solicitação pelo dono (apenas enquanto cadastrada)."""

    titulo: str | None = Field(default=None, max_length=120)
    area: AreaSolicitacao | None = None
    descricao: str | None = Field(default=None, min_length=10, max_length=2000)

    @field_validator("descricao")
    @classmethod
    def _trim_desc(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Descrição deve ter ao menos 10 caracteres após o trim")
        return v

    @field_validator("titulo")
    @classmethod
    def _trim_titulo_upd(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class ComentarioCreate(BaseModel):
    """Anotação interna (visível apenas para gestor/administrador)."""

    texto: str = Field(min_length=1, max_length=500)

    @field_validator("texto")
    @classmethod
    def _trim_texto(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comentário vazio")
        return v


class PessoaResumo(BaseModel):
    id: UUID
    nome: str
    cpf: str


class UsuarioResumo(BaseModel):
    id: UUID
    nome: str
    login: str


class SolicitacaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo: str
    pessoa: PessoaResumo
    usuario: UsuarioResumo
    municipio: str
    titulo: str
    area: AreaSolicitacao
    descricao: str
    status: StatusSolicitacao
    data_solicitacao: datetime
    qtd_anexos: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_for(
        cls,
        solicitacao,
        *,
        viewer,
        ocultar_status: bool = False,
    ) -> "SolicitacaoOut":
        """Constrói o payload da solicitação aplicando as regras de privacidade.

        - CPF da pessoa: regra padrão (admin vê completo, demais veem
          mascarado). Se a pessoa estiver vinculada a um usuário governador,
          o CPF só aparece (mascarado) para o próprio governador e para o
          administrador; nos demais casos fica oculto.
        - ``ocultar_status``: se True, devolve sempre ``cadastrada``
          independentemente do status real (usado para o gestor_solicitante
          quando a flag ``ver_status_solicitacao`` está desligada).
        """
        pessoa = solicitacao.pessoa
        dono_pessoa = getattr(pessoa, "usuario", None)
        cpf_visivel = cpf_para_viewer(
            cpf_raw=pessoa.cpf,
            dono_perfil=dono_pessoa.perfil if dono_pessoa is not None else None,
            dono_id=dono_pessoa.id if dono_pessoa is not None else None,
            viewer_id=getattr(viewer, "id", None),
            viewer_perfil=getattr(viewer, "perfil", None),
        )
        status_visivel = (
            StatusSolicitacao.cadastrada if ocultar_status else solicitacao.status
        )
        return cls(
            id=solicitacao.id,
            codigo=codigo_solicitacao(solicitacao.id),
            pessoa=PessoaResumo(
                id=pessoa.id,
                nome=pessoa.nome,
                cpf=cpf_visivel or "",
            ),
            usuario=UsuarioResumo(
                id=solicitacao.usuario.id,
                nome=solicitacao.usuario.nome,
                login=solicitacao.usuario.login,
            ),
            municipio=solicitacao.municipio,
            titulo=solicitacao.titulo,
            area=solicitacao.area,
            descricao=solicitacao.descricao,
            status=status_visivel,
            data_solicitacao=solicitacao.data_solicitacao,
            qtd_anexos=getattr(solicitacao, "qtd_anexos", 0) or 0,
            created_at=solicitacao.created_at,
            updated_at=solicitacao.updated_at,
        )


class TopSolicitanteOut(BaseModel):
    """Item do ranking de quem mais abriu solicitações dentro do filtro."""

    usuario: UsuarioResumo
    qtd: int


class SolicitacaoEventoOut(BaseModel):
    """Item da linha do tempo de uma solicitação."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tipo: TipoEventoSolicitacao
    de_status: StatusSolicitacao | None
    para_status: StatusSolicitacao | None
    comentario: str | None
    interno: bool
    usuario: UsuarioResumo
    created_at: datetime

    @classmethod
    def from_orm(cls, evento) -> "SolicitacaoEventoOut":
        return cls(
            id=evento.id,
            tipo=evento.tipo,
            de_status=evento.de_status,
            para_status=evento.para_status,
            comentario=evento.comentario,
            interno=evento.interno,
            usuario=UsuarioResumo(
                id=evento.usuario.id,
                nome=evento.usuario.nome,
                login=evento.usuario.login,
            ),
            created_at=evento.created_at,
        )
