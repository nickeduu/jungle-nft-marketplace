import { useMutation, useQueryClient } from '@tanstack/react-query'
import { login, logout, register } from './api'
import { endSession, startSession } from './session'

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: login,
    onSuccess: (session) => startSession(queryClient, session),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: register,
    onSuccess: (session) => startSession(queryClient, session),
  })
}

/**
 * Ends the session on the API, then locally. If the request fails (offline), the local session
 * still ends: private data must not stay visible because the network is down.
 */
export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await logout()
      } catch {
        // The token is discarded below either way; the server session then just expires.
      }
    },
    onSettled: () => endSession(queryClient, 'logout'),
  })
}
