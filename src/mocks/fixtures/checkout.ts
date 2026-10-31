import type { Coupon, Network, Wallet } from '@/shared/contracts'

/** Fictitious coupons (README: valid, invalid and expired cases). Unknown codes are invalid. */
export const couponFixtures: Coupon[] = [
  { code: 'KURIO10', percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'LANCAMENTO5', percentOff: 5, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'EXPIRADO', percentOff: 20, expiresAt: '2025-01-01T00:00:00.000Z' },
]

/** Simulated network fees per order (Figma "Taxa de rede"); changeable through a control endpoint. */
export const networkFeeFixtures: Record<Network, string> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

/** Fictitious wallets (addresses are not real accounts). Bruno has no secondary wallet. */
export const walletFixtures: Record<string, Wallet[]> = {
  'user-ana': [
    {
      id: 'wallet-ana-primary',
      slot: 'primary',
      label: 'Principal',
      address: '0xa91f3c27b5d40861f0a2c4e7b9d1f3a5c8e0e82c',
      network: 'ethereum',
      connector: 'metamask',
      updatedAt: '2026-01-05T12:00:00.000Z',
    },
    {
      id: 'wallet-ana-secondary',
      slot: 'secondary',
      label: 'Reserva',
      address: '0x4c0de2b17a9f3e5d6c8b1a2f3e4d5c6b7a8f9e01',
      network: 'polygon',
      connector: 'coinbase',
      updatedAt: '2026-01-05T12:00:00.000Z',
    },
  ],
  'user-bruno': [
    {
      id: 'wallet-bruno-primary',
      slot: 'primary',
      label: 'Carteira do Bruno',
      address: '0x7b2e9c14d0a85f6301b2c3d4e5f60718293a4b5c',
      network: 'polygon',
      connector: 'walletconnect',
      updatedAt: '2026-01-06T12:00:00.000Z',
    },
  ],
}
