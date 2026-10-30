import { http, HttpResponse } from 'msw'
import { setActiveScenario, errorResponse, type ScenarioName } from '@/mocks/scenarios'
import { buildNftUpdatedEvent, connectionCount, disconnectAll, emitToAll } from '@/mocks/socket/server'
import { nftsTable, resetDb } from '@/mocks/store/db'
import type { NftUpdatedEvent } from '@/shared/contracts'
import { isEthDecimal } from '@/shared/lib/eth'

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

  /** Re-emits an arbitrary event as-is (duplicate/stale delivery scenarios). */
  http.post<never, { event: 'nft.updated'; payload: NftUpdatedEvent }>(`${base}/socket/emit`, async ({ request }) => {
    const { event, payload } = await request.json()
    emitToAll(event, payload)
    return HttpResponse.json({ deliveredTo: connectionCount() })
  }),

  http.post(`${base}/socket/disconnect`, () => {
    disconnectAll()
    return new HttpResponse(null, { status: 204 })
  }),
]
