import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { setUnauthorizedHandler } from '@/services/api/http'
import { sessionToken } from '@/services/api/session-token'
import { authKeys, privateKeys } from '@/shared/query-keys'
import { endSession } from './session'

/**
 * Keeps the client session in line with the API:
 * - a 401 for the current token (expired/ended session) ends it locally, tells the user, and
 *   re-runs the route guards — a private page then redirects to the login with `redirect`, so
 *   the user resumes where they were; public pages just continue as visitor;
 * - signing in/out in another tab (localStorage event) is reflected here.
 */
export function SessionSync() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const notify = useFeedback()

  useEffect(() => {
    setUnauthorizedHandler(({ code }) => {
      endSession(queryClient, 'expired')
      notify(
        code === 'SESSION_EXPIRED' ? 'Sua sessão expirou. Entre novamente para continuar.' : 'Sua sessão foi encerrada. Entre novamente.',
        'info',
      )
      void router.invalidate()
    })

    const onStorage = (event: StorageEvent) => {
      if (event.key !== sessionToken.storageKey) return
      sessionToken.sync()
      if (sessionToken.get()) {
        queryClient.removeQueries({ queryKey: privateKeys.all })
        void queryClient.refetchQueries({ queryKey: authKeys.session() })
      } else {
        endSession(queryClient, 'logout')
      }
      void router.invalidate()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      setUnauthorizedHandler(null)
      window.removeEventListener('storage', onStorage)
    }
  }, [queryClient, router, notify])

  return null
}
