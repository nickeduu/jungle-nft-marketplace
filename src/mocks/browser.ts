import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { getActiveScenarioName, initScenarioFromUrl } from './scenarios'

export const worker = setupWorker(...handlers)

export async function startMockWorker() {
  initScenarioFromUrl()
  await worker.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    // Assets, fonts and Vite internals pass through silently; unknown API calls are flagged.
    onUnhandledRequest(request, print) {
      if (new URL(request.url).pathname.startsWith(import.meta.env.VITE_API_BASE_URL)) print.warning()
    },
    quiet: import.meta.env.PROD,
  })
  console.info(`[mocks] MSW active — scenario "${getActiveScenarioName()}"`)
}
