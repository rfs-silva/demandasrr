/**
 * Utilitários de data — todas as funções aceitam strings ISO (resposta do backend)
 * e devolvem em pt-BR/horário local.
 */

const DATETIME_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_FMT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const RELATIVE_FMT = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function formatDateTimeBR(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return DATETIME_FMT.format(d);
}

export function formatDateBR(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return DATE_FMT.format(d);
}

/** "há 3 minutos" / "em 2 horas" / "ontem". Quando muito antigo, cai pra data. */
export function tempoRelativo(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = d.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const sec = Math.round(diffMs / 1000);
  const min = Math.round(diffMs / 60_000);
  const hour = Math.round(diffMs / 3_600_000);
  const day = Math.round(diffMs / 86_400_000);

  if (abs < 60_000) return RELATIVE_FMT.format(sec, 'second');
  if (abs < 3_600_000) return RELATIVE_FMT.format(min, 'minute');
  if (abs < 86_400_000) return RELATIVE_FMT.format(hour, 'hour');
  if (abs < 7 * 86_400_000) return RELATIVE_FMT.format(day, 'day');
  return formatDateBR(iso);
}

/** Idade em anos, baseada em data ISO (YYYY-MM-DD) ou nula. */
export function calcularIdade(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let idade = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) idade--;
  return idade >= 0 && idade < 150 ? idade : null;
}
