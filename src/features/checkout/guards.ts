import type { QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { fetchCart } from '@/features/cart/api'
import { requireSession } from '@/features/auth/guards'
import { privateKeys } from '@/shared/query-keys'

/**
 * Checkout entry: requires a session (README: checkout needs authentication) and a cart the API
 * considers ready — re-fetched here, never trusted from cache. Empty or with sold-out items →
 * back to the cart, which shows why.
 */
export async function requireCheckoutReadyCart(queryClient: QueryClient, href: string) {
  const { session } = await requireSession(queryClient, href)
  const cart = await queryClient.fetchQuery({
    queryKey: privateKeys.cart(session.user.id),
    queryFn: ({ signal }) => fetchCart(signal),
    staleTime: 0,
  })
  if (!cart.checkoutReady) throw redirect({ to: '/cart' })
  return { session }
}
