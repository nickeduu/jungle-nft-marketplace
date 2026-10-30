import type { Page } from '@playwright/test'

declare global {
  interface Window {
    __realtimeTransitions?: string[]
  }
}

/**
 * Records every change of the realtime status badge. Polling assertions can miss
 * a short disconnect/reconnect window; a MutationObserver cannot.
 */
export async function recordRealtimeTransitions(page: Page) {
  await page.evaluate(() => {
    const badge = document.querySelector('[data-testid="realtime-status"]')
    if (!badge) throw new Error('realtime-status badge not found')
    window.__realtimeTransitions = []
    new MutationObserver(() => {
      window.__realtimeTransitions?.push(badge.getAttribute('data-status') ?? '')
    }).observe(badge, { attributes: true, attributeFilter: ['data-status'] })
  })
  return () => page.evaluate(() => window.__realtimeTransitions ?? [])
}
