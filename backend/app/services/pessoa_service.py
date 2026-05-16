"""Casos de uso de Pessoa."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, CpfDuplicadoError, NotFoundError
from app.core.logging import get_logger
from app.models.enums import Situacao
from app.models.pessoa import Pessoa
from app.repositories import pessoa_repo
from app.schemas.pessoa import PessoaCreate, PessoaUpdate

log = get_logger("pessoa")


class LocalidadeObrigatoriaError(AppError):
    code = "LOCALIDADE_OBRIGATORIA"
    default_status = 422
    default_message = "Localidade é obrigatória quando o município é 'Outros'"


async def _resolver_municipio(session: AsyncSession, mid: UUID):
    m = await pessoa_repo.municipio_by_id(session, mid)
    if m is None:
        raise NotFoundError("Município não encontrado")
    return m


async def criar(session: AsyncSession, body: PessoaCreate) -> Pessoa:
    existing = await pessoa_repo.get_by_cpf(session, body.cpf)
    if existing is not None:
        raise CpfDuplicadoError(
            details={
                "cpf": body.cpf,
                "situacao_atual": existing.situacao.value,
                "id_existente": str(existing.id),
            }
        )

    municipio = await _resolver_municipio(session, body.municipio_id)
    if municipio.eh_outros and not body.localidade:
        raise LocalidadeObrigatoriaError()

    pessoa = Pessoa(
        nome=body.nome,
        cpf=body.cpf,
        data_nascimento=body.data_nascimento,
        municipio_id=municipio.id,
        localidade=body.localidade if municipio.eh_outros else None,
        situacao=Situacao.ativo,
    )
    try:
        await pessoa_repo.add(session, pessoa)
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise CpfDuplicadoError(details={"cpf": body.cpf}) from exc

    log.info("pessoa.criada", pessoa_id=str(pessoa.id))
    # recarrega com municipio
    return await pessoa_repo.get_by_id(session, pessoa.id)  # type: ignore[return-value]


async def atualizar(session: AsyncSession, pessoa_id: UUID, body: PessoaUpdate) -> Pessoa:
    pessoa = await pessoa_repo.get_by_id(session, pessoa_id)
    if pessoa is None:
        raise NotFoundError("Pessoa não encontrada")

    if body.nome is not None:
        pessoa.nome = body.nome
    if "data_nascimento" in body.model_fields_set:
        pessoa.data_nascimento = body.data_nascimento
    if body.situacao is not None:
        pessoa.situacao = body.situacao

    if body.municipio_id is not None:
        municipio = await _resolver_municipio(session, body.municipio_id)
        pessoa.municipio_id = municipio.id
        # Quando troca para "Outros", localidade vira obrigatória.
        if municipio.eh_outros:
            nova_loc = body.localidade if body.localidade is not None else pessoa.localidade
            if not nova_loc:
                raise LocalidadeObrigatoriaError()
            pessoa.localidade = nova_loc
        else:
            pessoa.localidade = None
    elif body.localidade is not None:
        # Atualização só de localidade — válida apenas se município atual é "Outros".
        if pessoa.municipio.eh_outros:
            pessoa.localidade = body.localidade

    await session.commit()
    await session.refresh(pessoa)
    log.info("pessoa.atualizada", pessoa_id=str(pessoa.id))
    return pessoa


async def soft_delete(session: AsyncSession, pessoa_id: UUID) -> None:
    pessoa = await pessoa_repo.get_by_id(session, pessoa_id)
    if pessoa is None:
        raise NotFoundError("Pessoa não encontrada")
    pessoa.situacao = Situacao.inativo
    await session.commit()
    log.info("pessoa.inativada", pessoa_id=str(pessoa.id))


async def obter(session: AsyncSession, pessoa_id: UUID) -> Pessoa:
    pessoa = await pessoa_repo.get_by_id(session, pessoa_id)
    if pessoa is None:
        raise NotFoundError("Pessoa não encontrada")
    return pessoa
