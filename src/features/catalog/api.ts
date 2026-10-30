import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { http } from '@/services/api/http'
import type { NftFacets, NftListParams, NftSummary, Paginated } from '@/shared/contracts'
import { nftKeys } from '@/shared/query-keys'

export async function fetchNfts(params: NftListParams, signal: AbortSignal): Promise<Paginated<NftSummary>> {
  const { data } = await http.get<Paginated<NftSummary>>('/nfts', {
    params,
    // Arrays as repeated keys: category=art&category=music.
    paramsSerializer: { indexes: null },
    signal,
  })
  return data
}

export async function fetchFacets(signal: AbortSignal): Promise<NftFacets> {
  const { data } = await http.get<NftFacets>('/nfts/facets', { signal })
  return data
}

export async function fetchHighlights(signal: AbortSignal): Promise<NftSummary[]> {
  const { data } = await http.get<NftSummary[]>('/nfts/highlights', { signal })
  return data
}

export const nftListQuery = (params: NftListParams) =>
  queryOptions({
    // Each parameter combination is its own cache entry: a late response for old params
    // can never overwrite the current one, and the AbortSignal cancels it.
    queryKey: nftKeys.list(params),
    queryFn: ({ signal }) => fetchNfts(params, signal),
    // Keep showing the previous page while the next one loads (no skeleton flash).
    placeholderData: keepPreviousData,
  })

export const facetsQuery = () =>
  queryOptions({
    queryKey: nftKeys.facets(),
    queryFn: ({ signal }) => fetchFacets(signal),
  })

export const highlightsQuery = () =>
  queryOptions({
    queryKey: nftKeys.highlights(),
    queryFn: ({ signal }) => fetchHighlights(signal),
  })
