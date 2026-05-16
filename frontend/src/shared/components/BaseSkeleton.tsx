import clsx from 'clsx';

interface Props {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
}

export default function BaseSkeleton({
  width = '100%',
  height = '0.875rem',
  rounded = 'md',
  className,
}: Props) {
  const r =
    rounded === 'full'
      ? 'rounded-full'
      : rounded === 'lg'
        ? 'rounded-lg'
        : rounded === 'sm'
          ? 'rounded'
          : 'rounded-md';
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-block animate-pulse bg-surface-subtle dark:bg-slate-700/40',
        r,
        className,
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}
