import { delay, http, HttpResponse } from 'msw'
import { PAYMENT_DELAY_MS, schedulePayment, settleIfDue } from '@/mocks/payments'
import { applyScenario, errorResponse, getActiveScenarioName } from '@/mocks/scenarios'
import { feesTable, ordersTable, quotesTable, walletsTable, type OrderRecord, type PaymentOutcome } from '@/mocks/store/db'
import { NETWORKS, NETWORK_LABELS, type CreateOrderRequest, type Order, type OrderSummary, type Quote, type QuoteLine } from '@/shared/contracts'
import { validateEmail } from '@/shared/lib/account-rules'
import { addEth, multiplyEth, percentOfEth, subtractEth } from '@/shared/lib/eth'
import { validateFullName } from '@/shared/lib/wallet-rules'
import { authenticate } from './auth'
import { editionOf, findCoupon, isExpired, reconcile } from './cart'

const base = import.meta.env.VITE_API_BASE_URL
const QUOTE_TTL_MS = 10 * 60 * 1000
/** order-timeout scenario: the order is created, but the answer arrives after the client's timeout. */
export const ORDER_TIMEOUT_DELAY_MS = 6_000

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type Priced = Omit<Quote, 'id' | 'expiresAt'>

/**
 * Prices the user's cart now: current edition prices, coupon re-validated, fee of the network.
 * Any sold-out line or invalid/expired coupon is a conflict the user must resolve in the cart.
 */
async function priceCart(userId: string, network: Quote['network']): Promise<Priced | Response> {
  const cart = reconcile(`user:${userId}`)
  if (cart.items.length === 0) return errorResponse(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio.')
  const lines: QuoteLine[] = []
  for (const item of cart.items) {
    const found = editionOf(item.nftId, item.editionId)
    if (!found || found.maxQuantity === 0) {
      return errorResponse(409, 'AVAILABILITY_CONFLICT', `${found?.nft.name ?? 'Um item'} (edição ${found?.edition.name ?? '?'}) esgotou. Remova-o do carrinho.`)
    }
    const { nft, edition } = found
    lines.push({
      nftId: nft.id,
      editionId: edition.id,
      name: nft.name,
      imageUrl: nft.images[0] ?? '',
      tokenId: nft.tokenId,
      editionName: edition.name,
      quantity: item.quantity,
      unitPriceEth: edition.priceEth,
      lineTotalEth: multiplyEth(edition.priceEth, item.quantity),
    })
  }
  const coupon = cart.couponCode ? findCoupon(cart.couponCode) : undefined
  if (cart.couponCode && !coupon) return errorResponse(409, 'COUPON_INVALID', 'O cupom aplicado não é mais válido. Remova-o no carrinho.')
  if (coupon && isExpired(coupon)) return errorResponse(409, 'COUPON_EXPIRED', 'O cupom aplicado expirou. Remova-o no carrinho.')

  const subtotalEth = addEth('0', ...lines.map((line) => line.lineTotalEth))
  const discountEth = coupon ? percentOfEth(subtotalEth, coupon.percentOff) : '0'
  const networkFeeEth = feesTable.get(network)
  const totalEth = addEth(subtractEth(subtotalEth, discountEth), networkFeeEth)
  const fingerprint = await sha256(
    JSON.stringify({
      lines: lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPriceEth]),
      coupon: coupon ? [coupon.code, coupon.percentOff] : null,
      network,
      networkFeeEth,
      totalEth,
    }),
  )
  return { lines, coupon: coupon ?? null, subtotalEth, discountEth, networkFeeEth, totalEth, network, fingerprint }
}

/** Internal fields (owner, simulated outcome, schedule) never leave the API. */
function toPublicOrder(record: OrderRecord): Order {
  const order: Partial<OrderRecord> = { ...record }
  delete order.userId
  delete order.outcome
  delete order.resolvesAt
  return order as Order
}

const toSummary = (order: Order): OrderSummary => ({
  id: order.id,
  status: order.status,
  totalEth: order.totalEth,
  createdAt: order.createdAt,
  version: order.version,
  itemCount: order.lines.reduce((sum, line) => sum + line.quantity, 0),
})

function outcomeFor(): PaymentOutcome {
  const scenario = getActiveScenarioName()
  if (scenario === 'payment-rejected') return 'rejected'
  if (scenario === 'payment-pending') return 'manual'
  return 'confirmed'
}

async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}

