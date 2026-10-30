import type { QueryClient } from '@tanstack/react-query'
import { nftKeys, privateKeys } from '@/shared/query-keys'
import type { FavoritesResponse, FavoritesUpdatedEvent, Nft, NftUpdatedEvent } from '@/shared/contracts'

/** Remembers recently applied event ids to ignore duplicates (bounded memory). */
export class EventDeduper {
  private readonly seen = new Set<string>()
  private readonly limit: number

  constructor(limit = 500) {
    this.limit = limit
  }

  /** Returns true the first time an id is seen. */
  markFirstSeen(eventId: string): boolean {
    if (this.seen.has(eventId)) return false
    this.seen.add(eventId)
    if (this.seen.size > this.limit) {
      const oldest = this.seen.values().next().value
      if (oldest !== undefined) this.seen.delete(oldest)
    }
    return true
  }
}

/**
 * Applies `nft.updated` to the cached detail only if the event is newer than the cache.
 * Stale (version <= cached) events never regress state.
 *
 * Race: if the detail is still loading (or refetching), the response in transit may have been
 * read before this change. Then the query is invalidated, which cancels the in-flight request
 * and refetches, instead of dropping the event. An NFT nobody has queried is ignored: its
 * first fetch already reads the current REST state.
 */
export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent) {
  const queryKey = nftKeys.detail(event.resource.id)
  const state = queryClient.getQueryState(queryKey)
  if (state && (state.data === undefined || state.fetchStatus === 'fetching')) {
    // Explicit cancel: for a first load (no data) invalidate() alone would reuse the
    // in-flight promise instead of cancelling it, and the stale response would win.
    void queryClient
      .cancelQueries({ queryKey, exact: true })
      .then(() => queryClient.invalidateQueries({ queryKey, exact: true }))
    if (state.data === undefined) return
  }

  queryClient.setQueryData<Nft>(queryKey, (current) => {
    if (!current || event.version <= current.version) return current
    const patches = new Map(event.data.editions.map((e) => [e.id, e]))
    return {
      ...current,
      version: event.version,
      updatedAt: event.occurredAt,
      editions: current.editions.map((edition) => {
        const patch = patches.get(edition.id)
        return patch ? { ...edition, priceEth: patch.priceEth, available: patch.available } : edition
      }),
    }
  })
}

/**
 * Catalog lists, highlights and facets are not patched in place: a price/stock change can change filter
 * membership and ordering, which only the API can compute. Active lists refetch.
 */
export async function invalidateNftLists(queryClient: QueryClient) {
  // Same race as the detail: a first load in flight may predate the event (see above).
  await queryClient.cancelQueries({ queryKey: nftKeys.collections() })
  await queryClient.invalidateQueries({ queryKey: nftKeys.collections() })
  // Favorites lists carry NFT summaries (price/stock) too.
  return queryClient.invalidateQueries({ queryKey: privateKeys.all, predicate: (query) => query.queryKey[2] === 'favorites' })
}

/**
 * Private `favorites.updated` (another device of the same user). Applied only when the event
 * belongs to the user of this socket's session — the mock never routes it elsewhere, and the
 * client double-checks — and only when newer than the cached list. The list is refetched
 * (it also carries the NFT summaries), never patched from the event.
 */
export function applyFavoritesUpdated(queryClient: QueryClient, event: FavoritesUpdatedEvent, sessionUserId: string | null) {
  if (!sessionUserId || event.resource.type !== 'favorites' || event.resource.id !== sessionUserId) return false
  const queryKey = privateKeys.favorites(sessionUserId)
  const cached = queryClient.getQueryData<FavoritesResponse>(queryKey)
  if (cached && event.version <= cached.version) return false
  void queryClient.invalidateQueries({ queryKey, exact: true })
  return true
}
