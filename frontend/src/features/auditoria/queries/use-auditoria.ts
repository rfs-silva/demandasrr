import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listAuditoria, type AuditoriaFilter } from '../api/auditoria-api';

export function useAuditoriaQuery(filter: AuditoriaFilter) {
  return useQuery({
    queryKey: ['auditoria', 'list', filter] as const,
    queryFn: ({ signal }) => listAuditoria(filter, signal),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}
