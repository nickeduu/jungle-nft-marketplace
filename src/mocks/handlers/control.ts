import { http, HttpResponse } from 'msw'
import { setActiveScenario, errorResponse, type ScenarioName } from '@/mocks/scenarios'
import { buildNftUpdatedEvent, connectionCount, describeConnections, disconnectAll, emitToAll } from '@/mocks/socket/server'
import { nftsTable, resetDb, sessionsTable, usersTable } from '@/mocks/store/db'
import type { ServerToClientEvents } from '@/shared/contracts'
import { isEthDecimal } from '@/shared/lib/eth'
import { resolveOrder } from '@/mocks/payments'
import { feesTable, walletsTable } from '@/mocks/store/db'
import { NETWORKS } from '@/shared/contracts'
import { changeFavorite } from './favorites'

/**
 * Mock-only "backoffice" endpoints (prefix /api/__mock). They play the role of
 * the backend changing data: they mutate the mock store AND emit the matching
 * Socket.IO event, so REST and realtime stay consistent.
 * Used by Playwright and the demo's mock panel. Not part of the product API.
 */
const base = `${import.meta.env.VITE_API_BASE_URL}/__mock`

interface EditionPatchBody {
  priceEth?: string
  available?: number
  /** true = change the store without emitting (simulates an event lost while offline). */
  silent?: boolean
}

export const controlHandlers = [
  http.post(`${base}/reset`, () => {
    resetDb()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post<never, { name: ScenarioName }>(`${base}/scenario`, async ({ request }) => {
    const { name } = await request.json()
    setActiveScenario(name)
    return new HttpResponse(null, { status: 204 })
  }),

  http.post<{ nftId: string; editionId: string }, EditionPatchBody>(
    `${base}/nfts/:nftId/editions/:editionId`,
    async ({ params, request }) => {
      const { silent = false, ...patch } = await request.json()
      if (patch.priceEth !== undefined && !isEthDecimal(patch.priceEth)) {
        return errorResponse(422, 'VALIDATION_ERROR', 'priceEth inválido.')
      }
      const nft = nftsTable.updateEdition(params.nftId, params.editionId, patch)
      if (!nft) return errorResponse(404, 'NOT_FOUND', 'NFT ou edição não encontrado.')

      const event = buildNftUpdatedEvent(nft)
      if (!silent) emitToAll('nft.updated', event)
      return HttpResponse.json({ event, deliveredTo: silent ? 0 : connectionCount() })
    },
  ),

  /**
   * Re-emits an arbitrary event as-is to EVERY connection (duplicate/stale delivery, and a
   * private event delivered to the wrong session: the client must still drop it).
   */
  http.post<never, { event: keyof ServerToClientEvents; payload: never }>(`${base}/socket/emit`, async ({ request }) => {
    const { event, payload } = await request.json()
    emitToAll(event, payload)
    return HttpResponse.json({ deliveredTo: connectionCount() })
  }),

  /** Which user each open Socket.IO connection is bound to (null = visitor). */
  http.post(`${base}/socket/connections`, () => HttpResponse.json({ connections: describeConnections() })),

  /** Expires every session, or only the sessions of `email` (session expiry scenarios). */
  http.post<never, { email?: string }>(`${base}/sessions/expire`, async ({ request }) => {
    const { email } = await request.json().catch(() => ({ email: undefined }))
    const user = email ? usersTable.findByEmail(email) : undefined
    if (email && !user) return errorResponse(404, 'NOT_FOUND', 'Usuário não encontrado.')
    return HttpResponse.json({ expired: sessionsTable.expire(user?.id) })
  }),

  /** Resolves a pending order (payment-pending scenario): `confirmed` or `rejected`. */
  http.post<{ orderId: string }, { status: 'confirmed' | 'rejected'; reason?: string }>(`${base}/orders/:orderId/resolve`, async ({ request, params }) => {
    const { status, reason } = await request.json()
    if (status !== 'confirmed' && status !== 'rejected') return errorResponse(422, 'VALIDATION_ERROR', 'Use confirmed ou rejected.')
    const order = resolveOrder(params.orderId, status, reason)
    if (!order) return errorResponse(404, 'NOT_FOUND', 'Pedido não encontrado.')
    return HttpResponse.json({ status: order.status, version: order.version })
  }),

  /** The simulated wallet connection of every user drops (wallet disconnected during checkout). */
  http.post(`${base}/wallets/disconnect`, () => {
    walletsTable.disconnectAll()
    return new HttpResponse(null, { status: 204 })
  }),

  /** Changes the network fee (fee change during checkout: the current quote becomes stale). */
  http.post<never, { network: string; feeEth: string }>(`${base}/fees`, async ({ request }) => {
    const { network, feeEth } = await request.json()
    const chosen = NETWORKS.find((n) => n === network)
    if (!chosen || !isEthDecimal(feeEth)) return errorResponse(422, 'VALIDATION_ERROR', 'Rede ou taxa inválida.')
    feesTable.set(chosen, feeEth)
    return new HttpResponse(null, { status: 204 })
  }),

  /** Changes a user's favorites as if from another device: store + private `favorites.updated`. */
  http.post<never, { email: string; nftId: string; favorite: boolean }>(`${base}/favorites`, async ({ request }) => {
    const { email, nftId, favorite } = await request.json()
    const user = usersTable.findByEmail(email)
    if (!user) return errorResponse(404, 'NOT_FOUND', 'Usuário não encontrado.')
    if (!nftsTable.findById(nftId)) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json(changeFavorite(user.id, nftId, favorite))
  }),

  http.post(`${base}/socket/disconnect`, () => {
    disconnectAll()
    return new HttpResponse(null, { status: 204 })
  }),
]
