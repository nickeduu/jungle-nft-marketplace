import type { NftListParams } from '@/shared/contracts'

/**
 * Query keys shared by features and the realtime bridge.
 * `collections()` groups every query derived from many NFTs (list, highlights, facets):
 * price/stock changes invalidate them as a group. List keys include every API parameter,
 * so each filter combination has its own cache entry.
 */
export const nftKeys = {
  all: ['nfts'] as const,
  collections: () => [...nftKeys.all, 'collection'] as const,
  list: (params: NftListParams) => [...nftKeys.collections(), 'list', params] as const,
  highlights: () => [...nftKeys.collections(), 'highlights'] as const,
  facets: () => [...nftKeys.collections(), 'facets'] as const,
  detail: (nftId: string) => [...nftKeys.all, 'detail', nftId] as const,
}
