import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/services/api/http'

const MAX_RETRIES = 2

/**
 * Cache policy (see ARCHITECTURE.md):
 * - staleTime 30s: realtime events keep hot data fresh; refetch on focus/reconnect covers gaps.
 * - retries only for transient failures (network/5xx); 4xx are final.
 * - mutations never retry automatically (idempotency is handled explicitly per mutation).
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) =>
          failureCount < MAX_RETRIES && (!(error instanceof ApiError) || error.isTransient),
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4_000),
      },
      mutations: { retry: false },
    },
  })
}
