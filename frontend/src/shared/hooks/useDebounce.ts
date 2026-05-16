import { useEffect, useState } from 'react';

/**
 * Debounce simples — devolve `value` após `delay` ms parado.
 * Usar para inputs de busca para evitar disparo a cada tecla.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}
