import type { Page } from '@playwright/test'

/**
 * Calls the MSW control endpoints from inside the page, so the request goes through
 * the same Service Worker / mock store the app uses.
 *
 * No retries on purpose. A network-level failure ("Failed to fetch") was seen once in
 * ~230 runs; to diagnose it instead of masking it, the error carries the Service Worker
 * state at failure time (controller present? state?) and the endpoint that failed.
 */
export async function mockControl(page: Page, path: string, body?: unknown) {
  const result = await page.evaluate(
    async ({ path, body }) => {
      try {
        const res = await fetch(`/api/__mock${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body === undefined ? null : JSON.stringify(body),
        })
        return { ok: true as const, status: res.status, json: res.status === 204 ? null : ((await res.json()) as unknown) }
      } catch (error) {
        const controller = navigator.serviceWorker.controller
        return {
          ok: false as const,
          error: String(error),
          swControlled: Boolean(controller),
          swState: controller?.state ?? null,
          visibility: document.visibilityState,
        }
      }
    },
    { path, body },
  )
  if (!result.ok) {
    throw new Error(`mockControl ${path} failed: ${JSON.stringify(result)}`)
  }
  return { status: result.status, json: result.json }
}
