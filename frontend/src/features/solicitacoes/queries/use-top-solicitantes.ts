import { useQuery } from '@tanstack/react-query';

import {
  listTopSolicitantes,
  type TopSolicitantesFilter,
} from '../api/solicitacoes-api';

/**
 * Ranking de quem mais abriu demandas no recorte de filtro atual.
 * Renderizado no painel gerencial — não roda para gestor_solicitante.
 */
export function useTopSolicitantesQuery(
  filters: TopSolicitantesFilter,
  enabled = true,
) {
  return useQuery({
    queryKey: ['solicitacoes', 'top-solicitantes', filters] as const,
    queryFn: () => listTopSolicitantes(filters),
    enabled,
    staleTime: 30_000,
  });
}