export const checkoutHandlers = [
  /** Quote for the current cart on a network: the reference to create the order (fingerprint). */
  http.post(`${base}/quotes`, async ({ request }) => {
    const auth = authenticate(request)
    if (auth instanceof Response) return auth
    const { network } = await readJson<{ network: string }>(request)
    const failure = await applyScenario('quote')
    if (failure) return failure
    const chosen = NETWORKS.find((n) => n === network)
    if (!chosen) return errorResponse(422, 'VALIDATION_ERROR', 'Rede inválida.', { network: 'Selecione a rede.' })
    const priced = await priceCart(auth.user.id, chosen)
    if (priced instanceof Response) return priced
    const quote: Quote = { ...priced, id: crypto.randomUUID(), expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString() }
    quotesTable.save({ ...quote, userId: auth.user.id })
    return HttpResponse.json<Quote>(quote)
  }),

  /**
   * Idempotent order creation (header Idempotency-Key). Same key + same body → the same order;
   * same key + another body → 409. The quote must still match the current prices/stock/coupon/fee
   * (otherwise 409 PRICE_CHANGED) and the wallet must be connected on the chosen network.
   */
  http.post(`${base}/orders`, async ({ request }) => {
    const auth = authenticate(request)
    if (auth instanceof Response) return auth
    const key = request.headers.get('Idempotency-Key')?.trim()
    const body = await readJson<CreateOrderRequest>(request)
    const failure = await applyScenario('order-create')
    if (failure) return failure
    if (!key || key.length > 100) return errorResponse(422, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key obrigatório.')

    const bodyHash = await sha256(JSON.stringify([body.quoteId, body.quoteFingerprint, body.walletId, body.network, body.buyer?.fullName, body.buyer?.email]))
    const previous = ordersTable.byIdempotencyKey(auth.user.id, key)
    if (previous) {
      if (previous.bodyHash !== bodyHash) {
        return errorResponse(409, 'IDEMPOTENCY_CONFLICT', 'Esta tentativa de compra já foi usada com outros dados.')
      }
      if (previous.order) return HttpResponse.json<Order>(toPublicOrder(settleIfDue(previous.order)))
    }

    const fieldErrors: Record<string, string> = {}
    const nameError = validateFullName(body.buyer?.fullName ?? '')
    const emailError = validateEmail(body.buyer?.email ?? '')
    if (nameError) fieldErrors['buyer.fullName'] = nameError
    if (emailError) fieldErrors['buyer.email'] = emailError
    const network = NETWORKS.find((n) => n === body.network)
    if (!network) fieldErrors.network = 'Selecione a rede.'
    const wallet = walletsTable.list(auth.user.id).find((w) => w.id === body.walletId)
    if (!wallet) fieldErrors.walletId = 'Selecione uma carteira cadastrada.'
    else if (network && wallet.network !== network) fieldErrors.network = `A carteira ${wallet.label} está na rede ${NETWORK_LABELS[wallet.network]}.`
    if (Object.keys(fieldErrors).length > 0) return errorResponse(422, 'VALIDATION_ERROR', 'Revise os dados do pedido.', fieldErrors)
    if (!wallet || !network) return errorResponse(422, 'VALIDATION_ERROR', 'Revise os dados do pedido.')
    if (walletsTable.connected(auth.user.id) !== wallet.id) {
      return errorResponse(409, 'WALLET_DISCONNECTED', 'A carteira foi desconectada. Conecte-a novamente para pagar.')
    }

    const quote = typeof body.quoteId === 'string' ? quotesTable.get(body.quoteId) : undefined
    if (!quote || quote.userId !== auth.user.id) return errorResponse(404, 'NOT_FOUND', 'Cotação não encontrada.')
    if (Date.parse(quote.expiresAt) <= Date.now()) return errorResponse(409, 'QUOTE_EXPIRED', 'A cotação expirou. Revise os valores atualizados.')
    const current = await priceCart(auth.user.id, network)
    if (current instanceof Response) return current
    if (current.fingerprint !== quote.fingerprint || body.quoteFingerprint !== quote.fingerprint || quote.network !== network) {
      return errorResponse(409, 'PRICE_CHANGED', 'Preço, disponibilidade, cupom ou taxa mudaram. Revise os novos valores e confirme novamente.')
    }

    const now = new Date()
    const outcome = outcomeFor()
    const order = ordersTable.create(
      {
        id: `order-${crypto.randomUUID().slice(0, 8)}`,
        userId: auth.user.id,
        status: 'pending',
        lines: quote.lines,
        coupon: quote.coupon,
        subtotalEth: quote.subtotalEth,
        discountEth: quote.discountEth,
        networkFeeEth: quote.networkFeeEth,
        totalEth: quote.totalEth,
        network,
        walletLabel: wallet.label,
        walletAddress: wallet.address,
        walletConnector: wallet.connector,
        buyer: { fullName: body.buyer!.fullName.trim(), email: body.buyer!.email.trim() },
        txHash: null,
        rejectionReason: null,
        version: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        outcome,
        resolvesAt: outcome === 'manual' ? null : new Date(now.getTime() + PAYMENT_DELAY_MS).toISOString(),
      },
      key,
      bodyHash,
    )
    schedulePayment(order)
    // The order exists from here on; in this scenario the answer is lost to the client's timeout.
    if (getActiveScenarioName() === 'order-timeout') await delay(ORDER_TIMEOUT_DELAY_MS)
    return HttpResponse.json<Order>(toPublicOrder(order), { status: 201 })
  }),

  http.get(`${base}/orders`, async ({ request }) => {
    const auth = authenticate(request)
    const failure = await applyScenario('orders')
    if (failure) return failure
    if (auth instanceof Response) return auth
    const status = new URL(request.url).searchParams.get('status')
    const orders = ordersTable
      .list(auth.user.id)
      .map(settleIfDue)
      .filter((order) => !status || order.status === status)
    return HttpResponse.json<OrderSummary[]>(orders.map((order) => toSummary(toPublicOrder(order))))
  }),

  /** Another user's order answers 404 (its existence is not revealed). */
  http.get<{ orderId: string }>(`${base}/orders/:orderId`, async ({ request, params }) => {
    const auth = authenticate(request)
    const order = auth instanceof Response ? undefined : ordersTable.get(params.orderId)
    const failure = await applyScenario('order')
    if (failure) return failure
    if (auth instanceof Response) return auth
    if (!order || order.userId !== auth.user.id) return errorResponse(404, 'NOT_FOUND', 'Pedido não encontrado.')
    return HttpResponse.json<Order>(toPublicOrder(settleIfDue(order)))
  }),
]
