"""Regras de visibilidade de CPF.

Centraliza a decisão de como exibir um CPF para um determinado viewer.
Hoje a única regra especial é para o **governador**: ninguém vê o CPF dele,
exceto ele mesmo e o administrador — e mesmo assim apenas mascarado.

Para os demais perfis vale a regra antiga: administrador vê completo,
qualquer outro perfil vê mascarado.
"""

from __future__ import annotations

from app.core.cpf import formatar, mascarar, somente_digitos
from app.models.enums import PerfilUsuario

# Marcador retornado quando o CPF deve ficar totalmente oculto para o viewer.
CPF_OCULTO = "***.***.***-**"


def cpf_para_viewer(
    *,
    cpf_raw: str | None,
    dono_perfil: PerfilUsuario | str | None,
    dono_id: object | None,
    viewer_id: object | None,
    viewer_perfil: PerfilUsuario | str | None,
) -> str | None:
    """Aplica as regras de visibilidade do CPF.

    Args:
        cpf_raw: o CPF cru (com ou sem máscara, ou None se a pessoa não tem).
        dono_perfil: perfil do "dono" do CPF (do usuário-titular). ``None``
            indica que a pessoa não está vinculada a nenhum usuário do sistema
            — nesse caso vale a regra antiga.
        dono_id: id do dono (UUID). Usado para identificar "é o próprio".
        viewer_id: id de quem está consultando.
        viewer_perfil: perfil de quem está consultando.

    Returns:
        - ``None`` se o CPF original é nulo;
        - ``"***.***.***-**"`` quando o CPF deve ficar oculto;
        - CPF mascarado (``***.***.***-XX``) quando o viewer tem visão parcial;
        - CPF formatado completo quando o viewer é admin e o dono não é governador.
    """
    if not cpf_raw:
        return None

    digits = somente_digitos(cpf_raw)
    if not digits:
        return None

    # Normaliza enums para string para evitar surpresas
    dono_perfil_str = (
        dono_perfil.value if isinstance(dono_perfil, PerfilUsuario) else dono_perfil
    )
    viewer_perfil_str = (
        viewer_perfil.value if isinstance(viewer_perfil, PerfilUsuario) else viewer_perfil
    )

    eh_governador = dono_perfil_str == PerfilUsuario.governador.value

    if eh_governador:
        # CPF do governador é privado. Só ele mesmo e o admin enxergam, e
        # apenas mascarado.
        eh_proprio = viewer_id is not None and dono_id is not None and viewer_id == dono_id
        eh_admin = viewer_perfil_str == PerfilUsuario.administrador.value
        if eh_proprio or eh_admin:
            return mascarar(digits)
        return CPF_OCULTO

    # Regra padrão: admin vê completo, demais veem mascarado.
    if viewer_perfil_str == PerfilUsuario.administrador.value:
        return formatar(digits)
    return mascarar(digits)
