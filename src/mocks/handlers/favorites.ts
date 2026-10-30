import { http, HttpResponse } from 'msw'
import { applyScenario, errorResponse } from '@/mocks/scenarios'
import { buildFavoritesUpdatedEvent, emitToUser } from '@/mocks/socket/server'
import { favoritesTable, nftsTable } from '@/mocks/store/db'
import type { FavoritesResponse } from '@/shared/contracts'
import { authenticate } from './auth'
import { toSummary } from './nft-query'

const base = import.meta.env.VITE_API_BASE_URL

export function favoritesResponse(userId: string): FavoritesResponse {
  const { nftIds, version } = favoritesTable.get(userId)
  const items = nftIds.flatMap((id) => {
    const nft = nftsTable.findById(id)
    return nft ? [toSummary(nft)] : []
  })
  return { nftIds: items.map((item) => item.id), items, version }
}

/**
 * Applies a favorite change for `userId` and notifies that user's other sessions/devices
 * (`favorites.updated` is private: emitToUser never reaches another user's connection).
 */
export function changeFavorite(userId: string, nftId: string, favorite: boolean) {
  const { record, changed } = favoritesTable.set(userId, nftId, favorite)
  const deliveredTo = changed ? emitToUser(userId, 'favorites.updated', buildFavoritesUpdatedEvent(userId, record)) : 0
  return { deliveredTo }
}

/** Private endpoints: the list always belongs to the session's user (no user id in the URL). */
export const favoriteHandlers = [
  http.get(`${base}/favorites`, async ({ request }) => {
    const auth = authenticate(request)
    const failure = await applyScenario('favorites')
    if (failure) return failure
    if (auth instanceof Response) return auth
    return HttpResponse.json<FavoritesResponse>(favoritesResponse(auth.user.id))
  }),

  http.put<{ nftId: string }>(`${base}/favorites/:nftId`, async ({ request, params }) => {
    const auth = authenticate(request)
    if (auth instanceof Response) return auth
    // Failure before the write: a failed request never changes the stored list.
    const failure = await applyScenario('favorite-write')
    if (failure) return failure
    if (!nftsTable.findById(params.nftId)) return errorResponse(404, 'NOT_FOUND', 'NFT não encontrado.')
    changeFavorite(auth.user.id, params.nftId, true)
    return HttpResponse.json<FavoritesResponse>(favoritesResponse(auth.user.id))
  }),

  http.delete<{ nftId: string }>(`${base}/favorites/:nftId`, async ({ request, params }) => {
    const auth = authenticate(request)
    if (auth instanceof Response) return auth
    const failure = await applyScenario('favorite-write')
    if (failure) return failure
    changeFavorite(auth.user.id, params.nftId, false)
    return HttpResponse.json<FavoritesResponse>(favoritesResponse(auth.user.id))
  }),
]
