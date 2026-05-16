import { apiClient } from '@shared/api/client';
import type {
  ApiEnvelope,
  Perfil,
  Situacao,
  Usuario,
  UsuarioCriado,
} from '@shared/api/types';

export interface UsuariosFilter {
  page: number;
  page_size: number;
  search?: string;
  perfil?: Perfil;
  incluir_inativos?: boolean;
}

export interface UsuarioCreatePayload {
  nome: string;
  login?: string;
  cpf: string;
  municipio_id: string;
  perfil: Perfil;
  localidade?: string | null;
  contato?: string | null;
  data_nascimento?: string | null;
  pode_criar_usuarios?: boolean;
  pode_criar_solicitacoes?: boolean;
  pode_reabrir_solicitacoes?: boolean;
  ver_status_solicitacao?: boolean;
}

export type UsuarioUpdatePayload = Partial<{
  nome: string;
  perfil: Perfil;
  municipio_id: string;
  localidade: string | null;
  contato: string | null;
  data_nascimento: string;
  situacao: Situacao;
  pode_criar_usuarios: boolean;
  pode_criar_solicitacoes: boolean;
  pode_reabrir_solicitacoes: boolean;
  ver_status_solicitacao: boolean;
}>;

export async function listUsuarios(
  params: UsuariosFilter,
  signal?: AbortSignal,
): Promise<ApiEnvelope<Usuario[]>> {
  const r = await apiClient.get<ApiEnvelope<Usuario[]>>('/usuarios', { params, signal });
  return r.data;
}

export async function createUsuario(
  payload: UsuarioCreatePayload,
): Promise<UsuarioCriado> {
  const r = await apiClient.post<ApiEnvelope<UsuarioCriado>>('/usuarios', payload);
  return r.data.data;
}

export async function updateUsuario(
  id: string,
  payload: UsuarioUpdatePayload,
): Promise<Usuario> {
  const r = await apiClient.put<ApiEnvelope<Usuario>>(`/usuarios/${id}`, payload);
  return r.data.data;
}

export async function changeSenha(id: string): Promise<void> {
  await apiClient.patch(`/usuarios/${id}/senha`, {});
}

export async function deleteUsuario(id: string): Promise<void> {
  await apiClient.delete(`/usuarios/${id}`);
}
