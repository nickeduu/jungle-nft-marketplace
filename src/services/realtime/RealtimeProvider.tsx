import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { nftKeys } from '@/shared/query-keys'
import { applyNftUpdated, EventDeduper, invalidateNftLists } from './apply-events'
import { createRealtimeSocket } from './socket'

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected'

const RealtimeStatusContext = createContext<RealtimeStatus>('connecting')

/**
 * Owns the Socket.IO connection lifecycle and bridges events into the Query cache.
 * Listeners are removed and the socket closed on unmount.
 * (Next stage: recreate per session so events never cross users.)
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')

  useEffect(() => {
    const socket = createRealtimeSocket()
    const deduper = new EventDeduper()
    let hasConnectedBefore = false

    socket.on('connect', () => {
      setStatus('connected')
      // After a reconnection, events may have been missed: reconcile with REST.
      if (hasConnectedBefore) void queryClient.invalidateQueries({ queryKey: nftKeys.all })
      hasConnectedBefore = true
    })
    socket.on('disconnect', () => setStatus('disconnected'))
    socket.on('nft.updated', (event) => {
      if (!deduper.markFirstSeen(event.eventId)) return
      applyNftUpdated(queryClient, event)
      void invalidateNftLists(queryClient)
    })

    socket.connect()
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [queryClient])

  return <RealtimeStatusContext value={status}>{children}</RealtimeStatusContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRealtimeStatus() {
  return useContext(RealtimeStatusContext)
}
