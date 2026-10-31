import { http, HttpResponse } from 'msw'
import { applyScenario, errorResponse, getActiveScenarioName } from '@/mocks/scenarios'
import { walletsTable } from '@/mocks/store/db'
import type { UpsertWalletRequest, WalletSlot, WalletsResponse } from '@/shared/contracts'
import { validateWallet } from '@/shared/lib/wallet-rules'
import { authenticate } from './auth'

const base = import.meta.env.VITE_API_BASE_URL
const SLOTS: WalletSlot[] = ['primary', 'secondary']

const walletsResponse = (userId: string): WalletsResponse => ({
  wallets: walletsTable.list(userId),
  connectedWalletId: walletsTable.connected(userId),
})

async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}

/** Private: always the session user's wallets (no user id in the URL). */
export const walletHandlers = [
  http.get(`${base}/wallets`, async ({ request }) => {
    const auth = authenticate(request)
    const failure = await applyScenario('wallets')
    if (failure) return failure
    if (auth instanceof Response) return auth
    return HttpResponse.json<WalletsResponse>(walletsResponse(auth.user.id))
  }),

  /** Creates or replaces the wallet of a slot (principal / secundária). */
  http.put<{ slot: string }>(`${base}/wallets/:slot`, async ({ request, params }) => {
    const auth = authenticate(request)
    if (auth instanceof Response) return auth
    const body = await readJson<UpsertWalletRequest>(request)
    const failure = await applyScenario('wallet-write')
    if (failure) return failure
    const slot = SLOTS.find((s) => s === params.slot)
    if (!slot) return errorResponse(404, 'NOT_FOUND', 'Carteira não encontrada.')
    const fieldErrors = validateWallet(body)
    if (Object.keys(fieldErrors).length > 0) return errorResponse(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', fieldErrors)
    const { label, address, network, connector } = body as UpsertWalletRequest
    walletsTable.upsert(auth.user.id, slot, { label: label.trim(), address: address.trim(), network, connector })
    return HttpResponse.json<WalletsResponse>(walletsResponse(auth.user.id))
  }),

  /** Simulated connection: the connector "asks" the user, who may refuse (scenario wallet-reject). */
  http.post<{ slot: string }>(`${base}/wallets/:slot/connect`, async ({ request, params }) => {
    const auth = authenticate(request)
    if (auth instanceof Response) return auth
    const failure = await applyScenario('wallet-connect')
    if (failure) return failure
    const wallet = walletsTable.list(auth.user.id).find((w) => w.slot === params.slot)
    if (!wallet) return errorResponse(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (getActiveScenarioName() === 'wallet-reject') {
      return errorResponse(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    }
    walletsTable.setConnected(auth.user.id, wallet.id)
    return HttpResponse.json<WalletsResponse>(walletsResponse(auth.user.id))
  }),

  http.post(`${base}/wallets/disconnect`, async ({ request }) => {
    const auth = authenticate(request)
    if (auth instanceof Response) return auth
    const failure = await applyScenario('wallet-connect')
    if (failure) return failure
    walletsTable.setConnected(auth.user.id, null)
    return HttpResponse.json<WalletsResponse>(walletsResponse(auth.user.id))
  }),
]
