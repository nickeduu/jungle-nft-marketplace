import { buildNftUpdatedEvent, buildOrderUpdatedEvent, emitToAll, emitToUser } from '@/mocks/socket/server'
import { deductStock, nftsTable, ordersTable, type OrderRecord } from '@/mocks/store/db'
import { removePurchased } from './handlers/cart'

/** Time the simulated payment network takes to confirm/refuse an order. */
export const PAYMENT_DELAY_MS = 1500
const DEFAULT_REJECTION = 'Pagamento recusado pela carteira (simulação).'

const timers = new Map<string, ReturnType<typeof setTimeout>>()

const fakeTxHash = () => `0x${[...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')}`

/**
 * Ends a pending order (terminal states never change again) and notifies its owner through the
 * private `order.updated`. Confirmation is the only moment stock is deducted and the purchased
 * quantities leave the cart; if stock no longer covers the order, it is refused instead.
 */
export function resolveOrder(orderId: string, status: 'confirmed' | 'rejected', reason?: string): OrderRecord | undefined {
  const order = ordersTable.get(orderId)
  if (!order || order.status !== 'pending') return order
  clearTimeout(timers.get(orderId))
  timers.delete(orderId)

  let finalStatus = status
  let rejectionReason = status === 'rejected' ? (reason ?? DEFAULT_REJECTION) : null
  if (status === 'confirmed') {
    const short = order.lines.find((line) => {
      const edition = nftsTable.findById(line.nftId)?.editions.find((e) => e.id === line.editionId)
      return !edition || edition.available < line.quantity
    })
    if (short) {
      finalStatus = 'rejected'
      rejectionReason = `Estoque insuficiente na confirmação: ${short.name} (edição ${short.editionName}).`
    } else {
      for (const nft of deductStock(order.lines)) emitToAll('nft.updated', buildNftUpdatedEvent(nft))
      removePurchased(order.userId, order.lines)
    }
  }
  const updated = ordersTable.update(orderId, {
    status: finalStatus,
    txHash: finalStatus === 'confirmed' ? fakeTxHash() : null,
    rejectionReason,
    resolvesAt: null,
  })
  if (updated) emitToUser(updated.userId, 'order.updated', buildOrderUpdatedEvent(updated))
  return updated
}

function settle(order: OrderRecord) {
  if (order.outcome !== 'manual') resolveOrder(order.id, order.outcome)
}

/** Schedules the automatic outcome; `manual` orders stay pending until a control endpoint resolves them. */
export function schedulePayment(order: OrderRecord) {
  if (order.status !== 'pending' || !order.resolvesAt || timers.has(order.id)) return
  const wait = Math.max(0, Date.parse(order.resolvesAt) - Date.now())
  timers.set(order.id, setTimeout(() => settle(order), wait))
}

/** Lazy catch-up: an order whose payment time passed while the page (and its timers) was gone. */
export function settleIfDue(order: OrderRecord): OrderRecord {
  if (order.status === 'pending' && order.resolvesAt && Date.parse(order.resolvesAt) <= Date.now() && order.outcome !== 'manual') {
    return resolveOrder(order.id, order.outcome) ?? order
  }
  return order
}

/** Called when the mock starts (reload / reopened app): resumes pending payments. */
export function resumePendingPayments() {
  for (const order of ordersTable.pending()) schedulePayment(order)
}
