/** `?redirect=` and `?reason=` of /login and /register. */
// `| undefined` lets navigation remove a key explicitly (exactOptionalPropertyTypes).
export interface AuthSearch {
  redirect?: string | undefined
  reason?: 'expired' | undefined
}

/**
 * Only same-origin paths are accepted ("/favorites?x=1"): an absolute or protocol-relative URL
 * ("https://…", "//evil.example") would turn the login into an open redirect.
 */
export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined
  if (value.startsWith('/login') || value.startsWith('/register')) return undefined
  return value.slice(0, 500)
}

export function validateAuthSearch(raw: Record<string, unknown>): AuthSearch {
  // Every key is returned (see validateCatalogSearch): the router merges raw and validated search.
  return {
    redirect: safeRedirect(raw.redirect),
    reason: raw.reason === 'expired' ? 'expired' : undefined,
  }
}
