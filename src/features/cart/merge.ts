import type { QueryClient } from '@tanstack/react-query'
import { guestCartId } from '@/services/api/guest-cart'
import type { Cart, Session } from '@/shared/contracts'
import { guestCartKeys } from '@/shared/query-keys'
import { mergeGuestCartRequest } from './api'

/** `merged` = the visitor had items and they are now in the account's cart. */
export type GuestCartMerge = { result: 'none' | 'failed'; cart?: undefined } | { result: 'merged' | 'empty'; cart: Cart }

/**
 * Called right after sign-in/registration, BEFORE the session is exposed to the UI: moves the
 * visitor's cart into the user's cart on the API (README: "preservar os itens do visitante ao
 * autenticar"). Doing it first means no screen can read the user's cart before the merge
 * (a read started earlier would return the pre-merge cart and could win the cache).
 * On failure the visitor cart id is kept, so the items are not lost and the next login retries.
 */
export async function mergeGuestCart(queryClient: QueryClient, session: Session): Promise<GuestCartMerge> {
  const id = guestCartId.get()
  if (!id) return { result: 'none' }
  try {
    const { cart, mergedUnits } = await mergeGuestCartRequest(id, session.token)
    guestCartId.clear()
    queryClient.removeQueries({ queryKey: guestCartKeys.all })
    return { result: mergedUnits > 0 ? 'merged' : 'empty', cart }
  } catch {
    return { result: 'failed' }
  }
}
