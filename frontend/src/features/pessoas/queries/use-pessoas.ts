import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  createPessoa,
  deletePessoa,
  getPessoa,
  listPessoas,
  updatePessoa,
  type PessoaCreatePayload,
  type PessoaUpdatePayload,
  type PessoasFilter,
} from '../api/pessoas-api';

const ROOT = 'pessoas';

export function usePessoasQuery(filter: PessoasFilter) {
  return useQuery({
    queryKey: [ROOT, 'list', filter] as const,
    queryFn: ({ signal }) => listPessoas(filter, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePessoaQuery(id: string) {
  return useQuery({
    queryKey: [ROOT, 'detalhe', id] as const,
    queryFn: () => getPessoa(id),
    enabled: !!id,
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: [ROOT] });
}

export function useCreatePessoaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PessoaCreatePayload) => createPessoa(payload),
    onSuccess: () => invalidar(qc),
  });
}

export function useUpdatePessoaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PessoaUpdatePayload }) =>
      updatePessoa(id, payload),
    onSuccess: (_d, variables) => {
      invalidar(qc);
      qc.invalidateQueries({ queryKey: [ROOT, 'detalhe', variables.id] });
    },
  });
}

export function useDeletePessoaMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePessoa(id),
    onSuccess: () => invalidar(qc),
  });
}
