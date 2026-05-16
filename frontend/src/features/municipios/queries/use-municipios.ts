import { useQuery } from '@tanstack/react-query';

import { listMunicipios } from '../api/municipios-api';

export function useMunicipiosQuery() {
  return useQuery({
    queryKey: ['municipios', 'list'] as const,
    queryFn: listMunicipios,
    staleTime: 60 * 60_000, // 1 hora — municípios mudam quase nunca
  });
}
