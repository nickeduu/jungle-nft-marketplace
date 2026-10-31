import { skipToken, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import { currentUserId, useSession } from '@/features/auth/session'
import { ApiError } from '@/services/api/http'
import { guestCartId } from '@/services/api/guest-cart'
import type { AddCartItemRequest, Cart, CartItem } from '@/shared/contracts'
import { addEth, multiplyEth, percentOfEth, subtractEth } from '@/shared/lib/eth'
import { guestCartKeys, privateKeys } from '@/shared/query-keys'
import { addCartItem, applyCoupon, fetchCart, removeCartItem, removeCoupon, updateCartItem } from './api'

/**
 * Cache key of the cart shown right now: the user's (private, keyed by user id) or the visitor's
 * (keyed by the visitor cart id). `null` = visitor without a cart yet (nothing to fetch).
 */
function cartKeyFor(userId: string | null, guestId: string | null) {
  if (userId) return privateKeys.cart(userId)
  if (guestId) return guestCartKeys.cart(guestId)
  return null
}

export function currentCartKey(queryClient: QueryClient) {
  return cartKeyFor(currentUserId(queryClient), guestCartId.get())
}

export function useCart() {
  const { user, isPending: sessionPending } = useSession()
  const guestId = useSyncExternalStore(guestCartId.subscribe, guestCartId.get)
  const key = sessionPending ? null : cartKeyFor(user?.id ?? null, guestId)
  const query = useQuery({
    queryKey: key ?? ['cart', 'none'],
    queryFn: key ? ({ signal }) => fetchCart(signal) : skipToken,
  })
  return {
    data: query.data,
    isError: query.isError,
    refetch: query.refetch,
    // A visitor without a cart id simply has an empty cart (no request).
    isEmptyVisitor: !sessionPending && key === null,
    cartKey: key,
  }
}

/** Units in the cart (header/bottom-nav counter). */
export function useCartCount() {
  const { data } = useCart()
  return data?.itemCount ?? 0
}

/** All cart writes share one scope: TanStack Query runs them one at a time, in click order. */
const CART_SCOPE = { id: 'cart' }
const WRITE_KEY = ['cart', 'write'] as const

export const describeItem = (item: Pick<CartItem, 'name' | 'editionName'>) => `${item.name} (edição ${item.editionName})`

/** Optimistic cart with totals recomputed by the same exact (BigInt) helpers; the API response replaces it. */
function withItems(cart: Cart, items: CartItem[]): Cart {
  const subtotalEth = addEth('0', ...items.map((item) => item.lineTotalEth))
  const discountEth = cart.coupon ? percentOfEth(subtotalEth, cart.coupon.percentOff) : '0'
  const networkFeeEth = items.length > 0 ? cart.networkFeeEth : '0'
  return {
    ...cart,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalEth,
    discountEth,
    networkFeeEth,
    totalEth: addEth(subtractEth(subtotalEth, discountEth), networkFeeEth),
    checkoutReady: items.length > 0 && items.every((item) => item.status === 'ok'),
  }
}

/**
 * Adds an edition to the cart. Not optimistic on purpose: the item appears only once the API
 * accepted it (stock and per-order limit are validated there), so a failure never looks like a
 * success. A visitor gets a cart id on the first add.
 */
export function useAddToCart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: WRITE_KEY,
    scope: CART_SCOPE,
    mutationFn: (body: AddCartItemRequest) => {
      if (!currentUserId(queryClient)) guestCartId.ensure()
      return addCartItem(body)
    },
    onSuccess: (cart) => {
      const key = currentCartKey(queryClient)
      if (key) queryClient.setQueryData(key, cart)
    },
  })
}

interface LineVariables {
  item: CartItem
  /** Cache key when the change was made: callbacks of another session/owner are dropped. */
  cartKey: readonly unknown[]
}

/**
 * Optimistic write shared by quantity changes and removals:
 * 1. onMutate: snapshot + immediate cache change; 2. success: the response of the LAST pending
 * write becomes the cache (earlier ones would be stale); 3. error: rollback + refetch + message.
 */
function useOptimisticLineWrite<V extends LineVariables>(options: {
  request: (variables: V) => Promise<Cart>
  apply: (cart: Cart, variables: V) => Cart
  errorMessage: (variables: V) => string
}) {
  const queryClient = useQueryClient()
  const notify = useFeedback()
  const isLastWrite = () => queryClient.isMutating({ mutationKey: WRITE_KEY }) === 1
  const sameOwner = (cartKey: readonly unknown[]) => JSON.stringify(currentCartKey(queryClient)) === JSON.stringify(cartKey)

  return useMutation({
    mutationKey: WRITE_KEY,
    scope: CART_SCOPE,
    mutationFn: (variables: V) => {
      if (!sameOwner(variables.cartKey)) throw new Error('O carrinho mudou de dono antes do envio.')
      return options.request(variables)
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: variables.cartKey })
      const previous = queryClient.getQueryData<Cart>(variables.cartKey)
      if (previous && sameOwner(variables.cartKey)) queryClient.setQueryData(variables.cartKey, options.apply(previous, variables))
      return { previous }
    },
    onSuccess: (cart, variables) => {
      if (sameOwner(variables.cartKey) && isLastWrite()) queryClient.setQueryData(variables.cartKey, cart)
    },
    onError: (error, variables, context) => {
      if (!sameOwner(variables.cartKey)) return
      if (isLastWrite()) {
        if (context?.previous) queryClient.setQueryData(variables.cartKey, context.previous)
        void queryClient.invalidateQueries({ queryKey: variables.cartKey })
      }
      const reason = error instanceof ApiError && error.status === 409 ? ` ${error.message}` : ''
      notify(`${options.errorMessage(variables)}${reason}`, 'error')
    },
  })
}

export function useUpdateCartQuantity() {
  return useOptimisticLineWrite<LineVariables & { quantity: number }>({
    request: ({ item, quantity }) => updateCartItem(item.nftId, item.editionId, quantity),
    apply: (cart, { item, quantity }) =>
      withItems(
        cart,
        cart.items.map((line) =>
          line.id === item.id
            ? { ...line, quantity, lineTotalEth: multiplyEth(line.unitPriceEth, quantity), quantityAdjustedFrom: null }
            : line,
        ),
      ),
    errorMessage: ({ item }) => `Não foi possível alterar a quantidade de ${describeItem(item)}. A alteração foi desfeita.`,
  })
}

export function useRemoveCartItem() {
  return useOptimisticLineWrite<LineVariables>({
    request: ({ item }) => removeCartItem(item.nftId, item.editionId),
    apply: (cart, { item }) => withItems(cart, cart.items.filter((line) => line.id !== item.id)),
    errorMessage: ({ item }) => `Não foi possível remover ${describeItem(item)}. O item voltou ao carrinho.`,
  })
}

/** Applies (`code`) or removes (`null`) the cart coupon; the discount shows once the API validated it. */
export function useCartCoupon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: WRITE_KEY,
    scope: CART_SCOPE,
    mutationFn: (code: string | null) => (code === null ? removeCoupon() : applyCoupon(code)),
    onSuccess: (cart) => {
      const key = currentCartKey(queryClient)
      if (key) queryClient.setQueryData(key, cart)
    },
  })
}
