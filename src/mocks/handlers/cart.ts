import { http, HttpResponse } from 'msw'
import { applyScenario, errorResponse } from '@/mocks/scenarios'
import { cartsTable, nftsTable, type CartRecord, type StoredCartItem } from '@/mocks/store/db'
import {
  GUEST_CART_HEADER,
  type AddCartItemRequest,
  type Cart,
  type CartItem,
  type MergeCartRequest,
  type MergeCartResponse,
  type UpdateCartItemRequest,
} from '@/shared/contracts'
import { addEth, compareEth, multiplyEth } from '@/shared/lib/eth'
import { authenticate, bearerToken } from './auth'

const base = import.meta.env.VITE_API_BASE_URL

/** Figma "Taxa estimada" (desktop-03 / mobile-03). The checkout quote computes the real fee per network. */
export const ESTIMATED_NETWORK_FEE_ETH = '0.016'
const MAX_LINE_QUANTITY = 100
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface CartOwner {
  key: string
  kind: Cart['owner']
}

/**
 * The cart belongs to the session's user; without a session token, to the visitor cart named by
 * the `X-Guest-Cart` header. A token that is expired/invalid is an error (never a silent fallback
 * to a visitor cart). `null` = visitor without a cart yet.
 */
function resolveOwner(request: Request): CartOwner | Response | null {
  if (bearerToken(request)) {
    const auth = authenticate(request)
    if (auth instanceof Response) return auth
    return { key: `user:${auth.user.id}`, kind: 'user' }
  }
  const guestId = request.headers.get(GUEST_CART_HEADER)
  if (guestId && UUID_PATTERN.test(guestId)) return { key: `guest:${guestId}`, kind: 'guest' }
  return null
}

const editionOf = (nftId: string, editionId: string) => {
  const nft = nftsTable.findById(nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return nft && edition ? { nft, edition, maxQuantity: Math.max(0, Math.min(edition.available, edition.maxPerOrder)) } : undefined
}

/**
 * Reconciles stored lines with the catalog: lines of removed NFTs/editions are dropped, and when
 * stock fell below a quantity the quantity is reduced (remembering the previous one for the
 * notice). Sold-out lines are kept (status "unavailable") so the user sees what happened.
 */
function reconcile(ownerKey: string): CartRecord {
  const record = cartsTable.get(ownerKey)
  let changed = false
  const items = record.items.flatMap((item): StoredCartItem[] => {
    const found = editionOf(item.nftId, item.editionId)
    if (!found) {
      changed = true
      return []
    }
    if (found.maxQuantity > 0 && item.quantity > found.maxQuantity) {
      changed = true
      return [{ ...item, quantity: found.maxQuantity, quantityAdjustedFrom: item.quantityAdjustedFrom ?? item.quantity }]
    }
    return [item]
  })
  return changed ? cartsTable.save(ownerKey, items) : record
}

function toCart(record: CartRecord, owner: Cart['owner']): Cart {
  const items = record.items.flatMap((stored): CartItem[] => {
    const found = editionOf(stored.nftId, stored.editionId)
    if (!found) return []
    const { nft, edition, maxQuantity } = found
    return [
      {
        id: `${stored.nftId}:${stored.editionId}`,
        nftId: stored.nftId,
        editionId: stored.editionId,
        name: nft.name,
        imageUrl: nft.images[0] ?? '',
        collection: nft.collection,
        tokenId: nft.tokenId,
        editionName: edition.name,
        quantity: stored.quantity,
        unitPriceEth: edition.priceEth,
        lineTotalEth: multiplyEth(edition.priceEth, stored.quantity),
        available: edition.available,
        maxPerOrder: edition.maxPerOrder,
        maxQuantity,
        status: maxQuantity === 0 ? 'unavailable' : 'ok',
        previousPriceEth: compareEth(stored.priceSeenEth, edition.priceEth) !== 0 ? stored.priceSeenEth : null,
        quantityAdjustedFrom: stored.quantityAdjustedFrom,
      },
    ]
  })
  // Exact decimal arithmetic (BigInt wei): no float rounding in any total.
  const subtotalEth = addEth('0', ...items.map((item) => item.lineTotalEth))
  const discountEth = '0'
  const networkFeeEth = items.length > 0 ? ESTIMATED_NETWORK_FEE_ETH : '0'
  return {
    owner,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalEth,
    discountEth,
    networkFeeEth,
    totalEth: addEth(subtotalEth, networkFeeEth),
    checkoutReady: items.length > 0 && items.every((item) => item.status === 'ok'),
    version: record.version,
    updatedAt: record.updatedAt,
  }
}

export function cartResponse(owner: CartOwner) {
  return toCart(reconcile(owner.key), owner.kind)
}

/** Visitor without a cart id yet: an empty cart, nothing stored. */
const emptyGuestCart = (): Cart => toCart({ items: [], version: 0, updatedAt: new Date(0).toISOString() }, 'guest')

async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}

