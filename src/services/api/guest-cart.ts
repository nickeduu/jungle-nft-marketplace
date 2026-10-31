/**
 * Visitor cart id (README: the visitor's items are kept and merged into the account on login).
 * A random UUID created on the visitor's first add and sent as `X-Guest-Cart`; the simulated API
 * keeps the cart. Cleared after the merge, so a visitor after logout starts with a new, empty cart.
 * Observable (useSyncExternalStore) because the cart query key depends on it.
 */
const STORAGE_KEY = 'jungle-guest-cart'

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let id: string | null = read()
const listeners = new Set<() => void>()

function set(next: string | null) {
  id = next
  try {
    if (next) localStorage.setItem(STORAGE_KEY, next)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage blocked: the id lives until the tab closes.
  }
  for (const listener of listeners) listener()
}

export const guestCartId = {
  get: (): string | null => id,

  /** Existing id, or a new one (first add of a visitor). */
  ensure(): string {
    if (!id) set(crypto.randomUUID())
    return id as string
  },

  clear: () => set(null),

  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
