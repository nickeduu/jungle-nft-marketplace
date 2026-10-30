import { queryOptions } from '@tanstack/react-query'
import { http } from '@/services/api/http'
import type { FavoritesResponse } from '@/shared/contracts'
import { privateKeys } from '@/shared/query-keys'

export async function fetchFavorites(signal: AbortSignal): Promise<FavoritesResponse> {
  const { data } = await http.get<FavoritesResponse>('/favorites', { signal })
  return data
}

export async function setFavorite(nftId: string, favorite: boolean): Promise<FavoritesResponse> {
  const path = `/favorites/${encodeURIComponent(nftId)}`
  const { data } = favorite ? await http.put<FavoritesResponse>(path) : await http.delete<FavoritesResponse>(path)
  return data
}

/** Keyed by user id: another user's list can never be read from this cache entry. */
export const favoritesQuery = (userId: string) =>
  queryOptions({
    queryKey: privateKeys.favorites(userId),
    queryFn: ({ signal }) => fetchFavorites(signal),
  })
