import type { ReactNode } from 'react';

interface Props {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

/** Header padronizado: eyebrow + título + descrição + ações (responsivo). */
export default function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
        {title ? (
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {title}
          </h1>
        ) : null}
        {description ? (
          <div className="max-w-2xl text-sm text-ink-muted">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
