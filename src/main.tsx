import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'

async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { startMockWorker } = await import('./mocks/browser')
  await startMockWorker()
}

/**
 * The app is imported only AFTER MSW starts: engine.io-client captures
 * `globalThis.WebSocket` at module evaluation, so importing socket.io-client
 * earlier would bypass the WebSocket interception.
 */
async function bootstrap() {
  await enableMocking()
  const { App } = await import('./app/App')
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Root element #root not found')
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
