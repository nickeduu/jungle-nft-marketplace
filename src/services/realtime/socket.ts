import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/contracts'

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/**
 * Creates the Socket.IO client. WebSocket-only transport: the mock layer
 * (MSW + @mswjs/socket.io-binding) intercepts WebSocket, not HTTP long-polling.
 * The caller owns the lifecycle (connect/disconnect).
 */
export function createRealtimeSocket(): RealtimeSocket {
  return io(import.meta.env.VITE_SOCKET_URL, {
    transports: ['websocket'],
    autoConnect: false,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
  })
}
