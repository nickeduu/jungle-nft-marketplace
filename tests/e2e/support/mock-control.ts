import type { Page } from '@playwright/test'

/**
 * Calls the MSW control endpoints from inside the page, so the request goes through
 * the same Service Worker / mock store the app uses.
 */
export async function mockControl(page: Page, path: string, body?: unknown) {
  return page.evaluate(
    async ({ path, body }) => {
      const res = await fetch(`/api/__mock${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? null : JSON.stringify(body),
      })
      return { status: res.status, json: res.status === 204 ? null : ((await res.json()) as unknown) }
    },
    { path, body },
  )
}
