import { nftFixtures } from '@/mocks/fixtures/nfts'
import type { Nft } from '@/shared/contracts'

/**
 * Single source of truth for the simulated backend.
 * REST handlers read/write here and realtime events are emitted from the same mutations,
 * so REST responses and Socket.IO events never diverge.
 *
 * Persisted in localStorage to survive refresh; `resetDb()` restores the seed exactly.
 */
interface DbState {
  schemaVersion: 1
  nfts: Record<string, Nft>
}

const STORAGE_KEY = 'jungle-mock-db'

function seed(): DbState {
  return {
    schemaVersion: 1,
    nfts: Object.fromEntries(nftFixtures.map((nft) => [nft.id, structuredClone(nft)])),
  }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schemaVersion === 1) return parsed
    }
  } catch {
    // Corrupted or unavailable storage: fall back to the seed.
  }
  return seed()
}

let state: DbState = load()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full/blocked: keep working in memory.
  }
}

export function resetDb() {
  state = seed()
  persist()
}

export const nftsTable = {
  findById(id: string): Nft | undefined {
    const nft = state.nfts[id]
    return nft ? structuredClone(nft) : undefined
  },

  /** Applies a patch to one edition and bumps the NFT version. Returns the updated NFT. */
  updateEdition(nftId: string, editionId: string, patch: { priceEth?: string; available?: number }): Nft | undefined {
    const nft = state.nfts[nftId]
    const edition = nft?.editions.find((e) => e.id === editionId)
    if (!nft || !edition) return undefined
    if (patch.priceEth !== undefined) edition.priceEth = patch.priceEth
    if (patch.available !== undefined) edition.available = patch.available
    nft.version += 1
    nft.updatedAt = new Date().toISOString()
    persist()
    return structuredClone(nft)
  },
}
