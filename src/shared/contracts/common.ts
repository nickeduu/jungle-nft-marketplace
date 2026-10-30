/**
 * ETH amount serialized as a decimal string (e.g. "0.25", "12.000000000000000001").
 * Never convert to `number` for arithmetic — use helpers in `@/shared/lib/eth`.
 */
export type EthDecimal = string

/** ISO-8601 timestamp. */
export type IsoDateTime = string

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'AVAILABILITY_CONFLICT'
  | 'PRICE_CHANGED'
  | 'QUOTE_EXPIRED'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PAYMENT_REJECTED'
  | 'TRANSIENT_FAILURE'

/** Error body returned by every REST endpoint on 4xx/5xx. */
export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Field-level messages for form validation (field path → message). */
    fieldErrors?: Record<string, string>
  }
}
