import type { AreaSolicitacao, StatusSolicitacao } from '@shared/api/types';

export const AREAS: { value: AreaSolicitacao; label: string }[] = [
  { value: 'gestao_economia', label: 'Gestão e Economia' },
  { value: 'desenvolvimento_sustentavel', label: 'Desenvolvimento Sustentável' },
  { value: 'saude', label: 'Saúde' },
  { value: 'bem_estar', label: 'Bem-estar' },
  { value: 'educacao', label: 'Educação' },
  { value: 'seguranca', label: 'Segurança' },
  { value: 'infraestrutura', label: 'Infraestrutura' },
  { value: 'ciencia_tecnologia', label: 'Ciência, Tecnologia e Inovação' },
];

export const AREA_LABEL: Record<AreaSolicitacao, string> = Object.fromEntries(
  AREAS.map((a) => [a.value, a.label]),
) as Record<AreaSolicitacao, string>;

export const STATUS: { value: StatusSolicitacao; label: string }[] = [
  { value: 'cadastrada', label: 'Cadastrada' },
  { value: 'em_analise', label: 'Em análise' },
  { value: 'atendida', label: 'Atendida' },
  { value: 'indeferida', label: 'Indeferida' },
  { value: 'cancelada', label: 'Cancelada' },
];

export const STATUS_LABEL: Record<StatusSolicitacao, string> = Object.fromEntries(
  STATUS.map((s) => [s.value, s.label]),
) as Record<StatusSolicitacao, string>;

export const STATUS_BADGE: Record<StatusSolicitacao, string> = {
  cadastrada:
    'bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200',
  em_analise:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  atendida:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  indeferida: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  cancelada:
    'bg-surface-subtle text-ink-muted dark:bg-surface-subtle/30 dark:text-ink-subtle',
};

/** Faixa lateral dos cards (mais saturada que o badge). */
export const STATUS_STRIPE: Record<StatusSolicitacao, string> = {
  cadastrada: 'bg-brand-400',
  em_analise: 'bg-amber-400',
  atendida: 'bg-emerald-500',
  indeferida: 'bg-red-400',
  cancelada: 'bg-slate-300 dark:bg-slate-600',
};

export const STATUS_TRANSITIONS: Record<StatusSolicitacao, StatusSolicitacao[]> = {
  cadastrada: ['em_analise', 'cancelada'],
  em_analise: ['atendida', 'indeferida', 'cancelada'],
  atendida: [],
  indeferida: [],
  cancelada: ['em_analise'],
};
