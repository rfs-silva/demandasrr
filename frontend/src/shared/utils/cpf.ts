export function digitsOnly(s: string): string {
  return (s || '').replace(/\D+/g, '');
}

export function maskCpfWhileTyping(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function isValidCpf(cpf: string): boolean {
  const c = digitsOnly(cpf);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;
  const calc = (slice: number) => {
    let soma = 0;
    for (let i = 0; i < slice - 1; i++) soma += Number(c[i]) * (slice - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(10) === Number(c[9]) && calc(11) === Number(c[10]);
}
