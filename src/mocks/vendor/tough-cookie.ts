/**
 * Build-time replacement for `tough-cookie` (aliased in vite.config.ts), used only by MSW's
 * cookie store (msw/lib/core/utils/cookieStore). The simulated API authenticates with a
 * header token and no handler reads or sets cookies, so the store is a no-op. This drops
 * tough-cookie and its public-suffix list (tldts) from the mock chunk: ~65 KB gzip of
 * JavaScript that every page evaluated before rendering (ARCHITECTURE.md › Qualidade).
 * Side effect: `request.cookies` in a handler only sees `document.cookie`.
 */
type CookieIndex = Record<string, Record<string, Record<string, unknown>>>

export class Cookie {
  static fromJSON(): Cookie | null {
    return null
  }
  toJSON(): Record<string, never> {
    return {}
  }
}

export class MemoryCookieStore {
  idx: CookieIndex = {}
}

export class CookieJar {
  getCookiesSync(): Cookie[] {
    return []
  }
  async setCookie(): Promise<void> {}
}
