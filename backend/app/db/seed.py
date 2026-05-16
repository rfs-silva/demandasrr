"""Seed inicial. Idempotente.

Cria o usuário administrador e garante presença dos 15 municípios de Roraima
(+ "Outros") na tabela `municipio`.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.enums import PerfilUsuario, Situacao
from app.models.municipio import Municipio
from app.models.usuario import Usuario

configure_logging()
log = get_logger("seed")


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


async def ensure_municipios() -> None:
    async with SessionLocal() as session:
        existing = {
            n.lower()
            for n in (
                await session.execute(select(func.lower(Municipio.nome)))
            ).scalars().all()
        }
        novos: list[Municipio] = []
        for nome in MUNICIPIOS_RR:
            if nome.lower() not in existing:
                novos.append(Municipio(nome=nome, eh_outros=False))
        if "outros" not in existing:
            novos.append(Municipio(nome="Outros", eh_outros=True))

        if novos:
            session.add_all(novos)
            await session.commit()
            log.info("seed.municipios_inseridos", n=len(novos))
        else:
            log.info("seed.municipios_ok")


async def ensure_admin() -> None:
    settings = get_settings()
    async with SessionLocal() as session:
        stmt = select(Usuario).where(func.lower(Usuario.login) == settings.ADMIN_LOGIN.lower())
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            log.info("seed.admin_exists", login=existing.login)
            return
        admin = Usuario(
            nome=settings.ADMIN_NOME,
            login=settings.ADMIN_LOGIN,
            senha_hash=hash_password(settings.ADMIN_PASSWORD),
            perfil=PerfilUsuario.administrador,
            situacao=Situacao.ativo,
            eh_root=True,
            must_change_password=False,
            pode_criar_usuarios=True,
            pode_criar_solicitacoes=True,
            ver_status_solicitacao=True,
        )
        session.add(admin)
        await session.commit()
        log.info("seed.admin_created", login=admin.login)


async def ensure_test_users() -> None:
    """Garante 3 usuários de teste — um para cada perfil não-admin.

    Idempotente: só cria se ainda não existem. Senha padrão = últimos 4 dígitos
    do CPF. Forçam troca no primeiro acesso. CPFs gerados pelo algoritmo padrão.
    """
    from app.core.password_default import gerar_senha_padrao
    from app.services.usuario_service import _ensure_pessoa_para_usuario

    async with SessionLocal() as session:
        # Busca município "Boa Vista" para vincular
        municipio = (
            await session.execute(
                select(Municipio).where(func.lower(Municipio.nome) == "boa vista")
            )
        ).scalar_one_or_none()
        if municipio is None:
            log.warning("seed.test_users.skip", motivo="municipio_boa_vista_ausente")
            return

        seeds = [
            {
                "nome": "Maria Suporte",
                "login": "20030040175",
                "cpf": "20030040175",
                "perfil": PerfilUsuario.suporte,
                "pode_criar_usuarios": True,
                # Suporte só cria solicitação quando admin liga essa flag.
                "pode_criar_solicitacoes": False,
                # Não-solicitantes sempre veem o status real (flag ignorada).
                "ver_status_solicitacao": True,
            },
            {
                "nome": "João Governador",
                "login": "20030040256",
                "cpf": "20030040256",
                "perfil": PerfilUsuario.governador,
                # Mantém desligado por padrão — admin liga depois para testar.
                "pode_criar_usuarios": False,
                "pode_criar_solicitacoes": False,
                "ver_status_solicitacao": True,
            },
            {
                "nome": "Ana Solicitante",
                "login": "20030040337",
                "cpf": "20030040337",
                "perfil": PerfilUsuario.gestor_solicitante,
                "pode_criar_usuarios": False,
                # Gestor solicitante sempre pode (regra do service).
                "pode_criar_solicitacoes": True,
                # Default: NÃO vê o status real (somente "Cadastrada").
                "ver_status_solicitacao": False,
            },
        ]

        criados: list[str] = []
        for body in seeds:
            stmt = select(Usuario).where(
                func.lower(Usuario.login) == body["login"].lower()
            )
            if (await session.execute(stmt)).scalar_one_or_none() is not None:
                continue
            senha_padrao = gerar_senha_padrao(cpf=body["cpf"])
            u = Usuario(
                nome=body["nome"],
                login=body["login"],
                senha_hash=hash_password(senha_padrao),
                perfil=body["perfil"],
                situacao=Situacao.ativo,
                cpf=body["cpf"],
                municipio_id=municipio.id,
                must_change_password=True,
                eh_root=False,
                pode_criar_usuarios=body["pode_criar_usuarios"],
                pode_criar_solicitacoes=body["pode_criar_solicitacoes"],
                ver_status_solicitacao=body["ver_status_solicitacao"],
            )
            session.add(u)
            await session.flush()
            # Sincroniza Pessoa para que o solicitante consiga criar solicitação
            # sem precisar selecionar pessoa manualmente.
            await _ensure_pessoa_para_usuario(session, usuario=u)
            criados.append(body["login"])

        if criados:
            await session.commit()
            log.info("seed.test_users_created", logins=criados)
        else:
            log.info("seed.test_users_ok")


async def run() -> None:
    settings = get_settings()
    log.info("seed.start")
    await ensure_municipios()
    await ensure_admin()
    if settings.SEED_TEST_USERS:
        await ensure_test_users()
    else:
        log.info("seed.test_users_disabled")
    log.info("seed.done")


if __name__ == "__main__":
    asyncio.run(run())
