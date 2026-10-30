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

export interface Nft {
  id: string
  name: string
  description: string
  collection: string
  category: string
  creator: NftCreator
  images: string[]
  editions: NftEdition[]
  /** Monotonic version; incremented on every price/availability change. */
  version: number
  updatedAt: IsoDateTime
}

/** Lightweight shape used by catalog listings. */
export type NftSummary = Pick<Nft, 'id' | 'name' | 'collection' | 'category' | 'creator' | 'version'> & {
  imageUrl: string
  /** Lowest edition price. */
  fromPriceEth: EthDecimal
  totalAvailable: number
}

export type NftSort = 'recent' | 'price-asc' | 'price-desc' | 'name-asc'

/** GET /api/nfts query string. All fields optional; defaults applied by the API. */
export interface NftListParams {
  q?: string
  category?: string[]
  minPriceEth?: EthDecimal
  maxPriceEth?: EthDecimal
  availableOnly?: boolean
  sort?: NftSort
  page?: number
  pageSize?: number
}
