import type { NftEdition } from '@/shared/contracts'
import { compareEth } from '@/shared/lib/eth'

/**
 * Detail state in the URL: the selected edition (`/nfts/:id?edition=ed-standard`), so a link,
 * refresh or shared URL opens the same edition. Quantity is not shareable state and stays local.
 */
// `| undefined` lets navigation remove the key explicitly (exactOptionalPropertyTypes).
export interface NftDetailSearch {
  edition?: string | undefined
}

export function validateNftDetailSearch(raw: Record<string, unknown>): NftDetailSearch {
  // Every key is returned (see validateCatalogSearch): the router merges raw and validated search.
  const edition = typeof raw.edition === 'string' ? raw.edition.trim().slice(0, 64) : ''
  return { edition: edition || undefined }
}

/**
 * Edition shown by the page. The URL wins when it names an existing edition (even a sold-out
 * one: the page then explains it is unavailable). Otherwise: the cheapest available edition
 * (first in display order on ties — the price shown on the catalog card), or the first edition
 * when everything is sold out. Unknown ids from a hand-edited URL fall back the same way.
 */
export function resolveEdition(editions: NftEdition[], requestedId: string | undefined): NftEdition | undefined {
  const requested = editions.find((edition) => edition.id === requestedId)
  if (requested) return requested
  const available = editions.filter((edition) => edition.available > 0)
  const cheapest = available.reduce<NftEdition | undefined>(
    (best, edition) => (!best || compareEth(edition.priceEth, best.priceEth) < 0 ? edition : best),
    undefined,
  )
  return cheapest ?? editions[0]
}

/** Maximum quantity for one order of this edition: `min(available, maxPerOrder)` (0 = sold out). */
export function purchaseLimit(edition: NftEdition): number {
  return Math.max(0, Math.min(edition.available, edition.maxPerOrder))
}
