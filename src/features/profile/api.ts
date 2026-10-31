import { useMutation, useQueryClient } from '@tanstack/react-query'
import { currentUserId } from '@/features/auth/session'
import { http } from '@/services/api/http'
import type { ChangePasswordRequest, Session, UpdateProfileRequest, User } from '@/shared/contracts'
import { authKeys, privateKeys } from '@/shared/query-keys'

/** The API answer becomes the profile and the session's user (header name/avatar follow at once). */
export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateProfileRequest) => (await http.patch<User>('/profile', body)).data,
    onSuccess: (user) => {
      if (currentUserId(queryClient) !== user.id) return
      queryClient.setQueryData(privateKeys.profile(user.id), user)
      queryClient.setQueryData<Session | null>(authKeys.session(), (session) => (session ? { ...session, user } : session))
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (body: ChangePasswordRequest) => {
      await http.post('/profile/password', body)
    },
  })
}
