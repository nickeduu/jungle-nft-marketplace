import { NETWORKS, WALLET_CONNECTORS, type Network, type UpsertWalletRequest } from '@/shared/contracts'

/**
 * Wallet and buyer field rules shared by the forms and the simulated API (which enforces them
 * again and answers 422 with `fieldErrors`). Addresses are format checks only (fictitious wallets).
 */
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function validateWalletAddress(address: string, network: Network | ''): string | null {
  const value = address.trim()
  if (!value) return 'Informe o endereço da carteira.'
  if (network === 'solana') return SOLANA_ADDRESS.test(value) ? null : 'Endereço Solana inválido (32 a 44 caracteres base58).'
  return EVM_ADDRESS.test(value) ? null : 'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.'
}

export function validateWallet(input: Partial<Record<keyof UpsertWalletRequest, unknown>>): Partial<Record<keyof UpsertWalletRequest, string>> {
  const errors: Partial<Record<keyof UpsertWalletRequest, string>> = {}
  const label = typeof input.label === 'string' ? input.label.trim() : ''
  if (label.length < 2 || label.length > 30) errors.label = 'Use de 2 a 30 caracteres.'
  const network = NETWORKS.find((n) => n === input.network)
  if (!network) errors.network = 'Selecione a rede.'
  if (!WALLET_CONNECTORS.some((c) => c === input.connector)) errors.connector = 'Selecione o tipo de carteira.'
  const addressError = validateWalletAddress(typeof input.address === 'string' ? input.address : '', network ?? '')
  if (addressError) errors.address = addressError
  return errors
}

export function validateFullName(value: string): string | null {
  const name = value.trim()
  if (!name) return 'Informe o nome completo.'
  if (name.length < 3 || name.length > 80) return 'Use de 3 a 80 caracteres.'
  return null
}
