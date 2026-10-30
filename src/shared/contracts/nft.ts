import type { Network } from './checkout'
import type { EthDecimal, IsoDateTime } from './common'

export interface NftEdition {
  id: string
  name: string
  priceEth: EthDecimal
  /** Units still available for purchase. 0 = sold out. */
  available: number
  /** Total units minted for this edition. */
  supply: number
  /** Maximum quantity allowed in a single order. */
  maxPerOrder: number
}

export interface NftCreator {
  id: string
  name: string
  avatarUrl: string
}

/**
 * Editorial flags. `new` → "Novos lançamentos" tab, `trending` → "Em alta" tab,
 * `rare` → "RARO" badge, `featured` → home highlights.
 */
export type NftTag = 'new' | 'trending' | 'rare' | 'featured'

export interface Nft {
  id: string
  name: string
  description: string
  collection: string
  category: string
  network: Network
  tags: NftTag[]
  creator: NftCreator
  images: string[]
  editions: NftEdition[]
  /** Monotonic version; incremented on every price/availability change. */
  version: number
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/** Lightweight shape used by catalog listings. */
export type NftSummary = Pick<Nft, 'id' | 'name' | 'collection' | 'category' | 'network' | 'tags' | 'creator' | 'version'> & {
  imageUrl: string
  /** Lowest edition price (price filters and sorting use this value). */
  fromPriceEth: EthDecimal
  /** Sum of `available` across editions. 0 = sold out. */
  totalAvailable: number
}

export interface NftCategory {
  id: string
  label: string
}

export const NFT_SORTS = ['recent', 'price-asc', 'price-desc', 'name-asc'] as const
export type NftSort = (typeof NFT_SORTS)[number]

/** Catalog tabs ("Todos os NFTs" = no tab). */
export const NFT_TABS = ['new', 'trending'] as const
export type NftTab = (typeof NFT_TABS)[number]

/**
 * GET /api/nfts query string. All fields optional; defaults applied by the API
 * (sort=recent, page=1, pageSize=12). Arrays are repeated keys: `category=art&category=music`.
 * Invalid values → 422 VALIDATION_ERROR.
 */
export interface NftListParams {
  q?: string
  tab?: NftTab
  category?: string[]
  network?: Network[]
  minPriceEth?: EthDecimal
  maxPriceEth?: EthDecimal
  availableOnly?: boolean
  sort?: NftSort
  page?: number
  pageSize?: number
}

/** GET /api/nfts/facets — sidebar data. Counts are over the whole catalog. */
export interface NftFacets {
  categories: Array<NftCategory & { count: number }>
  networks: Array<{ id: Network; label: string; count: number }>
  priceRange: { minEth: EthDecimal; maxEth: EthDecimal }
}
