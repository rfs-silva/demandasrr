import { apiClient } from '@shared/api/client';
import type { ApiEnvelope, Municipio } from '@shared/api/types';

export async function listMunicipios(): Promise<Municipio[]> {
  const r = await apiClient.get<ApiEnvelope<Municipio[]>>('/municipios');
  return r.data.data;
}
