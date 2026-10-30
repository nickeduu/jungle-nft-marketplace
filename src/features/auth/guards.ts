import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { sessionToken } from '@/services/api/session-token'
import type { Session } from '@/shared/contracts'
import { sessionQuery } from './api'

/**
 * `beforeLoad` guard of private routes. The session comes from the API (cached query, fetched on
 * first use), not from a client flag. Visitors go to the login with the requested URL in
 * `redirect`, so they come back to it after signing in.
 */
export async function requireSession(queryClient: QueryClient, href: string): Promise<{ session: Session }> {
  const session = await queryClient.ensureQueryData(sessionQuery())
  if (!session) {
    throw redirect({
      to: '/login',
      search: { redirect: href, reason: sessionToken.takeEndReason() === 'expired' ? 'expired' : undefined },
    })
  }
  return { session }
}
