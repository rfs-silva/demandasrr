import { apiClient } from '@shared/api/client';
import type { Anexo, ApiEnvelope } from '@shared/api/types';

export interface UploadProgress {
  loaded: number;
  total: number;
}

export async function listAnexos(solicitacaoId: string): Promise<Anexo[]> {
  const r = await apiClient.get<ApiEnvelope<Anexo[]>>(
    `/solicitacoes/${solicitacaoId}/anexos`,
  );
  return r.data.data;
}

export async function uploadAnexo(
  solicitacaoId: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<Anexo> {
  const form = new FormData();
  form.append('arquivo', file);
  const r = await apiClient.post<ApiEnvelope<Anexo>>(
    `/solicitacoes/${solicitacaoId}/anexos`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (ev) => {
        if (onProgress && ev.total) {
          onProgress({ loaded: ev.loaded, total: ev.total });
        }
      },
    },
  );
  return r.data.data;
}

export async function deleteAnexo(
  solicitacaoId: string,
  anexoId: string,
): Promise<void> {
  await apiClient.delete(`/solicitacoes/${solicitacaoId}/anexos/${anexoId}`);
}

/** Download via fetch para preservar binário; devolve URL temporária do blob. */
export async function downloadAnexo(
  solicitacaoId: string,
  anexoId: string,
  filename: string,
): Promise<void> {
  const r = await apiClient.get<Blob>(
    `/solicitacoes/${solicitacaoId}/anexos/${anexoId}/download`,
    { responseType: 'blob' },
  );
  const url = URL.createObjectURL(r.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
