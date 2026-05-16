import type { AcaoAudit, EntidadeAudit } from '@shared/api/types';

export const ACAO_LABEL: Record<AcaoAudit, string> = {
  login_sucesso: 'Login realizado',
  login_falhou: 'Tentativa de login',
  logout: 'Logout',
  senha_propria_alterada: 'Troca de senha (próprio)',
  usuario_criado: 'Usuário criado',
  usuario_atualizado: 'Usuário atualizado',
  usuario_inativado: 'Usuário inativado',
  usuario_senha_resetada: 'Senha resetada',
  solicitacao_criada: 'Solicitação criada',
  solicitacao_editada: 'Solicitação editada',
  solicitacao_status_alterado: 'Status alterado',
  solicitacao_comentario: 'Comentário interno',
  anexo_upload: 'Anexo enviado',
  anexo_removido: 'Anexo removido',
};

export const ACOES: ReadonlyArray<{ value: AcaoAudit; label: string }> = (
  Object.entries(ACAO_LABEL) as [AcaoAudit, string][]
).map(([value, label]) => ({ value, label }));

export const ENTIDADE_LABEL: Record<EntidadeAudit, string> = {
  usuario: 'Usuário',
  solicitacao: 'Solicitação',
  anexo: 'Anexo',
  sistema: 'Sistema',
};

export const ENTIDADES: ReadonlyArray<{ value: EntidadeAudit; label: string }> = (
  Object.entries(ENTIDADE_LABEL) as [EntidadeAudit, string][]
).map(([value, label]) => ({ value, label }));

type Tone = 'good' | 'warn' | 'danger' | 'neutral' | 'info';

export const ACAO_TONE: Record<AcaoAudit, Tone> = {
  login_sucesso: 'good',
  login_falhou: 'danger',
  logout: 'neutral',
  senha_propria_alterada: 'info',
  usuario_criado: 'good',
  usuario_atualizado: 'info',
  usuario_inativado: 'warn',
  usuario_senha_resetada: 'warn',
  solicitacao_criada: 'good',
  solicitacao_editada: 'info',
  solicitacao_status_alterado: 'info',
  solicitacao_comentario: 'neutral',
  anexo_upload: 'info',
  anexo_removido: 'warn',
};

export const TONE_CLASSES: Record<Tone, string> = {
  good: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-100',
};
