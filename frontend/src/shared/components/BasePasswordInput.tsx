import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useId, useState, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string | null;
  hint?: string;
}

const BasePasswordInput = forwardRef<HTMLInputElement, Props>(function BasePasswordInput(
  { label, error, hint, id, className, disabled, required, ...rest },
  ref,
) {
  const uid = useId();
  const inputId = id ?? `pwd-${uid}`;
  const [visible, setVisible] = useState(false);

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="field-label">
          {label}
          {required ? <span className="text-red-600">&nbsp;*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          className={clsx(
            'block w-full rounded-md border bg-surface px-3 py-2 pr-10 text-ink shadow-sm placeholder:text-ink-subtle focus:outline-none focus:ring-2',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
              : 'border-border focus:border-brand-500 focus:ring-brand-500/30',
            disabled && 'cursor-not-allowed bg-surface-muted text-ink-muted',
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && !error ? <p className="field-hint">{hint}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export default BasePasswordInput;
