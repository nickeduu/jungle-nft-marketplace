import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws, type WebSocketHandlerConnection } from 'msw'
import { sessionsTable } from '@/mocks/store/db'
import type { FavoritesUpdatedEvent, NftUpdatedEvent, Nft, Order, OrderUpdatedEvent, RealtimeAuth, ServerToClientEvents } from '@/shared/contracts'

/**
 * Simulated Socket.IO server.
 *
 * MSW intercepts the WebSocket opened by `socket.io-client` (transport "websocket")
 * and `@mswjs/socket.io-binding` encodes/decodes the Engine.IO/Socket.IO frames.
 *
 * Known gap in the binding (v0.2.0): it fakes the handshake with pingInterval=25s /
 * pingTimeout=5s but never sends pings, so the client would drop the connection
 * ("ping timeout") after ~30s. We send Engine.IO PING packets ("2") ourselves.
 *
 * Sessions: the binding acknowledges the Socket.IO CONNECT by itself and does not expose the
 * client's `auth` payload, so the raw CONNECT frame (`40{"token":"…"}`) is read here to bind
 * the connection to its session token. Public events go to every connection; private events
 * only to connections whose token is, at emit time, a valid session of the target user.
 */
const HEARTBEAT_MS = 20_000

const realtime = ws.link(`${import.meta.env.VITE_SOCKET_URL}/*`)

interface ActiveConnection {
  raw: WebSocketHandlerConnection
  io: ReturnType<typeof toSocketIo>
  heartbeat: ReturnType<typeof setInterval>
  /** Session token sent in the Socket.IO CONNECT packet (`auth.token`); null = visitor. */
  token: string | null
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

/** Engine.IO "4" (message) + Socket.IO "0" (CONNECT) on the default namespace, optional JSON auth. */
function readConnectAuth(data: unknown): RealtimeAuth | null {
  if (typeof data !== 'string' || !data.startsWith('40')) return null
  try {
    const auth = JSON.parse(data.slice(2) || '{}') as Partial<RealtimeAuth>
    return { token: typeof auth.token === 'string' ? auth.token : null }
  } catch {
    return { token: null }
  }
}

export const socketHandler = realtime.addEventListener('connection', (connection) => {
  const active: ActiveConnection = {
    raw: connection,
    io: toSocketIo(connection),
    heartbeat: setInterval(() => connection.client.send('2'), HEARTBEAT_MS),
    token: null,
  }
  connections.add(active)
  connection.client.addEventListener('message', (event) => {
    const auth = readConnectAuth(event.data)
    if (auth) active.token = auth.token
  })
  connection.client.addEventListener('close', () => release(active))
})

/** Public events (catalog changes): every connection, visitors included. */
export function emitToAll<E extends keyof ServerToClientEvents>(event: E, payload: Parameters<ServerToClientEvents[E]>[0]) {
  for (const { io } of openConnections()) {
    io.client.emit(event, payload)
  }
}

/** Private events: only connections authenticated as `userId` with a session still valid now. */
export function emitToUser<E extends keyof ServerToClientEvents>(
  userId: string,
  event: E,
  payload: Parameters<ServerToClientEvents[E]>[0],
): number {
  let delivered = 0
  for (const { io, token } of openConnections()) {
    const lookup = sessionsTable.lookup(token)
    if (lookup.status !== 'valid' || lookup.session.userId !== userId) continue
    io.client.emit(event, payload)
    delivered += 1
  }
  return delivered
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

export function buildFavoritesUpdatedEvent(userId: string, favorites: { nftIds: string[]; version: number }): FavoritesUpdatedEvent {
  return {
    eventId: crypto.randomUUID(),
    resource: { type: 'favorites', id: userId },
    version: favorites.version,
    occurredAt: new Date().toISOString(),
    data: { nftIds: favorites.nftIds },
  }
}

export function buildOrderUpdatedEvent(order: Pick<Order, 'id' | 'status' | 'txHash' | 'rejectionReason' | 'version' | 'updatedAt'>): OrderUpdatedEvent {
  return {
    eventId: crypto.randomUUID(),
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: order.updatedAt,
    data: { status: order.status, txHash: order.txHash, rejectionReason: order.rejectionReason },
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

/** Control endpoint / tests: which user each open connection is bound to (null = visitor or invalid session). */
export function describeConnections(): Array<{ userId: string | null }> {
  return openConnections().map(({ token }) => {
    const lookup = sessionsTable.lookup(token)
    return { userId: lookup.status === 'valid' ? lookup.session.userId : null }
  })
}
