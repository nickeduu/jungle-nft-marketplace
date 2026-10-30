import type { EthDecimal, IsoDateTime } from './common'

export interface CartItem {
  nftId: string
  editionId: string
  quantity: number
  /** Current unit price from the catalog (not a quote). */
  unitPriceEth: EthDecimal
  /** Current availability; the UI flags items whose quantity exceeds it. */
  available: number
  nftVersion: number
}

export interface Cart {
  /** `guest:<uuid>` for visitors, user id for authenticated users. */
  ownerId: string
  items: CartItem[]
  couponCode: string | null
  version: number
  updatedAt: IsoDateTime
}

export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

/** POST /api/cart/merge — called right after login with the guest cart id. */
export interface MergeCartRequest {
  guestCartId: string
}
