import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { RealtimeProvider } from '@/services/realtime/RealtimeProvider'
import { createQueryClient } from './providers/query-client'
import { createAppRouter } from './router/router'

const queryClient = createQueryClient()
const router = createAppRouter(queryClient)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <RouterProvider router={router} />
      </RealtimeProvider>
    </QueryClientProvider>
  )
}
