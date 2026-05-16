import { apiClient } from '@shared/api/client';
import type {
  ApiEnvelope,
  AreaSolicitacao,
  Solicitacao,
  SolicitacaoEvento,
  StatusSolicitacao,
  UsuarioResumo,
} from '@shared/api/types';

export interface SolicitacoesFilter {
  page: number;
  page_size: number;
  municipio?: string;
  area?: AreaSolicitacao;
  status?: StatusSolicitacao;
  data_de?: string;
  data_ate?: string;
  search?: string;
  /** ID do solicitante. Ignorado para gestor_solicitante (que vê só as suas). */
  usuario_id?: string;
}

export interface TopSolicitante {
  usuario: UsuarioResumo;
  qtd: number;
}

export type TopSolicitantesFilter = Omit<
  SolicitacoesFilter,
  'page' | 'page_size' | 'usuario_id'
> & { limit?: number };

export interface SolicitacaoCreatePayload {
  pessoa_id?: string;
  titulo: string;
  area: AreaSolicitacao;
  descricao: string;
}

export interface SolicitacaoUpdatePayload {
  titulo?: string;
  area?: AreaSolicitacao;
  descricao?: string;
}

export async function listSolicitacoes(
  params: SolicitacoesFilter,
  signal?: AbortSignal,
): Promise<ApiEnvelope<Solicitacao[]>> {
  const r = await apiClient.get<ApiEnvelope<Solicitacao[]>>('/solicitacoes', {
    params,
    signal,
  });
  return r.data;
}

export async function getSolicitacao(id: string): Promise<Solicitacao> {
  const r = await apiClient.get<ApiEnvelope<Solicitacao>>(`/solicitacoes/${id}`);
  return r.data.data;
}

export async function listSolicitacaoEventos(id: string): Promise<SolicitacaoEvento[]> {
  const r = await apiClient.get<ApiEnvelope<SolicitacaoEvento[]>>(
    `/solicitacoes/${id}/eventos`,
  );
  return r.data.data;
}

export async function createSolicitacao(
  payload: SolicitacaoCreatePayload,
): Promise<Solicitacao> {
  const r = await apiClient.post<ApiEnvelope<Solicitacao>>('/solicitacoes', payload);
  return r.data.data;
}

export async function updateSolicitacao(
  id: string,
  payload: SolicitacaoUpdatePayload,
): Promise<Solicitacao> {
  const r = await apiClient.put<ApiEnvelope<Solicitacao>>(`/solicitacoes/${id}`, payload);
  return r.data.data;
}

export async function comentarSolicitacao(
  id: string,
  texto: string,
): Promise<SolicitacaoEvento> {
  const r = await apiClient.post<ApiEnvelope<SolicitacaoEvento>>(
    `/solicitacoes/${id}/comentarios`,
    { texto },
  );
  return r.data.data;
}

export async function updateStatus(
  id: string,
  status: StatusSolicitacao,
  parecer?: string,
): Promise<Solicitacao> {
  const r = await apiClient.patch<ApiEnvelope<Solicitacao>>(
    `/solicitacoes/${id}/status`,
    { status, parecer },
  );
  return r.data.data;
}

export async function listTopSolicitantes(
  params: TopSolicitantesFilter,
): Promise<TopSolicitante[]> {
  const r = await apiClient.get<ApiEnvelope<TopSolicitante[]>>(
    '/solicitacoes/top-solicitantes',
    { params },
  );
  return r.data.data;
}

/** Baixa o CSV das solicitações filtradas. */
export async function exportSolicitacoesCsv(
  params: Omit<SolicitacoesFilter, 'page' | 'page_size'>,
): Promise<void> {
  const r = await apiClient.get<Blob>('/solicitacoes/export', {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `solicitacoes_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
