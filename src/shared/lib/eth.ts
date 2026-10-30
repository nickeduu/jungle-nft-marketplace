import type { EthDecimal } from '@/shared/contracts'

/**
 * Exact ETH arithmetic using BigInt wei (1 ETH = 10^18 wei).
 * ETH values travel as decimal strings; never parse them with Number/parseFloat.
 */
const DECIMALS = 18
const WEI_PER_ETH = 10n ** BigInt(DECIMALS)
const ETH_PATTERN = /^\d+(\.\d{1,18})?$/

export function isEthDecimal(value: string): boolean {
  return ETH_PATTERN.test(value)
}

export function toWei(value: EthDecimal): bigint {
  if (!isEthDecimal(value)) {
    throw new Error(`Invalid ETH decimal: "${value}"`)
  }
  const [whole = '0', fraction = ''] = value.split('.')
  return BigInt(whole) * WEI_PER_ETH + BigInt(fraction.padEnd(DECIMALS, '0'))
}

export function fromWei(wei: bigint): EthDecimal {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const whole = abs / WEI_PER_ETH
  const fraction = (abs % WEI_PER_ETH).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

export function addEth(...values: EthDecimal[]): EthDecimal {
  return fromWei(values.reduce((sum, v) => sum + toWei(v), 0n))
}

export function multiplyEth(value: EthDecimal, quantity: number): EthDecimal {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantity must be a non-negative integer, got ${quantity}`)
  }
  return fromWei(toWei(value) * BigInt(quantity))
}

export function compareEth(a: EthDecimal, b: EthDecimal): -1 | 0 | 1 {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

/** Display formatting (string-based, no float conversion). */
export function formatEth(value: EthDecimal, maxFractionDigits = 4): string {
  const [whole = '0', fraction = ''] = value.split('.')
  const trimmed = fraction.slice(0, maxFractionDigits).replace(/0+$/, '')
  return `${whole}${trimmed ? `.${trimmed}` : ''} ETH`
}
