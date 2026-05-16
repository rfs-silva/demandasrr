import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, children }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <span
        className="grid h-12 w-12 place-items-center rounded-full bg-surface-muted text-ink-subtle"
        aria-hidden
      >
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-base font-semibold tracking-tight text-ink">
          {title}
        </p>
        {description && (
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
