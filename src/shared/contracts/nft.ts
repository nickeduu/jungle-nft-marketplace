import type { Network } from './checkout'
import type { EthDecimal, IsoDateTime } from './common'

export interface NftEdition {
  id: string
  /** Label shown in the edition picker (Figma: "1/1", "1/10", "1/50", "Aberta"). */
  name: string
  priceEth: EthDecimal
  /** Units still available for purchase. 0 = sold out. */
  available: number
  /** Total units minted for this edition. `null` = open edition (no fixed supply). */
  supply: number | null
  /** Maximum quantity allowed in a single order. */
  maxPerOrder: number
}

export interface NftCreator {
  id: string
  name: string
  avatarUrl: string
}

export interface NftAttribute {
  trait: string
  value: string
}

/** Aggregate of the collector reviews (`GET /api/nfts/:id/reviews`). */
export interface NftRating {
  /** Mean of the review ratings, one decimal place (e.g. 4.8). */
  average: number
  count: number
}

export interface NftContract {
  address: string
  standard: 'ERC-721' | 'ERC-1155'
}

/** GET /api/nfts/:id/reviews — read-only collector reviews. */
export interface NftReview {
  id: string
  author: string
  /** Integer from 1 to 5. */
  rating: number
  comment: string
  createdAt: IsoDateTime
}

/**
 * Editorial flags. `new` → "Novos lançamentos" tab, `trending` → "Em alta" tab,
 * `rare` → "RARO" badge, `featured` → home highlights.
 */
export type NftTag = 'new' | 'trending' | 'rare' | 'featured'

export interface Nft {
  id: string
  /** Token identifier shown to collectors (e.g. "#0042"). */
  tokenId: string
  name: string
  /** Short summary ("Sobre este NFT"). */
  description: string
  /** Full text of the "Detalhes do NFT" tab; paragraphs separated by a blank line. */
  longDescription: string
  collection: string
  category: string
  network: Network
  tags: NftTag[]
  creator: NftCreator
  attributes: NftAttribute[]
  rating: NftRating
  contract: NftContract
  /** Creator royalty on secondary sales, in percent (integer). */
  royaltyPercent: number
  /** Gallery images; the first one is the cover used by listings. */
  images: string[]
  /** Ordered as displayed in the edition picker. */
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
  /** Exact collection name (detail page: "Mais desta coleção"). */
  collection?: string
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
