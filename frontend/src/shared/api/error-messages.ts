import { isApiError } from './errors';

/** Mensagens pt-BR para códigos conhecidos do backend. */
const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Usuário ou senha incorretos.',
  INACTIVE_USER: 'Usuário inativo. Contate um administrador.',
  INVALID_TOKEN: 'Sessão expirada. Faça login novamente.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  RATE_LIMITED: 'Muitas tentativas. Aguarde alguns segundos e tente novamente.',
  TOO_MANY_ATTEMPTS: 'Muitas tentativas. Aguarde alguns minutos.',
  CPF_DUPLICADO: 'Este CPF já está cadastrado.',
  LOGIN_DUPLICADO: 'Este login já está em uso.',
  TRANSICAO_INVALIDA: 'Transição de status não permitida.',
  PARECER_OBRIGATORIO: 'Informe o parecer para concluir esta ação.',
  REABERTURA_BLOQUEADA: 'Este usuário não tem permissão para reabrir solicitações canceladas.',
  PESSOA_INATIVA: 'A pessoa está inativa.',
  AUTO_MODIFICACAO_BLOQUEADA: 'Você não pode realizar esta operação no próprio usuário.',
  ROOT_PROTEGIDO: 'Esta conta é root e não pode ser modificada por outro usuário.',
  EDICAO_BLOQUEADA: 'Esta solicitação não pode mais ser editada.',
  ARQUIVO_MUITO_GRANDE: 'Arquivo excede o tamanho máximo.',
  LIMITE_ANEXOS_ATINGIDO: 'Limite de anexos para esta solicitação foi atingido.',
  SENHA_ATUAL_INVALIDA: 'Senha atual incorreta.',
  VALIDATION_ERROR: 'Dados inválidos. Verifique os campos.',
  NOT_FOUND: 'Registro não encontrado.',
  NETWORK_ERROR: 'Sem conexão com o servidor.',
  REQUEST_BLOCKED: 'A requisicao foi bloqueada por seguranca.',
  UNKNOWN_ERROR: 'Algo saiu do esperado. Tente novamente em instantes.',
  INTERNAL_ERROR: 'Algo saiu do esperado. Tente novamente em instantes.',
};

const FALLBACK = 'Algo saiu do esperado. Tente novamente em instantes.';

export function messageFor(err: unknown): string {
  if (isApiError(err)) {
    if (MESSAGES[err.code]) return MESSAGES[err.code];
    if (err.status >= 500) return FALLBACK;
    return err.message ?? FALLBACK;
  }
  if (err instanceof Error && err.message) return err.message;
  return FALLBACK;
}
