import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { nftKeys, privateKeys } from '@/shared/query-keys'
import {
  applyFavoritesUpdated,
  applyNftUpdated,
  applyOrderUpdated,
  EventDeduper,
  invalidateCarts,
  invalidateCartsWith,
  invalidateNftLists,
} from './apply-events'
import { createRealtimeSocket } from './socket'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

const RealtimeStatusContext = createContext<RealtimeStatus>('connecting')

export interface RealtimeSession {
  /** False while a stored token is still being validated: no socket is opened yet. */
  resolved: boolean
  token: string | null
  userId: string | null
}

/**
 * Owns the Socket.IO connection lifecycle and bridges events into the Query cache.
 *
 * One socket per session: the connection is created with the session token in the handshake
 * (`auth.token`; visitors connect without one and get public events only). When the session
 * changes (login, logout, expiry, another user) the previous socket is closed — its listeners,
 * deduper and pending events go with it — and a new one is opened for the new session.
 * Listeners are removed and the socket closed on unmount.
 */
export function RealtimeProvider({ session, children }: { session: RealtimeSession; children: ReactNode }) {
  const queryClient = useQueryClient()
  const { resolved: sessionResolved, token, userId } = session
  // The status belongs to the socket of one session: a new session starts at "connecting".
  const sessionKey = `${sessionResolved}:${token ?? 'visitor'}`
  const [reported, setReported] = useState<{ sessionKey: string; status: RealtimeStatus }>({ sessionKey, status: 'connecting' })
  const status = reported.sessionKey === sessionKey ? reported.status : 'connecting'

  useEffect(() => {
    if (!sessionResolved) return
    const socket = createRealtimeSocket({ token })
    const deduper = new EventDeduper()
    let hasConnectedBefore = false
    const setStatus = (next: RealtimeStatus) => setReported({ sessionKey, status: next })

    socket.on('connect', () => {
      setStatus('connected')
      // Private events emitted before this session's socket was authenticated (e.g. an order the
      // mock settled right after a reload) never reached it: reconcile the user's orders now.
      if (userId) void queryClient.invalidateQueries({ queryKey: privateKeys.orders(userId) })
      // After a reconnection, events may have been missed: reconcile with REST.
      if (hasConnectedBefore) {
        void queryClient.invalidateQueries({ queryKey: nftKeys.all })
        if (userId) void queryClient.invalidateQueries({ queryKey: privateKeys.user(userId) })
        void invalidateCarts(queryClient)
      }
      hasConnectedBefore = true
    })
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('nft.updated', (event) => {
      if (!deduper.markFirstSeen(event.eventId)) return
      applyNftUpdated(queryClient, event)
      void invalidateNftLists(queryClient)
      void invalidateCartsWith(queryClient, event.resource.id)
    })
    socket.on('favorites.updated', (event) => {
      if (!deduper.markFirstSeen(event.eventId)) return
      applyFavoritesUpdated(queryClient, event, userId)
    })
    socket.on('order.updated', (event) => {
      if (!deduper.markFirstSeen(event.eventId)) return
      applyOrderUpdated(queryClient, event, userId)
    })

    socket.connect()
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [queryClient, sessionKey, sessionResolved, token, userId])

  return <RealtimeStatusContext value={status}>{children}</RealtimeStatusContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRealtimeStatus() {
  return useContext(RealtimeStatusContext)
}
