import { categoryFixtures, networkLabels } from '@/mocks/fixtures/nfts'
import {
  NETWORKS,
  NFT_SORTS,
  NFT_TABS,
  type Network,
  type Nft,
  type NftFacets,
  type NftSort,
  type NftSummary,
  type NftTab,
  type Paginated,
} from '@/shared/contracts'
import { addEth, compareEth, isEthDecimal } from '@/shared/lib/eth'

/** Server-side implementation of the catalog endpoints (search, filters, sort, pagination, facets). */

export const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 48
const MAX_QUERY_LENGTH = 100

export interface ParsedListQuery {
  q: string
  tab: NftTab | null
  collection: string | null
  categories: string[]
  networks: Network[]
  minPriceEth: string | null
  maxPriceEth: string | null
  availableOnly: boolean
  sort: NftSort
  page: number
  pageSize: number
}

export type ParseResult = { ok: true; query: ParsedListQuery } | { ok: false; fieldErrors: Record<string, string> }

function parsePositiveInt(raw: string | null, fallback: number): number | null {
  if (raw === null) return fallback
  if (!/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return value >= 1 ? value : null
}

export function parseListQuery(params: URLSearchParams): ParseResult {
  const fieldErrors: Record<string, string> = {}

  const q = (params.get('q') ?? '').trim()
  if (q.length > MAX_QUERY_LENGTH) fieldErrors.q = `Busca deve ter até ${MAX_QUERY_LENGTH} caracteres.`

  const collection = params.get('collection')?.trim() ?? null
  if (collection !== null && (collection.length === 0 || collection.length > MAX_QUERY_LENGTH)) {
    fieldErrors.collection = `Coleção deve ter de 1 a ${MAX_QUERY_LENGTH} caracteres.`
  }

  const tabRaw = params.get('tab')
  const tab = tabRaw === null ? null : (NFT_TABS.find((t) => t === tabRaw) ?? null)
  if (tabRaw !== null && tab === null) fieldErrors.tab = 'Aba inválida.'

  const knownCategories = new Set(categoryFixtures.map((c) => c.id))
  const categories = [...new Set(params.getAll('category'))]
  if (categories.some((c) => !knownCategories.has(c))) fieldErrors.category = 'Categoria inválida.'

  const networksRaw = [...new Set(params.getAll('network'))]
  const networks = networksRaw.filter((n): n is Network => NETWORKS.some((known) => known === n))
  if (networks.length !== networksRaw.length) fieldErrors.network = 'Rede inválida.'

  const minPriceEth = params.get('minPriceEth')
  const maxPriceEth = params.get('maxPriceEth')
  if (minPriceEth !== null && !isEthDecimal(minPriceEth)) fieldErrors.minPriceEth = 'Preço mínimo inválido.'
  if (maxPriceEth !== null && !isEthDecimal(maxPriceEth)) fieldErrors.maxPriceEth = 'Preço máximo inválido.'
  if (
    minPriceEth !== null && maxPriceEth !== null &&
    isEthDecimal(minPriceEth) && isEthDecimal(maxPriceEth) &&
    compareEth(minPriceEth, maxPriceEth) > 0
  ) {
    fieldErrors.maxPriceEth = 'Preço máximo deve ser maior ou igual ao mínimo.'
  }

  const availableRaw = params.get('availableOnly')
  if (availableRaw !== null && availableRaw !== 'true' && availableRaw !== 'false') {
    fieldErrors.availableOnly = 'Use true ou false.'
  }

  const sortRaw = params.get('sort') ?? 'recent'
  const sort = NFT_SORTS.find((s) => s === sortRaw)
  if (!sort) fieldErrors.sort = 'Ordenação inválida.'

  const page = parsePositiveInt(params.get('page'), 1)
  if (page === null) fieldErrors.page = 'Página inválida.'
  const pageSize = parsePositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE)
  if (pageSize === null || pageSize > MAX_PAGE_SIZE) fieldErrors.pageSize = `Tamanho de página entre 1 e ${MAX_PAGE_SIZE}.`

  if (Object.keys(fieldErrors).length > 0 || !sort || page === null || pageSize === null) {
    return { ok: false, fieldErrors }
  }
  return {
    ok: true,
    query: {
      q, tab, collection, categories, networks, minPriceEth, maxPriceEth,
      availableOnly: availableRaw === 'true', sort, page, pageSize,
    },
  }
}

