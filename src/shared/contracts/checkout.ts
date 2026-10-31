import type { EthDecimal, IsoDateTime } from './common'

/** Networks shown in the Figma (catalog filter and wallet selection). */
export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof NETWORKS)[number]

/** Display names of the networks (same labels as the catalog facets). */
export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

export type WalletSlot = 'primary' | 'secondary'

/** Simulated wallet apps (Figma: WalletConnect, MetaMask, Coinbase Wallet). No real extension is used. */
export const WALLET_CONNECTORS = ['metamask', 'walletconnect', 'coinbase'] as const
export type WalletConnector = (typeof WALLET_CONNECTORS)[number]

export const WALLET_CONNECTOR_LABELS: Record<WalletConnector, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

/** A registered wallet of the signed-in user (Figma desktop-09: principal and secondary). */
export interface Wallet {
  id: string
  slot: WalletSlot
  /** "Apelido da carteira". */
  label: string
  address: string
  network: Network
  connector: WalletConnector
  updatedAt: IsoDateTime
}

/** PUT /api/wallets/:slot — creates or replaces the wallet of that slot. */
export interface UpsertWalletRequest {
  label: string
  address: string
  network: Network
  connector: WalletConnector
}

/**
 * GET /api/wallets. `connectedWalletId` is the wallet "connected" for payment (simulated
 * connection: POST /api/wallets/:slot/connect | /disconnect; the connector may refuse).
 */
export interface WalletsResponse {
  wallets: Wallet[]
  connectedWalletId: string | null
}

/** Coupon applied to the cart (PUT /api/cart/coupon). */
export interface Coupon {
  code: string
  /** Integer percentage, e.g. 10 = 10%. */
  percentOff: number
  expiresAt: IsoDateTime
}

export interface ApplyCouponRequest {
  code: string
}

/** POST /api/quotes — the quote is computed from the user's cart (items, coupon) and the network fee. */
export interface QuoteRequest {
  network: Network
}

/** A priced line; also the immutable line of an order (receipt snapshot). */
export interface QuoteLine {
  nftId: string
  editionId: string
  name: string
  imageUrl: string
  tokenId: string
  editionName: string
  quantity: number
  unitPriceEth: EthDecimal
  lineTotalEth: EthDecimal
}

export interface Quote {
  id: string
  lines: QuoteLine[]
  coupon: Coupon | null
  subtotalEth: EthDecimal
  discountEth: EthDecimal
  networkFeeEth: EthDecimal
  totalEth: EthDecimal
  network: Network
  /** Hash of lines + coupon + network + fee + total; changes whenever any input changes. */
  fingerprint: string
  expiresAt: IsoDateTime
}

export type OrderStatus = 'pending' | 'confirmed' | 'rejected'

export interface BuyerDetails {
  fullName: string
  email: string
}

/**
 * POST /api/orders — requires header `Idempotency-Key: <uuid>`.
 * Same key + same body → same order (200). Same key + different body → 409 IDEMPOTENCY_CONFLICT.
 * The quote must be current (fingerprint) and the wallet connected on the chosen network.
 */
export interface CreateOrderRequest {
  quoteId: string
  quoteFingerprint: string
  walletId: string
  network: Network
  buyer: BuyerDetails
}

/** Immutable snapshot taken at order creation; later catalog changes never alter it. */
export interface Order {
  id: string
  status: OrderStatus
  lines: QuoteLine[]
  coupon: Coupon | null
  subtotalEth: EthDecimal
  discountEth: EthDecimal
  networkFeeEth: EthDecimal
  totalEth: EthDecimal
  network: Network
  walletLabel: string
  walletAddress: string
  walletConnector: WalletConnector
  buyer: BuyerDetails
  /** Simulated transaction reference; present once confirmed. Not a real on-chain transaction. */
  txHash: string | null
  rejectionReason: string | null
  /** Increases on every status change (also carried by `order.updated`). */
  version: number
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

/** GET /api/orders?status= — the user's orders, newest first. */
export type OrderSummary = Pick<Order, 'id' | 'status' | 'totalEth' | 'createdAt' | 'version'> & { itemCount: number }
