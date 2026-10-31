import type { Coupon } from './checkout'
import type { EthDecimal, IsoDateTime } from './common'

/**
 * Cart rules (simulated API, see ARCHITECTURE.md):
 * - One item per NFT + edition (`id` = `${nftId}:${editionId}`); adding the same pair again
 *   increases its quantity, another edition is another item.
 * - Prices are live: `unitPriceEth` is the edition's current price (the cart is not a quote;
 *   the checkout quote freezes prices). Adding to the cart does not reserve stock.
 * - Quantity is limited to `maxQuantity` = min(available, maxPerOrder). When stock drops below
 *   the quantity, the API reduces it and reports it in `quantityAdjustedFrom`; a sold-out item
 *   stays in the cart as `unavailable` and blocks the checkout until removed.
 * - Owner: the signed-in user (session), or a visitor cart identified by the `X-Guest-Cart`
 *   header; the visitor cart is merged into the user's cart on login.
 */
export type CartItemStatus = 'ok' | 'unavailable'

export interface CartItem {
  /** Stable identity: `${nftId}:${editionId}`. */
  id: string
  nftId: string
  editionId: string
  name: string
  imageUrl: string
  collection: string
  tokenId: string
  /** Edition label ("1/50", "Aberta"). */
  editionName: string
  quantity: number
  /** Current price of the edition. */
  unitPriceEth: EthDecimal
  /** unitPriceEth × quantity. */
  lineTotalEth: EthDecimal
  available: number
  maxPerOrder: number
  /** min(available, maxPerOrder): the largest valid quantity right now (0 = sold out). */
  maxQuantity: number
  status: CartItemStatus
  /** Price when the user last added/changed the item, when it differs from the current price. */
  previousPriceEth: EthDecimal | null
  /** Quantity before the API reduced it because stock dropped; cleared when the user changes the item. */
  quantityAdjustedFrom: number | null
}

export interface Cart {
  owner: 'user' | 'guest'
  /** In the order they were added. */
  items: CartItem[]
  /** Total units (header counter). */
  itemCount: number
  subtotalEth: EthDecimal
  /** Coupon applied to the cart (PUT/DELETE /api/cart/coupon); re-validated by the checkout quote. */
  coupon: Coupon | null
  /** subtotal × coupon percentage (rounded down to the wei). */
  discountEth: EthDecimal
  /** Estimated network fee (Ethereum, "Taxa estimada"); the quote uses the chosen network. "0" when empty. */
  networkFeeEth: EthDecimal
  totalEth: EthDecimal
  /** Not empty and every item available. */
  checkoutReady: boolean
  version: number
  updatedAt: IsoDateTime
}

/** POST /api/cart/items */
export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

/** PATCH /api/cart/items/:nftId/:editionId — absolute quantity (≥ 1). */
export interface UpdateCartItemRequest {
  quantity: number
}

/** POST /api/cart/merge — called right after login with the visitor cart id. */
export interface MergeCartRequest {
  guestCartId: string
}

export interface MergeCartResponse {
  cart: Cart
  /** Units that came from the visitor cart (0 = it was empty or unknown). */
  mergedUnits: number
}

/** Header carrying the visitor cart id (a UUID generated on the visitor's first add). */
export const GUEST_CART_HEADER = 'X-Guest-Cart'
