"""Guarda heuristica para bloquear probes e payloads suspeitos na URL.

Nao substitui validacao de entrada nem queries parametrizadas, mas reduz ruido
de scanners e tentativas obvias de abuso antes de chegar aos handlers.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


_PROBE_PATHS = re.compile(
    r"^/(wp-(admin|login|content|includes)|xmlrpc\.php|administrator|phpmyadmin|phpinfo\.php|adminer\.php|setup\.php|joomla|drupal|magento|cgi-bin|boaform|hudson|jenkins|owa|telescope|console|webconsole|server-status|actuator|\.git|\.svn|\.env|\.aws|\.ssh|\.docker|backup|dump)",
    re.IGNORECASE,
)

_SUSPICIOUS_TARGET = re.compile(
    r"(union(?:\s|\+|%20)+select|select(?:\s|\+|%20)+from|information_schema|sleep\(|benchmark\(|load_file\(|into(?:\s|\+|%20)+outfile|/etc/passwd|<script|\.\./\.\./|/proc/self|\bor\b(?:\s|\+|%20)+1=1|\band\b(?:\s|\+|%20)+1=1|drop(?:\s|\+|%20)+table)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class BlockedRequest:
    status_code: int
    code: str
    message: str


def inspect_request_target(path: str, query_string: str) -> BlockedRequest | None:
    target = f"{path}?{query_string}" if query_string else path
    if _PROBE_PATHS.search(path):
        return BlockedRequest(
            status_code=404,
            code="NOT_FOUND",
            message="Rota nao encontrada.",
        )
    if _SUSPICIOUS_TARGET.search(target):
        return BlockedRequest(
            status_code=400,
            code="REQUEST_BLOCKED",
            message="A requisicao foi bloqueada por seguranca.",
        )
    return None