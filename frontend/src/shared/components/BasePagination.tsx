import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export default function BasePagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  if (total <= pageSize) {
    return (
      <p className="py-3 text-2xs text-ink-subtle">
        {total === 0 ? 'Nenhum registro' : `${total} ${total === 1 ? 'registro' : 'registros'}`}
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3 text-2xs text-ink-muted">
      <p>
        {first}–{last} de <strong className="text-ink">{total}</strong>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Página anterior"
          className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-ink-muted transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          aria-label="Próxima página"
          className="grid h-8 w-8 place-items-center rounded-md border border-border bg-surface text-ink-muted transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
