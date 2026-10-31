import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentUserId } from '@/features/auth/session'
import { http } from '@/services/api/http'
import type { UpsertWalletRequest, WalletSlot, WalletsResponse } from '@/shared/contracts'
import { privateKeys } from '@/shared/query-keys'

export async function fetchWallets(signal: AbortSignal): Promise<WalletsResponse> {
  const { data } = await http.get<WalletsResponse>('/wallets', { signal })
  return data
}

/** The user's wallets and which one is connected (private, keyed by user id). */
export function useWallets(userId: string) {
  return useQuery({ queryKey: privateKeys.wallets(userId), queryFn: ({ signal }) => fetchWallets(signal) })
}

/** Every wallet write answers the full list: it becomes the cache (no separate refetch). */
function useWalletWrite<V>(request: (variables: V) => Promise<WalletsResponse>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: request,
    onSuccess: (data) => {
      const userId = currentUserId(queryClient)
      if (userId) queryClient.setQueryData(privateKeys.wallets(userId), data)
    },
  })
}

export const useSaveWallet = () =>
  useWalletWrite(async ({ slot, body }: { slot: WalletSlot; body: UpsertWalletRequest }) => (await http.put<WalletsResponse>(`/wallets/${slot}`, body)).data)

/** Simulated connection: the connector may refuse (403 WALLET_REJECTED). */
export const useConnectWallet = () =>
  useWalletWrite(async (slot: WalletSlot) => (await http.post<WalletsResponse>(`/wallets/${slot}/connect`)).data)

export const useDisconnectWallet = () => useWalletWrite(async () => (await http.post<WalletsResponse>('/wallets/disconnect')).data)
