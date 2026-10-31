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
  reviews: (nftId: string) => [...nftKeys.all, 'reviews', nftId] as const,
}

export const authKeys = {
  session: () => ['auth', 'session'] as const,
}

/**
 * Data of the signed-in user. Every key starts with ['private', userId], so one user's cache
 * entries can never be read under another user's id, and logout/user switch removes them as a group.
 */
export const privateKeys = {
  all: ['private'] as const,
  user: (userId: string) => [...privateKeys.all, userId] as const,
  profile: (userId: string) => [...privateKeys.user(userId), 'profile'] as const,
  favorites: (userId: string) => [...privateKeys.user(userId), 'favorites'] as const,
  cart: (userId: string) => [...privateKeys.user(userId), 'cart'] as const,
  wallets: (userId: string) => [...privateKeys.user(userId), 'wallets'] as const,
  quote: (userId: string, network: string) => [...privateKeys.user(userId), 'quote', network] as const,
  orders: (userId: string) => [...privateKeys.user(userId), 'orders'] as const,
  order: (userId: string, orderId: string) => [...privateKeys.orders(userId), orderId] as const,
}

/** Visitor cart, keyed by its id (a new visitor after logout gets a new id: nothing is shared). */
export const guestCartKeys = {
  all: ['guest-cart'] as const,
  cart: (guestCartId: string) => [...guestCartKeys.all, guestCartId] as const,
}
