import type { AxiosError } from 'axios';

import type { ApiErrorBody, ApiErrorResponse } from './types';

/**
 * Erro tipado lançado pelo interceptor — sempre carrega payload do backend
 * (code/message/details) e o status HTTP.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export function fromAxiosError(err: AxiosError<ApiErrorResponse>): ApiError {
  const status = err.response?.status ?? 0;
  const body = err.response?.data?.error;
  if (body && typeof body === 'object' && 'code' in body && 'message' in body) {
    return new ApiError(body, status);
  }
  return new ApiError(
    {
      code: status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN_ERROR',
      message: status === 0 ? 'Falha de rede ou servidor indisponível' : err.message,
    },
    status,
  );
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
