import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  changeSenha,
  createUsuario,
  deleteUsuario,
  listUsuarios,
  updateUsuario,
  type UsuarioCreatePayload,
  type UsuarioUpdatePayload,
  type UsuariosFilter,
} from '../api/usuarios-api';

const ROOT = 'usuarios';

export function useUsuariosQuery(filter: UsuariosFilter) {
  return useQuery({
    queryKey: [ROOT, 'list', filter] as const,
    queryFn: ({ signal }) => listUsuarios(filter, signal),
    placeholderData: keepPreviousData,
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>): void {
  qc.invalidateQueries({ queryKey: [ROOT] });
}

export function useCreateUsuarioMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UsuarioCreatePayload) => createUsuario(payload),
    onSuccess: () => invalidar(qc),
  });
}

export function useUpdateUsuarioMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UsuarioUpdatePayload }) =>
      updateUsuario(id, payload),
    onSuccess: () => invalidar(qc),
  });
}

export function useChangeSenhaMutation() {
  return useMutation({
    mutationFn: ({ id }: { id: string }) => changeSenha(id),
  });
}

export function useDeleteUsuarioMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUsuario(id),
    onSuccess: () => invalidar(qc),
  });
}
