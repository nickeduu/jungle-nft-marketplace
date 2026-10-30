import axios, { isAxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from '@/shared/contracts'
import { sessionToken } from './session-token'

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

/** Authenticated requests carry the session token; the API resolves the user from it. */
http.interceptors.request.use((config) => {
  const token = sessionToken.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

type UnauthorizedHandler = (info: { token: string; code: ApiErrorKind }) => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Registered by the session layer: called when the API rejects the token a request was sent with. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

http.interceptors.response.use(undefined, (error: unknown) => {
  const apiError = toApiError(error)
  if (apiError.status === 401 && isAxiosError(error)) {
    const sent = String(error.config?.headers?.get?.('Authorization') ?? '')
    const token = sent.startsWith('Bearer ') ? sent.slice('Bearer '.length) : null
    // A late 401 for a previous session (e.g. after logout + login as someone else) is ignored:
    // only a rejection of the current token ends the session.
    if (token && token === sessionToken.get()) onUnauthorized?.({ token, code: apiError.code })
  }
  return Promise.reject(apiError)
})
