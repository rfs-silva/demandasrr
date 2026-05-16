import { apiClient } from '@shared/api/client';
import type { ApiEnvelope, Pessoa, Situacao } from '@shared/api/types';

export interface PessoasFilter {
  page: number;
  page_size: number;
  search?: string;
  municipio_id?: string;
  situacao?: Situacao;
}

export interface PessoaCreatePayload {
  nome: string;
  cpf: string;
  data_nascimento: string;
  municipio_id: string;
  localidade?: string | null;
}

export type PessoaUpdatePayload = Partial<{
  nome: string;
  municipio_id: string;
  localidade: string | null;
  data_nascimento: string;
  situacao: Situacao;
}>;

export async function listPessoas(
  params: PessoasFilter,
  signal?: AbortSignal,
): Promise<ApiEnvelope<Pessoa[]>> {
  const r = await apiClient.get<ApiEnvelope<Pessoa[]>>('/pessoas', { params, signal });
  return r.data;
}

export async function getPessoa(id: string): Promise<Pessoa> {
  const r = await apiClient.get<ApiEnvelope<Pessoa>>(`/pessoas/${id}`);
  return r.data.data;
}

export async function createPessoa(payload: PessoaCreatePayload): Promise<Pessoa> {
  const r = await apiClient.post<ApiEnvelope<Pessoa>>('/pessoas', payload);
  return r.data.data;
}

export async function updatePessoa(
  id: string,
  payload: PessoaUpdatePayload,
): Promise<Pessoa> {
  const r = await apiClient.put<ApiEnvelope<Pessoa>>(`/pessoas/${id}`, payload);
  return r.data.data;
}

export async function deletePessoa(id: string): Promise<void> {
  await apiClient.delete(`/pessoas/${id}`);
}
