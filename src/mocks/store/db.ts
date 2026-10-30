import { nftFixtures } from '@/mocks/fixtures/nfts'
import type { Nft } from '@/shared/contracts'

/**
 * Single source of truth for the simulated backend.
 * REST handlers read/write here and realtime events are emitted from the same mutations,
 * so REST responses and Socket.IO events never diverge.
 *
 * Persisted in localStorage to survive refresh; `resetDb()` restores the seed exactly.
 */
const SCHEMA_VERSION = 5

interface DbState {
  schemaVersion: typeof SCHEMA_VERSION
  nfts: Record<string, Nft>
}

/** v4: NFTs without token id, attributes, rating, contract, long description and the Figma editions. */
interface DbStateV4 {
  schemaVersion: 4
  nfts: Record<string, Pick<Nft, 'id' | 'version' | 'updatedAt' | 'editions'>>
}

const STORAGE_KEY = 'jungle-mock-db'

function seed(): DbState {
  return {
    schemaVersion: SCHEMA_VERSION,
    nfts: Object.fromEntries(nftFixtures.map((nft) => [nft.id, structuredClone(nft)])),
  }
}

/**
 * v4 → v5: new descriptive fields and editions come from the seed; the simulated
 * "backend" changes already persisted (price, stock and version of existing editions) are kept.
 */
function migrateFromV4(previous: DbStateV4): DbState {
  const next = seed()
  for (const nft of Object.values(next.nfts)) {
    const stored = previous.nfts[nft.id]
    if (!stored) continue
    const storedEditions = new Map(stored.editions.map((edition) => [edition.id, edition]))
    nft.editions = nft.editions.map((edition) => {
      const old = storedEditions.get(edition.id)
      return old ? { ...edition, priceEth: old.priceEth, available: old.available } : edition
    })
    nft.version = stored.version
    nft.updatedAt = stored.updatedAt
  }
  return next
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState | DbStateV4
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed
      if (parsed.schemaVersion === 4) {
        const migrated = migrateFromV4(parsed)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
        return migrated
      }
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
  list(): Nft[] {
    return Object.values(state.nfts).map((nft) => structuredClone(nft))
  },

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
