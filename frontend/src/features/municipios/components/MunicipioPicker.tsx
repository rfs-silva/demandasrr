import { useMemo } from 'react';

import BaseInput from '@shared/components/BaseInput';
import BaseSelect, { type SelectOption } from '@shared/components/BaseSelect';

import { useMunicipiosQuery } from '../queries/use-municipios';

interface Props {
  municipioId: string | null;
  localidade: string | null;
  required?: boolean;
  disabled?: boolean;
  error?: { municipio_id?: string | null; localidade?: string | null };
  onChange: (municipioId: string | null, localidade: string | null) => void;
}

/**
 * Combo de município com regra do "Outros" (libera campo de localidade livre).
 * Equivalente ao MunicipioPicker do Vue antigo.
 */
export default function MunicipioPicker({
  municipioId,
  localidade,
  required,
  disabled,
  error,
  onChange,
}: Props) {
  const { data: municipios = [], isLoading } = useMunicipiosQuery();

  const options = useMemo<SelectOption<string>[]>(
    () => municipios.map((m) => ({ value: m.id, label: m.nome })),
    [municipios],
  );

  const ehOutros = useMemo(
    () => municipios.find((m) => m.id === municipioId)?.eh_outros ?? false,
    [municipios, municipioId],
  );

  return (
    <div className="space-y-3">
      <BaseSelect
        label="Município"
        options={options}
        placeholder={isLoading ? 'Carregando…' : 'Selecione o município'}
        required={required}
        disabled={disabled || isLoading}
        value={municipioId}
        onChange={(v) => onChange(v, ehOutros ? localidade : null)}
        error={error?.municipio_id ?? null}
      />
      {ehOutros && (
        <BaseInput
          label="Localidade"
          placeholder="Comunidade, povoado, cidade fora de RR…"
          required
          disabled={disabled}
          value={localidade ?? ''}
          onChange={(e) => onChange(municipioId, e.target.value)}
          error={error?.localidade ?? null}
          hint="Para 'Outros', informe a localidade livremente."
        />
      )}
    </div>
  );
}
