import type { IsoDateTime } from './common'
import type { OrderStatus } from './checkout'
import type { NftEdition } from './nft'

/**
 * Envelope shared by every Socket.IO event.
 * Clients must drop events whose `eventId` was already applied (duplicates)
 * and events whose `version` is <= the cached resource version (stale).
 */
export interface RealtimeEvent<TResource extends string, TData> {
  eventId: string
  resource: { type: TResource; id: string }
  version: number
  occurredAt: IsoDateTime
  data: TData
}

export type NftUpdatedEvent = RealtimeEvent<
  'nft',
  { editions: Array<Pick<NftEdition, 'id' | 'priceEth' | 'available'>> }
>

export type OrderUpdatedEvent = RealtimeEvent<
  'order',
  { status: OrderStatus; txHash: string | null; rejectionReason: string | null }
>

/** Server → client events. */
export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}

/** Client → server events (none yet; subscriptions are implicit per session). */
export type ClientToServerEvents = Record<never, never>

export const REALTIME_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
} as const satisfies Record<string, keyof ServerToClientEvents>
