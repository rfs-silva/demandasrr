"""Geração heurística de título a partir de um texto livre.

Sem dependência externa: pega a primeira frase, capitaliza e corta no
limite de caracteres respeitando a fronteira de palavra. Determinístico,
offline. Se um dia quiser trocar por um modelo de IA (OpenAI, Hugging Face,
etc.), basta substituir ``sugerir`` por uma chamada externa.
"""

from __future__ import annotations

import re

_FIM_FRASE = re.compile(r"[.!?\n\r]")
_WS = re.compile(r"\s+")


def sugerir(descricao: str, *, limite: int = 80) -> str:
    """Gera um título curto a partir da ``descricao``.

    Regras:
    1. Pega a primeira frase (separadores: ``. ! ? \\n``).
    2. Normaliza espaços, remove caracteres de controle.
    3. Capitaliza a inicial.
    4. Se ainda exceder ``limite``, corta na última palavra antes do limite
       e acrescenta reticências (``…``).
    5. Sempre retorna ao menos um caractere. Se a descrição vier vazia,
       retorna ``"Solicitação"`` (defensivo — schema já bloqueia, mas
       evita string vazia em qualquer caminho).
    """
    if not descricao:
        return "Solicitação"

    # 1) primeira frase
    fim = _FIM_FRASE.search(descricao)
    bruto = descricao[: fim.start()] if fim else descricao

    # 2) normaliza
    bruto = _WS.sub(" ", bruto).strip()
    if not bruto:
        return "Solicitação"

    # 3) capitaliza apenas a primeira letra
    bruto = bruto[0].upper() + bruto[1:]

    # 4) corta no limite respeitando fronteira de palavra
    if len(bruto) <= limite:
        return bruto

    corte = bruto.rfind(" ", 0, limite - 1)
    if corte <= 0:
        corte = limite - 1
    return bruto[:corte].rstrip(",;:- ") + "…"
