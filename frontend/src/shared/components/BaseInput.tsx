import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes, useId } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
}

const BaseInput = forwardRef<HTMLInputElement, Props>(function BaseInput(
  { label, error, hint, id, className, disabled, required, ...rest },
  ref,
) {
  const uid = useId();
  const inputId = id ?? `inp-${uid}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="field-label">
          {label}
          {required ? <span className="text-red-600">&nbsp;*</span> : null}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        aria-describedby={[hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined}
        className={clsx(
          'block w-full rounded-md border bg-surface px-3 py-2 text-ink shadow-sm placeholder:text-ink-subtle focus:outline-none focus:ring-2',
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
            : 'border-border focus:border-brand-500 focus:ring-brand-500/30',
          disabled && 'cursor-not-allowed bg-surface-muted text-ink-muted',
          className,
        )}
        {...rest}
      />
      {hint && !error ? (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export default BaseInput;
