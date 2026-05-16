import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteAnexo, listAnexos, uploadAnexo, type UploadProgress } from '../api/anexos-api';

export function useAnexosQuery(solicitacaoId: string) {
  return useQuery({
    queryKey: ['solicitacoes', 'anexos', solicitacaoId] as const,
    queryFn: () => listAnexos(solicitacaoId),
    enabled: !!solicitacaoId,
    staleTime: 5_000,
  });
}

export function useUploadAnexoMutation(solicitacaoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      onProgress,
    }: {
      file: File;
      onProgress?: (p: UploadProgress) => void;
    }) => uploadAnexo(solicitacaoId, file, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes', 'anexos', solicitacaoId] });
      qc.invalidateQueries({ queryKey: ['solicitacoes', 'detalhe', solicitacaoId] });
      qc.invalidateQueries({ queryKey: ['solicitacoes', 'list'] });
    },
  });
}

export function useDeleteAnexoMutation(solicitacaoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (anexoId: string) => deleteAnexo(solicitacaoId, anexoId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes', 'anexos', solicitacaoId] });
      qc.invalidateQueries({ queryKey: ['solicitacoes', 'list'] });
    },
  });
}
