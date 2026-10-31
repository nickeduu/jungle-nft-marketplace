import { nftFixtures } from '@/mocks/fixtures/nfts'
import { networkFeeFixtures, walletFixtures } from '@/mocks/fixtures/checkout'
import { favoriteFixtures, userFixtures, type UserRecord } from '@/mocks/fixtures/users'
import type { Network, Nft, Order, Quote, User, Wallet, WalletSlot } from '@/shared/contracts'

/**
 * Single source of truth for the simulated backend.
 * REST handlers read/write here and realtime events are emitted from the same mutations,
 * so REST responses and Socket.IO events never diverge.
 *
 * Persisted in localStorage to survive refresh; `resetDb()` restores the seed exactly.
 */
const SCHEMA_VERSION = 8

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
  /** Applied coupon code (validated again by every quote). */
  couponCode?: string | null
  version: number
  updatedAt: string
}

export type QuoteRecord = Quote & { userId: string }

/** How the simulated payment of an order ends; `manual` = stays pending until a control endpoint resolves it. */
export type PaymentOutcome = 'confirmed' | 'rejected' | 'manual'

export type OrderRecord = Order & {
  userId: string
  outcome: PaymentOutcome
  /** When the simulated payment resolves (persisted: a reload/reopen resumes it). */
  resolvesAt: string | null
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
  /** By user id. */
  wallets: Record<string, Wallet[]>
  /** By user id: the wallet currently "connected" for payment. */
  walletConnections: Record<string, string | null>
  networkFees: Record<Network, string>
  quotes: Record<string, QuoteRecord>
  orders: Record<string, OrderRecord>
  /** `${userId}:${idempotencyKey}` → order id + hash of the request body. */
  idempotency: Record<string, { orderId: string; bodyHash: string }>
}

/** v7: carts, no checkout data. */
type DbStateV7 = Omit<DbState, 'schemaVersion' | 'wallets' | 'walletConnections' | 'networkFees' | 'quotes' | 'orders' | 'idempotency'> & {
  schemaVersion: 7
}

/** v6: accounts and favorites, no carts. */
type DbStateV6 = Omit<DbStateV7, 'schemaVersion' | 'carts'> & { schemaVersion: 6 }

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
    ...checkoutSeed(),
  }
}

