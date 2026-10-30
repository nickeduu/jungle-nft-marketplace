import { NETWORKS, NFT_SORTS, NFT_TABS, type Network, type NftListParams, type NftSort, type NftTab } from '@/shared/contracts'
import { compareEth, isEthDecimal } from '@/shared/lib/eth'

/**
 * Catalog state that lives in the URL (source of truth for search, tab, filters, sort and page).
 * Defaults are omitted from the URL; invalid values from a hand-edited URL are dropped.
 * Example: /?q=ape&tab=trending&category=music,photography&network=polygon&min=0.5&sort=price-asc&page=2
 */
// `| undefined` lets navigation remove a key explicitly (exactOptionalPropertyTypes).
export interface CatalogSearch {
  q?: string | undefined
  tab?: NftTab | undefined
  category?: string[] | undefined
  network?: Network[] | undefined
  min?: string | undefined
  max?: string | undefined
  available?: boolean | undefined
  sort?: NftSort | undefined
  page?: number | undefined
}

// Figma desktop shows a 3×3 grid per page.
export const CATALOG_PAGE_SIZE = 9
export const DEFAULT_SORT: NftSort = 'recent'

const asString = (value: unknown) => (typeof value === 'string' ? value.trim() : undefined)

/** Accepts "a,b" (from the URL) or ["a", "b"] (from in-app navigation). */
function asList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : (asString(value)?.split(',') ?? [])
  return [...new Set(items.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].sort()
}

export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  // Every key is returned (undefined when invalid/default): TanStack Router merges the raw
  // search with this result, so an omitted key would let the raw, unvalidated value through.
  const q = asString(raw.q)?.slice(0, 100)
  // Unknown categories are left to the API (it owns the category list and answers 422).
  const categories = asList(raw.category)
  const networks = asList(raw.network).filter((n): n is Network => NETWORKS.some((known) => known === n))
  const minRaw = asString(raw.min)
  const min = minRaw && isEthDecimal(minRaw) ? minRaw : undefined
  const maxRaw = asString(raw.max)
  const max = maxRaw && isEthDecimal(maxRaw) && (!min || compareEth(min, maxRaw) <= 0) ? maxRaw : undefined
  const sort = NFT_SORTS.find((s) => s === raw.sort)
  const page = Number(raw.page)

  return {
    q: q || undefined,
    tab: NFT_TABS.find((t) => t === raw.tab),
    category: categories.length > 0 ? categories : undefined,
    network: networks.length > 0 ? networks : undefined,
    min,
    max,
    available: raw.available === 'true' || raw.available === true ? true : undefined,
    sort: sort && sort !== DEFAULT_SORT ? sort : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

/** Maps URL state to the REST contract. Undefined fields are omitted (stable query keys). */
export function toListParams(search: CatalogSearch): NftListParams {
  const params: NftListParams = { sort: search.sort ?? DEFAULT_SORT, page: search.page ?? 1, pageSize: CATALOG_PAGE_SIZE }
  if (search.q) params.q = search.q
  if (search.tab) params.tab = search.tab
  if (search.category?.length) params.category = search.category
  if (search.network?.length) params.network = search.network
  if (search.min) params.minPriceEth = search.min
  if (search.max) params.maxPriceEth = search.max
  if (search.available) params.availableOnly = true
  return params
}

/** Filters that narrow the result set (used for the empty state message). */
export function hasActiveFilters(search: CatalogSearch): boolean {
  return Boolean(
    search.q || search.tab || search.category?.length || search.network?.length ||
    search.min || search.max || search.available,
  )
}
