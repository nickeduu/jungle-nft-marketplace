import type { QueryClient } from '@tanstack/react-query'
import { nftKeys } from '@/features/nft-detail/api'
import type { Nft, NftUpdatedEvent } from '@/shared/contracts'

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
 * Stale (version <= cached) events never regress state. If the NFT is not cached,
 * nothing is written: the next fetch reads the current REST state.
 */
export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent) {
  queryClient.setQueryData<Nft>(nftKeys.detail(event.resource.id), (current) => {
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
