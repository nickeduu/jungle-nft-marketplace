import axios, { isAxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from '@/shared/contracts'

/** Single Axios instance for every REST call. MSW intercepts it at the network layer. */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
})

export type ApiErrorKind = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'UNKNOWN'

/** Normalized error thrown by every API function. */
export class ApiError extends Error {
  readonly status: number | null
  readonly code: ApiErrorKind
  readonly fieldErrors: Record<string, string>

  constructor(code: ApiErrorKind, message: string, status: number | null, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.fieldErrors = fieldErrors
  }

  /** Worth retrying automatically: connectivity problems and 5xx. */
  get isTransient(): boolean {
    return this.status === null || this.status >= 500
  }
}

function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return typeof data === 'object' && data !== null && 'error' in data
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('TIMEOUT', 'A requisição excedeu o tempo limite.', null)
    }
    if (!error.response) {
      return new ApiError('NETWORK_ERROR', 'Falha de conexão. Verifique sua rede.', null)
    }
    const { status, data } = error.response
    if (isApiErrorBody(data)) {
      return new ApiError(data.error.code, data.error.message, status, data.error.fieldErrors)
    }
    return new ApiError('UNKNOWN', `Erro inesperado (HTTP ${status}).`, status)
  }
  return new ApiError('UNKNOWN', 'Erro inesperado.', null)
}

http.interceptors.response.use(undefined, (error: unknown) => Promise.reject(toApiError(error)))
