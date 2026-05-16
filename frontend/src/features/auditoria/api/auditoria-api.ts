import { apiClient } from '@shared/api/client';
import type {
  AcaoAudit,
  ApiEnvelope,
  AuditLog,
  EntidadeAudit,
} from '@shared/api/types';

export interface AuditoriaFilter {
  page: number;
  page_size: number;
  acao?: AcaoAudit;
  entidade?: EntidadeAudit;
  actor_id?: string;
  entidade_id?: string;
  search?: string;
}

export async function listAuditoria(
  params: AuditoriaFilter,
  signal?: AbortSignal,
): Promise<ApiEnvelope<AuditLog[]>> {
  const r = await apiClient.get<ApiEnvelope<AuditLog[]>>('/auditoria', {
    params,
    signal,
  });
  return r.data;
}
