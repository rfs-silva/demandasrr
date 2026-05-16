import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { StatusSolicitacao } from '@shared/api/types';

import {
  comentarSolicitacao,
  createSolicitacao,
  getSolicitacao,
  listSolicitacaoEventos,
  listSolicitacoes,
  type SolicitacaoCreatePayload,
  type SolicitacaoUpdatePayload,
  type SolicitacoesFilter,
  updateSolicitacao,
  updateStatus,
} from '../api/solicitacoes-api';

const ROOT = 'solicitacoes';

/** As query keys são FLAT, com o filter/id no array (objetos são igualados
 *  estruturalmente pelo TanStack). Toda mudança de filter dispara refetch. */

export function useSolicitacoesQuery(filter: SolicitacoesFilter) {
  return useQuery({
    queryKey: [ROOT, 'list', filter] as const,
    queryFn: ({ signal }) => listSolicitacoes(filter, signal),
    placeholderData: keepPreviousData,
  });
}

export function useSolicitacaoQuery(id: string) {
  return useQuery({
    queryKey: [ROOT, 'detalhe', id] as const,
    queryFn: () => getSolicitacao(id),
    enabled: !!id,
  });
}

export function useSolicitacaoEventosQuery(id: string) {
  return useQuery({
    queryKey: [ROOT, 'eventos', id] as const,
    queryFn: () => listSolicitacaoEventos(id),
    enabled: !!id,
    staleTime: 5_000,
  });
}

function invalidarTudo(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: [ROOT] });
}

function invalidarSolicitacao(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
): void {
  qc.invalidateQueries({ queryKey: [ROOT, 'detalhe', id] });
  qc.invalidateQueries({ queryKey: [ROOT, 'eventos', id] });
}

export function useCreateSolicitacaoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SolicitacaoCreatePayload) => createSolicitacao(payload),
    onSuccess: () => invalidarTudo(qc),
  });
}

export function useUpdateSolicitacaoMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SolicitacaoUpdatePayload }) =>
      updateSolicitacao(id, payload),
    onSuccess: (_data, variables) => {
      invalidarTudo(qc);
      invalidarSolicitacao(qc, variables.id);
    },
  });
}

export function useComentarMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, texto }: { id: string; texto: string }) =>
      comentarSolicitacao(id, texto),
    onSuccess: (_data, variables) => invalidarSolicitacao(qc, variables.id),
  });
}

export function useUpdateStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      parecer,
    }: {
      id: string;
      status: StatusSolicitacao;
      parecer?: string;
    }) => updateStatus(id, status, parecer),
    onSuccess: (_data, variables) => {
      invalidarTudo(qc);
      invalidarSolicitacao(qc, variables.id);
    },
  });
}
