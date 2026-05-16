import clsx from 'clsx';
import { forwardRef, type TextareaHTMLAttributes, useId } from 'react';

interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

const BaseTextarea = forwardRef<HTMLTextAreaElement, Props>(function BaseTextarea(
  { label, hint, error, id, required, disabled, className, rows = 4, ...rest },
  ref,
) {
  const uid = useId();
  const inputId = id ?? `txt-${uid}`;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="field-label">
          {label}
          {required ? <span className="text-red-600">&nbsp;*</span> : null}
        </label>
      ) : null}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        disabled={disabled}
        aria-invalid={!!error}
        className={clsx(
          'block w-full resize-y rounded-md border bg-surface px-3 py-2 text-ink shadow-sm placeholder:text-ink-subtle focus:outline-none focus:ring-2',
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
            : 'border-border focus:border-brand-500 focus:ring-brand-500/30',
          disabled && 'cursor-not-allowed bg-surface-muted text-ink-muted',
          className,
        )}
        {...rest}
      />
      {hint && !error ? <p className="field-hint">{hint}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export default BaseTextarea;