export function toSummary(nft: Nft): NftSummary {
  const prices = nft.editions.map((e) => e.priceEth)
  const fromPriceEth = prices.reduce((min, p) => (compareEth(p, min) < 0 ? p : min), prices[0] ?? '0')
  return {
    id: nft.id,
    name: nft.name,
    collection: nft.collection,
    category: nft.category,
    network: nft.network,
    tags: nft.tags,
    creator: nft.creator,
    version: nft.version,
    imageUrl: nft.images[0] ?? '',
    fromPriceEth: addEth(fromPriceEth),
    totalAvailable: nft.editions.reduce((sum, e) => sum + e.available, 0),
  }
}

/** Case- and accent-insensitive comparison key. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function queryNfts(nfts: Nft[], query: ParsedListQuery): Paginated<NftSummary> {
  const term = normalize(query.q)
  const categories = new Set(query.categories)
  const networks = new Set(query.networks)

  const matches = nfts
    .filter((nft) => !term || [nft.name, nft.collection, nft.creator.name].some((field) => normalize(field).includes(term)))
    .filter((nft) => query.tab === null || nft.tags.includes(query.tab))
    .filter((nft) => query.collection === null || nft.collection === query.collection)
    .filter((nft) => categories.size === 0 || categories.has(nft.category))
    .filter((nft) => networks.size === 0 || networks.has(nft.network))
    .map((nft) => ({ nft, summary: toSummary(nft) }))
    .filter(({ summary }) => !query.availableOnly || summary.totalAvailable > 0)
    .filter(({ summary }) => query.minPriceEth === null || compareEth(summary.fromPriceEth, query.minPriceEth) >= 0)
    .filter(({ summary }) => query.maxPriceEth === null || compareEth(summary.fromPriceEth, query.maxPriceEth) <= 0)

  // Every comparator ends with the id so the order is total and stable across requests.
  const byId = (a: { nft: Nft }, b: { nft: Nft }) => a.nft.id.localeCompare(b.nft.id)
  matches.sort((a, b) => {
    switch (query.sort) {
      case 'price-asc':
        return compareEth(a.summary.fromPriceEth, b.summary.fromPriceEth) || byId(a, b)
      case 'price-desc':
        return compareEth(b.summary.fromPriceEth, a.summary.fromPriceEth) || byId(a, b)
      case 'name-asc':
        return a.nft.name.localeCompare(b.nft.name, 'pt-BR') || byId(a, b)
      case 'recent':
        return b.nft.createdAt.localeCompare(a.nft.createdAt) || byId(a, b)
    }
  })

  const totalItems = matches.length
  const start = (query.page - 1) * query.pageSize
  return {
    items: matches.slice(start, start + query.pageSize).map(({ summary }) => summary),
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
  }
}

export function buildFacets(nfts: Nft[]): NftFacets {
  const fromPrices = nfts.map((nft) => toSummary(nft).fromPriceEth)
  const first = fromPrices[0] ?? '0'
  return {
    categories: categoryFixtures.map((c) => ({ ...c, count: nfts.filter((nft) => nft.category === c.id).length })),
    networks: NETWORKS.map((id) => ({ id, label: networkLabels[id], count: nfts.filter((nft) => nft.network === id).length })),
    priceRange: {
      minEth: fromPrices.reduce((min, p) => (compareEth(p, min) < 0 ? p : min), first),
      maxEth: fromPrices.reduce((max, p) => (compareEth(p, max) > 0 ? p : max), first),
    },
  }
}

/** Home highlights: featured NFTs, newest first. */
export function highlights(nfts: Nft[]): NftSummary[] {
  return nfts
    .filter((nft) => nft.tags.includes('featured'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .map(toSummary)
}
