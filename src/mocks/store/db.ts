import { nftFixtures } from '@/mocks/fixtures/nfts'
import { favoriteFixtures, userFixtures, type UserRecord } from '@/mocks/fixtures/users'
import type { Nft, User } from '@/shared/contracts'

/**
 * Single source of truth for the simulated backend.
 * REST handlers read/write here and realtime events are emitted from the same mutations,
 * so REST responses and Socket.IO events never diverge.
 *
 * Persisted in localStorage to survive refresh; `resetDb()` restores the seed exactly.
 */
const SCHEMA_VERSION = 7

/** Session lifetime. Tests expire sessions on demand through the control endpoints. */
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000

export interface SessionRecord {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
}

interface FavoritesRecord {
  /** Most recent first. */
  nftIds: string[]
  version: number
}

/** A cart line as stored: the API derives prices, totals and status from the catalog on every read. */
export interface StoredCartItem {
  nftId: string
  editionId: string
  quantity: number
  /** Edition price when the user last added/changed the line (to report price changes). */
  priceSeenEth: string
  /** Set when the API reduced the quantity because stock dropped; cleared on the next user change. */
  quantityAdjustedFrom: number | null
  addedAt: string
}

export interface CartRecord {
  items: StoredCartItem[]
  version: number
  updatedAt: string
}

interface DbState {
  schemaVersion: typeof SCHEMA_VERSION
  nfts: Record<string, Nft>
  users: Record<string, UserRecord>
  /** By token. */
  sessions: Record<string, SessionRecord>
  /** By user id: each user's list is a separate record. */
  favorites: Record<string, FavoritesRecord>
  /** By owner key: `user:<userId>` or `guest:<uuid>` — every cart is a separate record. */
  carts: Record<string, CartRecord>
}

/** v6: accounts and favorites, no carts. */
type DbStateV6 = Omit<DbState, 'schemaVersion' | 'carts'> & { schemaVersion: 6 }

/** v5: NFT catalog only (no accounts). */
interface DbStateV5 {
  schemaVersion: 5
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
    users: Object.fromEntries(userFixtures.map((user) => [user.id, structuredClone(user)])),
    sessions: {},
    favorites: Object.fromEntries(
      Object.entries(favoriteFixtures).map(([userId, nftIds]) => [userId, { nftIds: [...nftIds], version: 1 }]),
    ),
    carts: {},
  }
}

/**
 * v4 → v5: new descriptive fields and editions come from the seed; the simulated
 * "backend" changes already persisted (price, stock and version of existing editions) are kept.
 */
function migrateFromV4(previous: DbStateV4): DbStateV5 {
  const nfts = seed().nfts
  for (const nft of Object.values(nfts)) {
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
  return { schemaVersion: 5, nfts }
}

/** v5 → v6: keeps the catalog as persisted and adds the seed accounts and favorites. */
function migrateFromV5(previous: DbStateV5): DbStateV6 {
  const { users, sessions, favorites } = seed()
  return { schemaVersion: 6, nfts: previous.nfts, users, sessions, favorites }
}

/** v6 → v7: everything persisted is kept; carts start empty. */
function migrateFromV6(previous: DbStateV6): DbState {
  return { ...previous, schemaVersion: SCHEMA_VERSION, carts: {} }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState | DbStateV6 | DbStateV5 | DbStateV4
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed
      const migrated =
        parsed.schemaVersion === 6
          ? migrateFromV6(parsed)
          : parsed.schemaVersion === 5
            ? migrateFromV6(migrateFromV5(parsed))
            : parsed.schemaVersion === 4
              ? migrateFromV6(migrateFromV5(migrateFromV4(parsed)))
              : null
      if (migrated) {
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

/** Public projection: never exposes the password hash or salt. */
export function toPublicUser({ id, name, username, email, avatarUrl, bio }: UserRecord): User {
  return { id, name, username, email, avatarUrl, bio }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const usersTable = {
  findById(id: string): UserRecord | undefined {
    const user = state.users[id]
    return user ? structuredClone(user) : undefined
  },

  findByEmail(email: string): UserRecord | undefined {
    const target = normalizeEmail(email)
    const user = Object.values(state.users).find((u) => u.email === target)
    return user ? structuredClone(user) : undefined
  },

  findByUsername(username: string): UserRecord | undefined {
    const target = username.trim().toLowerCase()
    const user = Object.values(state.users).find((u) => u.username === target)
    return user ? structuredClone(user) : undefined
  },

  create(record: UserRecord): UserRecord {
    const user = { ...record, email: normalizeEmail(record.email), username: record.username.trim().toLowerCase() }
    state.users[user.id] = user
    state.favorites[user.id] = { nftIds: [], version: 1 }
    persist()
    return structuredClone(user)
  },
}

export type SessionLookup =
  | { status: 'valid'; session: SessionRecord }
  | { status: 'expired' }
  | { status: 'missing' }

export const sessionsTable = {
  create(userId: string, now = Date.now()): SessionRecord {
    const session: SessionRecord = {
      token: crypto.randomUUID(),
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    }
    state.sessions[session.token] = session
    persist()
    return structuredClone(session)
  },

  lookup(token: string | null, now = Date.now()): SessionLookup {
    const session = token ? state.sessions[token] : undefined
    if (!session || !state.users[session.userId]) return { status: 'missing' }
    if (Date.parse(session.expiresAt) <= now) return { status: 'expired' }
    return { status: 'valid', session: structuredClone(session) }
  },

  delete(token: string) {
    delete state.sessions[token]
    persist()
  },

  /** Control endpoint: expires every session (or only the given user's). */
  expire(userId?: string): number {
    let count = 0
    const past = new Date(Date.now() - 1000).toISOString()
    for (const session of Object.values(state.sessions)) {
      if (userId && session.userId !== userId) continue
      session.expiresAt = past
      count += 1
    }
    persist()
    return count
  },
}

export const favoritesTable = {
  get(userId: string): FavoritesRecord {
    return structuredClone(state.favorites[userId] ?? { nftIds: [], version: 1 })
  },

  /** Idempotent: adding an existing favorite or removing a missing one does not bump the version. */
  set(userId: string, nftId: string, favorite: boolean): { record: FavoritesRecord; changed: boolean } {
    const current = state.favorites[userId] ?? { nftIds: [], version: 1 }
    const has = current.nftIds.includes(nftId)
    if (has === favorite) return { record: structuredClone(current), changed: false }
    const next: FavoritesRecord = {
      nftIds: favorite ? [nftId, ...current.nftIds] : current.nftIds.filter((id) => id !== nftId),
      version: current.version + 1,
    }
    state.favorites[userId] = next
    persist()
    return { record: structuredClone(next), changed: true }
  },
}

export const cartsTable = {
  get(ownerKey: string): CartRecord {
    return structuredClone(state.carts[ownerKey] ?? { items: [], version: 0, updatedAt: new Date(0).toISOString() })
  },

  /** Replaces the owner's lines (bumps the version). */
  save(ownerKey: string, items: StoredCartItem[]): CartRecord {
    const previous = state.carts[ownerKey]
    const record: CartRecord = { items: structuredClone(items), version: (previous?.version ?? 0) + 1, updatedAt: new Date().toISOString() }
    state.carts[ownerKey] = record
    persist()
    return structuredClone(record)
  },

  delete(ownerKey: string) {
    delete state.carts[ownerKey]
    persist()
  },
}
