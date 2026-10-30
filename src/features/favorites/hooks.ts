import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useFeedback } from '@/components/feedback/FeedbackProvider'
import type { FavoritesResponse } from '@/shared/contracts'
import { privateKeys } from '@/shared/query-keys'
import { currentUserId, useSession } from '@/features/auth/session'
import { fetchFavorites, setFavorite } from './api'

const EMPTY = new Set<string>()

/** Favorite ids of the signed-in user (empty for visitors; no request is made). */
export function useFavoriteIds() {
  const { user } = useSession()
  const query = useQuery({
    queryKey: privateKeys.favorites(user?.id ?? 'visitor'),
    queryFn: user ? ({ signal }) => fetchFavorites(signal) : skipToken,
  })
  const ids = useMemo(() => (query.data ? new Set(query.data.nftIds) : EMPTY), [query.data])
  return { ids, isLoading: user !== null && query.isPending }
}

interface ToggleVariables {
  userId: string
  nftId: string
  nftName: string
  favorite: boolean
}

const TOGGLE_KEY = ['favorites', 'toggle'] as const

/** The request carries whatever token is current when it is sent: it must still be this user's. */
class SessionChangedError extends Error {
  constructor() {
    super('A sessão mudou antes do envio.')
  }
}

/** Cache after the change: optimistic (ids only; the list's summaries are confirmed by the API). */
function toggled(current: FavoritesResponse, nftId: string, favorite: boolean): FavoritesResponse {
  const without = current.nftIds.filter((id) => id !== nftId)
  return {
    ...current,
    nftIds: favorite ? [nftId, ...without] : without,
    items: favorite ? current.items : current.items.filter((item) => item.id !== nftId),
  }
}

/**
 * Optimistic add/remove (README: optimistic update with rollback):
 * 1. onMutate: cancel in-flight reads, snapshot, apply the change to the cache immediately;
 * 2. success: the API response (with its version) becomes the cache;
 * 3. error: the snapshot is restored and the user is told the change was undone.
 * With several toggles in flight only the last one to settle writes/refetches, so an older
 * response never overwrites a newer optimistic state. Callbacks of a previous session are
 * dropped (the user switched meanwhile): they must not recreate that user's private cache.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const notify = useFeedback()

  const isLastToggle = () => queryClient.isMutating({ mutationKey: TOGGLE_KEY }) === 1

  return useMutation({
    mutationKey: TOGGLE_KEY,
    mutationFn: ({ userId, nftId, favorite }: ToggleVariables) => {
      if (currentUserId(queryClient) !== userId) throw new SessionChangedError()
      return setFavorite(nftId, favorite)
    },
    onMutate: async ({ userId, nftId, favorite }) => {
      const key = privateKeys.favorites(userId)
      await queryClient.cancelQueries({ queryKey: key })
      // Signed out/switched user while waiting: never write into a removed private cache.
      if (currentUserId(queryClient) !== userId) return { previous: undefined }
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      if (previous) queryClient.setQueryData<FavoritesResponse>(key, toggled(previous, nftId, favorite))
      return { previous }
    },
    onSuccess: (data, { userId, nftName, favorite }) => {
      if (currentUserId(queryClient) !== userId) return
      if (isLastToggle()) queryClient.setQueryData(privateKeys.favorites(userId), data)
      notify(favorite ? `${nftName} foi adicionado aos favoritos.` : `${nftName} foi removido dos favoritos.`, 'success')
    },
    onError: (_error, { userId, nftName, favorite }, context) => {
      if (currentUserId(queryClient) !== userId) return
      if (context?.previous) queryClient.setQueryData(privateKeys.favorites(userId), context.previous)
      if (isLastToggle()) void queryClient.invalidateQueries({ queryKey: privateKeys.favorites(userId) })
      notify(
        `Não foi possível ${favorite ? 'adicionar' : 'remover'} ${nftName} ${favorite ? 'aos' : 'dos'} favoritos. A alteração foi desfeita.`,
        'error',
      )
    },
  })
}
