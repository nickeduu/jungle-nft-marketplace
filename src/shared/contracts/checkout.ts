import type { EthDecimal, IsoDateTime } from './common'

/** Networks shown in the Figma (catalog filter and wallet selection). */
export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export type Network = (typeof NETWORKS)[number]

export type WalletSlot = 'primary' | 'secondary'

export interface Wallet {
  id: string
  slot: WalletSlot
  label: string
  address: string
  network: Network
  updatedAt: IsoDateTime
}

export interface UpsertWalletRequest {
  label: string
  address: string
  network: Network
}

export interface QuoteRequest {
  couponCode?: string
  network: Network
}

export interface QuoteLine {
  nftId: string
  editionId: string
  name: string
  quantity: number
  unitPriceEth: EthDecimal
  lineTotalEth: EthDecimal
}

export interface Coupon {
  code: string
  /** Percentage as decimal string, e.g. "10" = 10%. */
  percentOff: string
  expiresAt: IsoDateTime
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
  /** Hash of lines + coupon + fees; changes whenever any input changes. */
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
 * Same key + same body → same order. Same key + different body → 409 IDEMPOTENCY_CONFLICT.
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
  userId: string
  status: OrderStatus
  lines: QuoteLine[]
  coupon: Coupon | null
  subtotalEth: EthDecimal
  discountEth: EthDecimal
  networkFeeEth: EthDecimal
  totalEth: EthDecimal
  network: Network
  walletAddress: string
  buyer: BuyerDetails
  /** Simulated transaction reference; present once confirmed. */
  txHash: string | null
  explorerUrl: string | null
  rejectionReason: string | null
  version: number
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}