function checkoutSeed() {
  return {
    wallets: structuredClone(walletFixtures),
    walletConnections: {},
    networkFees: { ...networkFeeFixtures },
    quotes: {},
    orders: {},
    idempotency: {},
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
function migrateFromV6(previous: DbStateV6): DbStateV7 {
  return { ...previous, schemaVersion: 7, carts: {} }
}

/** v7 → v8: everything persisted is kept; wallets, fees, quotes, orders and idempotency start from the seed. */
function migrateFromV7(previous: DbStateV7): DbState {
  return { ...previous, schemaVersion: SCHEMA_VERSION, ...checkoutSeed() }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState | DbStateV7 | DbStateV6 | DbStateV5 | DbStateV4
      if (parsed.schemaVersion === SCHEMA_VERSION) return parsed
      const toV7 = (): DbStateV7 | null =>
        parsed.schemaVersion === 7
          ? parsed
          : parsed.schemaVersion === 6
            ? migrateFromV6(parsed)
            : parsed.schemaVersion === 5
              ? migrateFromV6(migrateFromV5(parsed))
              : parsed.schemaVersion === 4
                ? migrateFromV6(migrateFromV5(migrateFromV4(parsed)))
                : null
      const v7 = toV7()
      const migrated = v7 ? migrateFromV7(v7) : null
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

  update(id: string, patch: Partial<Omit<UserRecord, 'id' | 'createdAt'>>): UserRecord | undefined {
    const user = state.users[id]
    if (!user) return undefined
    Object.assign(user, patch)
    persist()
    return structuredClone(user)
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

  /** Replaces the owner's lines (bumps the version). The coupon is kept unless given. */
  save(ownerKey: string, items: StoredCartItem[], couponCode: string | null = state.carts[ownerKey]?.couponCode ?? null): CartRecord {
    const previous = state.carts[ownerKey]
    const record: CartRecord = {
      items: structuredClone(items),
      couponCode,
      version: (previous?.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    }
    state.carts[ownerKey] = record
    persist()
    return structuredClone(record)
  },

  delete(ownerKey: string) {
    delete state.carts[ownerKey]
    persist()
  },
}

export const walletsTable = {
  list(userId: string): Wallet[] {
    return structuredClone(state.wallets[userId] ?? [])
  },

  upsert(userId: string, slot: WalletSlot, data: Pick<Wallet, 'label' | 'address' | 'network' | 'connector'>): Wallet {
    const wallets = state.wallets[userId] ?? []
    const wallet: Wallet = { id: `wallet-${userId}-${slot}`, slot, ...data, updatedAt: new Date().toISOString() }
    state.wallets[userId] = [...wallets.filter((w) => w.slot !== slot), wallet].sort((a, b) => a.slot.localeCompare(b.slot))
    // A changed wallet must be connected again before paying.
    if (state.walletConnections[userId] === wallet.id) state.walletConnections[userId] = null
    persist()
    return structuredClone(wallet)
  },

  connected(userId: string): string | null {
    return state.walletConnections[userId] ?? null
  },

  setConnected(userId: string, walletId: string | null) {
    state.walletConnections[userId] = walletId
    persist()
  },

  /** Control endpoint: every simulated connection drops. */
  disconnectAll() {
    state.walletConnections = {}
    persist()
  },
}

export const feesTable = {
  get: (network: Network): string => state.networkFees[network] ?? networkFeeFixtures[network],
  set(network: Network, feeEth: string) {
    state.networkFees[network] = feeEth
    persist()
  },
}

export const quotesTable = {
  save(quote: QuoteRecord) {
    state.quotes[quote.id] = structuredClone(quote)
    persist()
  },
  get: (id: string): QuoteRecord | undefined => (state.quotes[id] ? structuredClone(state.quotes[id]) : undefined),
}

export const ordersTable = {
  create(order: OrderRecord, idempotencyKey: string, bodyHash: string): OrderRecord {
    state.orders[order.id] = structuredClone(order)
    state.idempotency[`${order.userId}:${idempotencyKey}`] = { orderId: order.id, bodyHash }
    persist()
    return structuredClone(order)
  },

  get: (id: string): OrderRecord | undefined => (state.orders[id] ? structuredClone(state.orders[id]) : undefined),

  byIdempotencyKey(userId: string, key: string) {
    const entry = state.idempotency[`${userId}:${key}`]
    return entry ? { ...entry, order: ordersTable.get(entry.orderId) } : undefined
  },

  list(userId: string): OrderRecord[] {
    return Object.values(state.orders)
      .filter((order) => order.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((order) => structuredClone(order))
  },

  pending(): OrderRecord[] {
    return Object.values(state.orders).filter((order) => order.status === 'pending').map((order) => structuredClone(order))
  },

  update(id: string, patch: Partial<Order> & Partial<Pick<OrderRecord, 'resolvesAt'>>): OrderRecord | undefined {
    const order = state.orders[id]
    if (!order) return undefined
    Object.assign(order, patch, { version: order.version + 1, updatedAt: new Date().toISOString() })
    persist()
    return structuredClone(order)
  },
}

/** Confirmation of an order: definitive stock deduction (bumps NFT versions; the caller emits the events). */
export function deductStock(lines: Array<{ nftId: string; editionId: string; quantity: number }>): Nft[] {
  const changed = new Map<string, Nft>()
  for (const line of lines) {
    const nft = state.nfts[line.nftId]
    const edition = nft?.editions.find((e) => e.id === line.editionId)
    if (!nft || !edition) continue
    edition.available = Math.max(0, edition.available - line.quantity)
    changed.set(nft.id, nft)
  }
  for (const nft of changed.values()) {
    nft.version += 1
    nft.updatedAt = new Date().toISOString()
  }
  persist()
  return [...changed.values()].map((nft) => structuredClone(nft))
}
