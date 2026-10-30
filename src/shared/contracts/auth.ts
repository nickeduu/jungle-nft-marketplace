import type { IsoDateTime } from './common'

export interface User {
  id: string
  name: string
  email: string
  username: string
  avatarUrl: string | null
  bio: string
}

export interface Session {
  user: User
  /** Opaque bearer token sent as `Authorization: Bearer <token>`. */
  token: string
  expiresAt: IsoDateTime
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  username: string
  email: string
  password: string
}

export interface UpdateProfileRequest {
  name?: string
  username?: string
  bio?: string
  /** Data URL or uploaded asset URL. `null` removes the avatar. */
  avatarUrl?: string | null
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface FavoritesResponse {
  nftIds: string[]
}
