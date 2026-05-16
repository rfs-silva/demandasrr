import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300 dark:disabled:bg-brand-800/60',
  secondary:
    'bg-surface text-ink border border-border hover:bg-surface-muted disabled:opacity-60',
  danger:
    'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-900/40',
  ghost:
    'bg-transparent text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-50',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-10 px-4 text-sm gap-2',
};

const BaseButton = forwardRef<HTMLButtonElement, Props>(function BaseButton(
  {
    variant = 'primary',
    size = 'md',
    block,
    loading,
    type = 'button',
    children,
    className,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center rounded-md font-medium shadow-xs transition focus-visible:ring-2 focus-visible:ring-brand-500',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        (disabled || loading) && 'cursor-not-allowed',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : null}
      {children}
    </button>
  );
});

export default BaseButton;
