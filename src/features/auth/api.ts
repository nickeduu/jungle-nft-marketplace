import { queryOptions } from '@tanstack/react-query'
import { ApiError, http } from '@/services/api/http'
import { sessionToken } from '@/services/api/session-token'
import type { LoginRequest, RegisterRequest, Session, User } from '@/shared/contracts'
import { authKeys, privateKeys } from '@/shared/query-keys'

export async function register(body: RegisterRequest): Promise<Session> {
  const { data } = await http.post<Session>('/auth/register', body)
  return data
}

export async function login(body: LoginRequest): Promise<Session> {
  const { data } = await http.post<Session>('/auth/login', body)
  return data
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout')
}

/**
 * Session recovery: with a stored token, the API decides whether it is still valid.
 * No token → visitor (no request). 401 → visitor; other failures propagate (retry policy).
 */
export async function fetchSession(signal: AbortSignal): Promise<Session | null> {
  if (!sessionToken.get()) return null
  try {
    const { data } = await http.get<Session>('/auth/session', { signal })
    return data
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function fetchProfile(signal: AbortSignal): Promise<User> {
  const { data } = await http.get<User>('/profile', { signal })
  return data
}

/** Changes only through login/register/logout/expiry (see session.ts), never by time. */
export const sessionQuery = () =>
  queryOptions({
    queryKey: authKeys.session(),
    queryFn: ({ signal }) => fetchSession(signal),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  })

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: privateKeys.profile(userId),
    queryFn: ({ signal }) => fetchProfile(signal),
  })
