import './styles/index.css'

/**
 * The mock worker and the app (React included) download in parallel; the app is rendered
 * only after MSW is active, so no request or socket can bypass the mocks.
 * Evaluating the app before MSW patches WebSocket is safe: the Socket.IO transport resolves
 * `globalThis.WebSocket` at connect time (services/realtime/socket.ts), and connections are
 * only opened after render.
 */
const mocksReady =
  import.meta.env.VITE_ENABLE_MOCKS === 'true'
    ? import('./mocks/browser').then(({ startMockWorker }) => startMockWorker())
    : Promise.resolve()

async function bootstrap() {
  const [, { mount }] = await Promise.all([mocksReady, import('./app/mount')])
  const rootElement = document.getElementById('root')
  if (!rootElement) throw new Error('Root element #root not found')
  mount(rootElement)
}

void bootstrap()
