import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws, type WebSocketHandlerConnection } from 'msw'
import type { NftUpdatedEvent, Nft, ServerToClientEvents } from '@/shared/contracts'

/**
 * Simulated Socket.IO server.
 *
 * MSW intercepts the WebSocket opened by `socket.io-client` (transport "websocket")
 * and `@mswjs/socket.io-binding` encodes/decodes the Engine.IO/Socket.IO frames.
 *
 * Known gap in the binding (v0.2.0): it fakes the handshake with pingInterval=25s /
 * pingTimeout=5s but never sends pings, so the client would drop the connection
 * ("ping timeout") after ~30s. We send Engine.IO PING packets ("2") ourselves.
 */
const HEARTBEAT_MS = 20_000

const realtime = ws.link(`${import.meta.env.VITE_SOCKET_URL}/*`)

interface ActiveConnection {
  raw: WebSocketHandlerConnection
  io: ReturnType<typeof toSocketIo>
  heartbeat: ReturnType<typeof setInterval>
}

const connections = new Set<ActiveConnection>()

function release(active: ActiveConnection) {
  clearInterval(active.heartbeat)
  connections.delete(active)
}

/**
 * A socket closed while still CONNECTING (e.g. React StrictMode mount/unmount in dev)
 * does not fire the interceptor "close" event, so closed sockets are also pruned here.
 */
function openConnections() {
  for (const active of connections) {
    // The public protocol type omits it, but the runtime connection exposes the intercepted socket.
    // (It is the interceptor's WebSocket override, not a native instance, hence no instanceof.)
    const socket = Reflect.get(active.raw.client, 'socket') as Pick<WebSocket, 'readyState'> | undefined
    if (socket?.readyState === WebSocket.CLOSED) release(active)
  }
  return [...connections]
}

export const socketHandler = realtime.addEventListener('connection', (connection) => {
  const active: ActiveConnection = {
    raw: connection,
    io: toSocketIo(connection),
    heartbeat: setInterval(() => connection.client.send('2'), HEARTBEAT_MS),
  }
  connections.add(active)
  connection.client.addEventListener('close', () => release(active))
})

export function emitToAll<E extends keyof ServerToClientEvents>(event: E, payload: Parameters<ServerToClientEvents[E]>[0]) {
  for (const { io } of openConnections()) {
    io.client.emit(event, payload)
  }
}

export function buildNftUpdatedEvent(nft: Nft): NftUpdatedEvent {
  return {
    eventId: crypto.randomUUID(),
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: nft.updatedAt,
    data: { editions: nft.editions.map(({ id, priceEth, available }) => ({ id, priceEth, available })) },
  }
}

/** Closes every intercepted connection (simulates a network drop; the client auto-reconnects). */
export function disconnectAll() {
  for (const { raw } of openConnections()) {
    raw.client.close()
  }
}

export function connectionCount() {
  return openConnections().length
}
