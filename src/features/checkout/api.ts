import { queryOptions } from '@tanstack/react-query'
import { http } from '@/services/api/http'
import type { CreateOrderRequest, Network, Order, OrderSummary, Quote } from '@/shared/contracts'
import { privateKeys } from '@/shared/query-keys'

/** Order creation must not hang: past this the result is "unknown" and the same attempt is resent. */
export const ORDER_REQUEST_TIMEOUT_MS = 5_000

/** The quote is re-priced on every visit (staleTime 0) and whenever an NFT changes (realtime). */
export const quoteQuery = (userId: string, network: Network) =>
  queryOptions({
    queryKey: privateKeys.quote(userId, network),
    queryFn: async () => (await http.post<Quote>('/quotes', { network })).data,
    staleTime: 0,
  })

export const orderQuery = (userId: string, orderId: string) =>
  queryOptions({
    queryKey: privateKeys.order(userId, orderId),
    queryFn: async ({ signal }) => (await http.get<Order>(`/orders/${encodeURIComponent(orderId)}`, { signal })).data,
  })

export const pendingOrdersQuery = (userId: string) =>
  queryOptions({
    queryKey: [...privateKeys.orders(userId), 'pending'],
    queryFn: async ({ signal }) => (await http.get<OrderSummary[]>('/orders', { params: { status: 'pending' }, signal })).data,
  })

export async function createOrder(body: CreateOrderRequest, idempotencyKey: string): Promise<Order> {
  const { data } = await http.post<Order>('/orders', body, {
    headers: { 'Idempotency-Key': idempotencyKey },
    timeout: ORDER_REQUEST_TIMEOUT_MS,
  })
  return data
}

/**
 * One purchase attempt = one Idempotency-Key, stored with its body BEFORE sending (localStorage,
 * per user), so a lost answer (timeout, network, reload, closed tab) is recovered by resending the
 * very same request: the API returns the order it already created instead of a new one.
 * Cleared once the API answered definitively (order received, or a refusal that created nothing).
 */
export interface CheckoutAttempt {
  key: string
  body: CreateOrderRequest
}

const storageKey = (userId: string) => `jungle-checkout-attempt:${userId}`

export const checkoutAttempt = {
  get(userId: string): CheckoutAttempt | null {
    try {
      const raw = localStorage.getItem(storageKey(userId))
      return raw ? (JSON.parse(raw) as CheckoutAttempt) : null
    } catch {
      return null
    }
  },
  /** Same body → the same key (repeated clicks/resends); another body → a new attempt. */
  for(userId: string, body: CreateOrderRequest): CheckoutAttempt {
    const current = checkoutAttempt.get(userId)
    const attempt = current && JSON.stringify(current.body) === JSON.stringify(body) ? current : { key: crypto.randomUUID(), body }
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(attempt))
    } catch {
      // Storage blocked: the key still protects repeated clicks within this page.
    }
    return attempt
  },
  clear(userId: string) {
    try {
      localStorage.removeItem(storageKey(userId))
    } catch {
      // Nothing stored.
    }
  },
}
