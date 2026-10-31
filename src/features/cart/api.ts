import { http } from '@/services/api/http'
import type { AddCartItemRequest, Cart, MergeCartResponse } from '@/shared/contracts'

const itemPath = (nftId: string, editionId: string) => `/cart/items/${encodeURIComponent(nftId)}/${encodeURIComponent(editionId)}`

export async function fetchCart(signal: AbortSignal): Promise<Cart> {
  const { data } = await http.get<Cart>('/cart', { signal })
  return data
}

export async function addCartItem(body: AddCartItemRequest): Promise<Cart> {
  const { data } = await http.post<Cart>('/cart/items', body)
  return data
}

export async function updateCartItem(nftId: string, editionId: string, quantity: number): Promise<Cart> {
  const { data } = await http.patch<Cart>(itemPath(nftId, editionId), { quantity })
  return data
}

export async function removeCartItem(nftId: string, editionId: string): Promise<Cart> {
  const { data } = await http.delete<Cart>(itemPath(nftId, editionId))
  return data
}

/** Sent with the new session's token explicitly: it runs before the session is started in the client. */
export async function mergeGuestCartRequest(guestCartId: string, token: string): Promise<MergeCartResponse> {
  const { data } = await http.post<MergeCartResponse>('/cart/merge', { guestCartId }, { headers: { Authorization: `Bearer ${token}` } })
  return data
}
