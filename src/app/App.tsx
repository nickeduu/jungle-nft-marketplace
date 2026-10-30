import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { FeedbackProvider } from '@/components/feedback/FeedbackProvider'
import { sessionQuery } from '@/features/auth/api'
import { RealtimeProvider } from '@/services/realtime/RealtimeProvider'
import { createQueryClient } from './providers/query-client'
import { createAppRouter } from './router/router'

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

if (import.meta.env.VITE_ENABLE_MOCKS === 'true') {
  // Mock/demo builds only: read-only list of cached query keys, so E2E tests can verify that
  // private data is gone after logout (the client itself is not exposed).
  Object.assign(window, {
    __jungleQueryKeys: () => queryClient.getQueryCache().getAll().filter((q) => q.state.data !== undefined).map((q) => q.queryKey),
  })
}

/** The realtime socket follows the session (one connection per signed-in user or visitor). */
function SessionRealtime({ children }: { children: ReactNode }) {
  const session = useQuery(sessionQuery())
  return (
    <RealtimeProvider
      session={{ resolved: !session.isPending, token: session.data?.token ?? null, userId: session.data?.user.id ?? null }}
    >
      {children}
    </RealtimeProvider>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <SessionRealtime>
          <RouterProvider router={router} />
        </SessionRealtime>
      </FeedbackProvider>
    </QueryClientProvider>
  )
}
