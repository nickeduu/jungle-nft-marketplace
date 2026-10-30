import { useQuery, type QueryClient } from '@tanstack/react-query'
import { sessionToken, type SessionEndReason } from '@/services/api/session-token'
import type { Session } from '@/shared/contracts'
import { authKeys, privateKeys } from '@/shared/query-keys'
import { sessionQuery } from './api'

/**
 * Session lifecycle — the only place that switches users in the client.
 * Private cache entries are keyed by user id (privateKeys) and dropped as a group whenever the
 * session starts or ends, so nothing of user A is ever served while B is signed in. The realtime
 * socket follows the session query (RealtimeProvider recreates it with the new token).
 */
export function startSession(queryClient: QueryClient, session: Session) {
  void queryClient.cancelQueries({ queryKey: privateKeys.all })
  queryClient.removeQueries({ queryKey: privateKeys.all })
  sessionToken.set(session.token)
  queryClient.setQueryData(authKeys.session(), session)
}

export function endSession(queryClient: QueryClient, reason: SessionEndReason) {
  sessionToken.clear(reason)
  void queryClient.cancelQueries({ queryKey: privateKeys.all })
  queryClient.removeQueries({ queryKey: privateKeys.all })
  queryClient.setQueryData(authKeys.session(), null)
}

/** Id of the user signed in right now (read at call time: async callbacks use it to drop stale work). */
export function currentUserId(queryClient: QueryClient): string | null {
  return queryClient.getQueryData<Session | null>(authKeys.session())?.user.id ?? null
}

export function useSession() {
  const query = useQuery(sessionQuery())
  return {
    session: query.data ?? null,
    user: query.data?.user ?? null,
    /** True while a stored token is being validated (avoid flashing "Entrar"). */
    isPending: query.isPending,
  }
}
