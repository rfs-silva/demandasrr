import clsx from 'clsx';
import { forwardRef, type SelectHTMLAttributes, useId } from 'react';

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

interface Props<T extends string | number = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  label?: string;
  hint?: string;
  error?: string | null;
  placeholder?: string;
  options: ReadonlyArray<SelectOption<T>>;
  value: T | null;
  onChange: (v: T | null) => void;
}

function BaseSelectInner<T extends string | number = string>(
  {
    label,
    hint,
    error,
    placeholder,
    options,
    value,
    onChange,
    id,
    required,
    disabled,
    className,
    ...rest
  }: Props<T>,
  ref: React.ForwardedRef<HTMLSelectElement>,
) {
  const uid = useId();
  const inputId = id ?? `sel-${uid}`;

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="field-label">
          {label}
          {required ? <span className="text-red-600">&nbsp;*</span> : null}
        </label>
      ) : null}
      <select
        ref={ref}
        id={inputId}
        required={required}
        disabled={disabled}
        value={value == null ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') onChange(null);
          else {
            const opt = options.find((o) => String(o.value) === v);
            onChange((opt?.value ?? null) as T | null);
          }
        }}
        aria-invalid={!!error}
        className={clsx(
          'block w-full appearance-none rounded-md border bg-surface px-3 py-2 pr-8 text-ink shadow-sm focus:outline-none focus:ring-2',
          error
            ? 'border-red-300 focus:border-red-500 focus:ring-red-500/30'
            : 'border-border focus:border-brand-500 focus:ring-brand-500/30',
          disabled && 'cursor-not-allowed bg-surface-muted text-ink-muted',
          className,
        )}
        {...rest}
      >
        {placeholder ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && !error ? <p className="field-hint">{hint}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const BaseSelect = forwardRef(BaseSelectInner) as <T extends string | number = string>(
  props: Props<T> & { ref?: React.ForwardedRef<HTMLSelectElement> },
) => ReturnType<typeof BaseSelectInner>;

export default BaseSelect;
