import { io, WebSocket as WebSocketTransport, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/contracts'

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * engine.io's built-in WebSocket transport captures `globalThis.WebSocket` when its module
 * is evaluated. This subclass resolves it when the connection is opened instead, so the
 * WebSocket patched by MSW is used even if the app bundle was evaluated before the mock
 * worker started (which lets both download in parallel — see main.tsx).
 */
class LateBoundWebSocketTransport extends WebSocketTransport {
  override createSocket(uri: string, protocols: string | string[] | undefined) {
    return protocols ? new globalThis.WebSocket(uri, protocols) : new globalThis.WebSocket(uri)
  }
}

/**
 * Creates the Socket.IO client. WebSocket-only transport: the mock layer
 * (MSW + @mswjs/socket.io-binding) intercepts WebSocket, not HTTP long-polling.
 * The caller owns the lifecycle (connect/disconnect).
 */
export function createRealtimeSocket(): RealtimeSocket {
  return io(import.meta.env.VITE_SOCKET_URL, {
    transports: [LateBoundWebSocketTransport],
    autoConnect: false,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  })
}