const isQuantity = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_LINE_QUANTITY

const quantityError = () =>
  errorResponse(422, 'VALIDATION_ERROR', 'Quantidade inválida.', { quantity: `Informe um número inteiro entre 1 e ${MAX_LINE_QUANTITY}.` })

/** Writes need an owner: a session, or a visitor cart id (the client creates one before its first add). */
function writableOwner(request: Request): CartOwner | Response {
  const owner = resolveOwner(request)
  return owner ?? errorResponse(422, 'VALIDATION_ERROR', 'Carrinho de visitante não identificado.')
}

export const cartHandlers = [
  http.get(`${base}/cart`, async ({ request }) => {
    const owner = resolveOwner(request)
    const body = owner instanceof Response || owner === null ? null : cartResponse(owner)
    const failure = await applyScenario('cart')
    if (failure) return failure
    if (owner instanceof Response) return owner
    return HttpResponse.json<Cart>(body ?? emptyGuestCart())
  }),

  /** Adds `quantity` units of an edition (merging with an existing line of the same NFT + edition). */
  http.post(`${base}/cart/items`, async ({ request }) => {
    const owner = writableOwner(request)
    if (owner instanceof Response) return owner
    const { nftId, editionId, quantity } = await readJson<AddCartItemRequest>(request)
    const failure = await applyScenario('cart-write')
    if (failure) return failure
    if (!isQuantity(quantity)) return quantityError()
    const found = typeof nftId === 'string' && typeof editionId === 'string' ? editionOf(nftId, editionId) : undefined
    if (!found || !nftId || !editionId) return errorResponse(404, 'NOT_FOUND', 'NFT ou edição não encontrado.')
    if (found.maxQuantity === 0) return errorResponse(409, 'AVAILABILITY_CONFLICT', 'Esta edição está esgotada.')

    const record = reconcile(owner.key)
    const existing = record.items.find((item) => item.nftId === nftId && item.editionId === editionId)
    const total = (existing?.quantity ?? 0) + quantity
    if (total > found.maxQuantity) {
      return errorResponse(
        409,
        'AVAILABILITY_CONFLICT',
        existing
          ? `Você já tem ${existing.quantity} desta edição no carrinho; o máximo é ${found.maxQuantity}.`
          : `Quantidade indisponível: o máximo para esta edição é ${found.maxQuantity}.`,
      )
    }
    const line: StoredCartItem = {
      nftId,
      editionId,
      quantity: total,
      priceSeenEth: found.edition.priceEth,
      quantityAdjustedFrom: null,
      addedAt: existing?.addedAt ?? new Date().toISOString(),
    }
    const items = existing ? record.items.map((item) => (item === existing ? line : item)) : [...record.items, line]
    return HttpResponse.json<Cart>(toCart(cartsTable.save(owner.key, items), owner.kind), { status: existing ? 200 : 201 })
  }),

  /** Sets the absolute quantity of a line (validated against stock and the per-order limit). */
  http.patch<{ nftId: string; editionId: string }>(`${base}/cart/items/:nftId/:editionId`, async ({ request, params }) => {
    const owner = writableOwner(request)
    if (owner instanceof Response) return owner
    const { quantity } = await readJson<UpdateCartItemRequest>(request)
    const failure = await applyScenario('cart-write')
    if (failure) return failure
    if (!isQuantity(quantity)) return quantityError()

    const record = reconcile(owner.key)
    const existing = record.items.find((item) => item.nftId === params.nftId && item.editionId === params.editionId)
    const found = editionOf(params.nftId, params.editionId)
    if (!existing || !found) return errorResponse(404, 'NOT_FOUND', 'Item não está no carrinho.')
    if (found.maxQuantity === 0) return errorResponse(409, 'AVAILABILITY_CONFLICT', 'Esta edição esgotou; remova o item do carrinho.')
    if (quantity > found.maxQuantity) {
      return errorResponse(409, 'AVAILABILITY_CONFLICT', `Quantidade indisponível: o máximo para esta edição é ${found.maxQuantity}.`)
    }
    const items = record.items.map((item) =>
      item === existing ? { ...item, quantity, priceSeenEth: found.edition.priceEth, quantityAdjustedFrom: null } : item,
    )
    return HttpResponse.json<Cart>(toCart(cartsTable.save(owner.key, items), owner.kind))
  }),

  /** Idempotent: removing a line that is not there returns the cart unchanged. */
  http.delete<{ nftId: string; editionId: string }>(`${base}/cart/items/:nftId/:editionId`, async ({ request, params }) => {
    const owner = writableOwner(request)
    if (owner instanceof Response) return owner
    const failure = await applyScenario('cart-write')
    if (failure) return failure
    const record = reconcile(owner.key)
    const items = record.items.filter((item) => !(item.nftId === params.nftId && item.editionId === params.editionId))
    if (items.length === record.items.length) return HttpResponse.json<Cart>(toCart(record, owner.kind))
    return HttpResponse.json<Cart>(toCart(cartsTable.save(owner.key, items), owner.kind))
  }),

  /** Empties the cart (used after a confirmed order in the checkout stage). */
  http.delete(`${base}/cart`, async ({ request }) => {
    const owner = writableOwner(request)
    if (owner instanceof Response) return owner
    const failure = await applyScenario('cart-write')
    if (failure) return failure
    return HttpResponse.json<Cart>(toCart(cartsTable.save(owner.key, []), owner.kind))
  }),

  /**
   * Right after login: the visitor's lines join the user's cart (README: "preservar os itens do
   * visitante ao autenticar"). Same NFT + edition → quantities add up, limited to the current
   * maximum (reported in `quantityAdjustedFrom`). The visitor cart is then deleted.
   */
  http.post(`${base}/cart/merge`, async ({ request }) => {
    const auth = authenticate(request)
    if (auth instanceof Response) return auth
    const { guestCartId } = await readJson<MergeCartRequest>(request)
    const failure = await applyScenario('cart-write')
    if (failure) return failure
    if (typeof guestCartId !== 'string' || !UUID_PATTERN.test(guestCartId)) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Carrinho de visitante inválido.')
    }
    const userKey = `user:${auth.user.id}`
    const guestKey = `guest:${guestCartId}`
    const guest = reconcile(guestKey)
    if (guest.items.length === 0) {
      cartsTable.delete(guestKey)
      return HttpResponse.json<MergeCartResponse>({ cart: cartResponse({ key: userKey, kind: 'user' }), mergedUnits: 0 })
    }

    const items = [...reconcile(userKey).items]
    for (const line of guest.items) {
      const max = editionOf(line.nftId, line.editionId)?.maxQuantity ?? 0
      const index = items.findIndex((item) => item.nftId === line.nftId && item.editionId === line.editionId)
      const existing = index >= 0 ? items[index] : undefined
      const wanted = (existing?.quantity ?? 0) + line.quantity
      const quantity = max > 0 ? Math.min(wanted, max) : wanted
      const merged: StoredCartItem = {
        ...(existing ?? line),
        quantity,
        quantityAdjustedFrom: quantity < wanted ? wanted : (existing?.quantityAdjustedFrom ?? line.quantityAdjustedFrom),
      }
      if (existing) items[index] = merged
      else items.push(merged)
    }
    const saved = cartsTable.save(userKey, items)
    cartsTable.delete(guestKey)
    const mergedUnits = guest.items.reduce((sum, line) => sum + line.quantity, 0)
    return HttpResponse.json<MergeCartResponse>({ cart: toCart(saved, 'user'), mergedUnits })
  }),
]
