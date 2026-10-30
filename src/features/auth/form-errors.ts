import { ApiError } from '@/services/api/http'

export type FieldErrors<K extends string> = Partial<Record<K, string>>

/** Moves focus to the first invalid field (in form order), so keyboard and screen reader users land on it. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}

/** Field errors returned by the API (422/409 `fieldErrors`) restricted to the form's fields. */
export function apiFieldErrors<K extends string>(error: unknown, fields: readonly K[]): FieldErrors<K> {
  if (!(error instanceof ApiError)) return {}
  return Object.fromEntries(fields.flatMap((field) => (error.fieldErrors[field] ? [[field, error.fieldErrors[field]]] : []))) as FieldErrors<K>
}

/** Form-level message for failures that are not about a specific field. */
export function formErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' || error.isTransient) {
      return 'Não foi possível conectar. Verifique sua conexão e tente novamente.'
    }
    return error.message
  }
  return 'Erro inesperado. Tente novamente.'
}
