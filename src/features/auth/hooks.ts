import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { mergeGuestCart, type GuestCartMerge } from '@/features/cart/merge'
import type { LoginRequest, RegisterRequest, Session } from '@/shared/contracts'
import { privateKeys } from '@/shared/query-keys'
import { login, logout, register } from './api'
import { endSession, startSession } from './session'

export interface SignInResult {
  session: Session
  /** Outcome of moving the visitor's cart into the account (README: keep the visitor's items). */
  guestCart: GuestCartMerge['result']
}

/**
 * Merges the visitor cart first, then starts the session in the client with the merged cart
 * already cached: the first screen of the session never sees the pre-merge cart.
 */
async function signIn(queryClient: QueryClient, session: Session): Promise<SignInResult> {
  const merge = await mergeGuestCart(queryClient, session)
  startSession(queryClient, session)
  if (merge.cart) queryClient.setQueryData(privateKeys.cart(session.user.id), merge.cart)
  return { session, guestCart: merge.result }
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: LoginRequest) => signIn(queryClient, await login(body)),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: RegisterRequest) => signIn(queryClient, await register(body)),
  })
}

/** Feedback for the visitor-cart merge after signing in. */
export function guestCartMessage(result: GuestCartMerge['result']): { message: string; tone: 'success' | 'error' } | null {
  if (result === 'merged') return { message: 'Os itens do seu carrinho de visitante foram mantidos na sua conta.', tone: 'success' }
  if (result === 'failed') {
    return { message: 'Não foi possível transferir o carrinho de visitante agora. Os itens continuam salvos para a próxima tentativa.', tone: 'error' }
  }
  return null
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
