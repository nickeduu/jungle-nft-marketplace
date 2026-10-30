import { queryOptions } from '@tanstack/react-query'
import { nftListQuery } from '@/features/catalog/api'
import { http } from '@/services/api/http'
import type { Nft, NftReview } from '@/shared/contracts'
import { nftKeys } from '@/shared/query-keys'

export async function fetchNft(nftId: string, signal: AbortSignal): Promise<Nft> {
  const { data } = await http.get<Nft>(`/nfts/${encodeURIComponent(nftId)}`, { signal })
  return data
}

export async function fetchNftReviews(nftId: string, signal: AbortSignal): Promise<NftReview[]> {
  const { data } = await http.get<NftReview[]>(`/nfts/${encodeURIComponent(nftId)}/reviews`, { signal })
  return data
}

export const nftDetailQuery = (nftId: string) =>
  queryOptions({
    queryKey: nftKeys.detail(nftId),
    // Query's AbortSignal cancels obsolete requests (e.g. fast navigation between NFTs).
    queryFn: ({ signal }) => fetchNft(nftId, signal),
  })

export const nftReviewsQuery = (nftId: string) =>
  queryOptions({
    queryKey: nftKeys.reviews(nftId),
    queryFn: ({ signal }) => fetchNftReviews(nftId, signal),
  })

/** Page size of "Mais desta coleção": one more than shown, since the current NFT is filtered out. */
export const RELATED_PAGE_SIZE = 9

/**
 * "Mais desta coleção" reuses the catalog listing (same cache family): `nft.updated`
 * already invalidates it together with the other collection queries.
 */
export const relatedNftsQuery = (collection: string) =>
  nftListQuery({ collection, sort: 'recent', page: 1, pageSize: RELATED_PAGE_SIZE })
