/**
 * Plain query-string (de)serialization for TanStack Router.
 * The default serializer JSON-encodes values (quotes around strings like "0.5", encoded
 * brackets for arrays). We keep every value as a raw string — arrays as comma-separated —
 * and let each route's `validateSearch` parse and type it.
 */
export function parseSearch(searchStr: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchStr.startsWith('?') ? searchStr.slice(1) : searchStr))
}

export function stringifySearch(search: Record<string, unknown>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null || value === '' || value === false) continue
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','))
      continue
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      params.set(key, String(value))
    }
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}
