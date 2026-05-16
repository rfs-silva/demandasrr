import { useQuery } from '@tanstack/react-query';

import type { StatusSolicitacao } from '@shared/api/types';

import { listSolicitacoes, type SolicitacoesFilter } from '../api/solicitacoes-api';

type CountsFilter = Omit<SolicitacoesFilter, 'page' | 'page_size' | 'status'>;

/**
 * Contagem de solicitações por status — 6 chamadas paralelas com `page_size=1`
 * pegando só `meta.total`. Mesma estratégia leve do Vue antigo.
 * Os filtros não-status (município, área, datas, search) são aplicados em todos.
 */
async function fetchCounts(filters: CountsFilter) {
  const base = { ...filters, page: 1, page_size: 1 } as const;
  const make = (status: StatusSolicitacao) => listSolicitacoes({ ...base, status });

  const [cad, an, at, ind, can, all] = await Promise.all([
    make('cadastrada'),
    make('em_analise'),
    make('atendida'),
    make('indeferida'),
    make('cancelada'),
    listSolicitacoes(base),
  ]);

  return {
    cadastrada: cad.meta?.total ?? 0,
    em_analise: an.meta?.total ?? 0,
    atendida: at.meta?.total ?? 0,
    indeferida: ind.meta?.total ?? 0,
    cancelada: can.meta?.total ?? 0,
    todas: all.meta?.total ?? 0,
  };
}

export function useStatusCountsQuery(filters: CountsFilter, enabled = true) {
  return useQuery({
    queryKey: ['solicitacoes', 'counts', filters] as const,
    queryFn: () => fetchCounts(filters),
    enabled,
    staleTime: 10_000,
  });
}
