/**
 * The only piece of the session kept on the client: the opaque bearer token.
 * Whether the user is signed in is always answered by the API (`GET /api/auth/session`),
 * never by this value alone. `endReason` lets the login screen explain why it was shown.
 */
const STORAGE_KEY = 'jungle-session-token'

export type SessionEndReason = 'expired' | 'logout'

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

let token: string | null = read()
let endReason: SessionEndReason | null = null

export const sessionToken = {
  /** localStorage key (other tabs listen to its changes). */
  storageKey: STORAGE_KEY,

  get(): string | null {
    return token
  },

  set(next: string) {
    token = next
    endReason = null
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage blocked: the session lasts until the tab is closed.
    }
  },

  clear(reason: SessionEndReason) {
    token = null
    endReason = reason
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Nothing persisted.
    }
  },

  /** Re-reads storage (another tab signed in or out). */
  sync() {
    token = read()
  },

  /** Why the last session ended; read once by the login redirect. */
  takeEndReason(): SessionEndReason | null {
    const reason = endReason
    endReason = null
    return reason
  },
}
