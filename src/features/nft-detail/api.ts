import { queryOptions } from '@tanstack/react-query'
import { http } from '@/services/api/http'
import type { Nft } from '@/shared/contracts'

export async function fetchNft(nftId: string, signal: AbortSignal): Promise<Nft> {
  const { data } = await http.get<Nft>(`/nfts/${encodeURIComponent(nftId)}`, { signal })
  return data
}

export const nftKeys = {
  all: ['nfts'] as const,
  detail: (nftId: string) => [...nftKeys.all, 'detail', nftId] as const,
}

export const nftDetailQuery = (nftId: string) =>
  queryOptions({
    queryKey: nftKeys.detail(nftId),
    // Query's AbortSignal cancels obsolete requests (e.g. fast navigation between NFTs).
    queryFn: ({ signal }) => fetchNft(nftId, signal),
  })
