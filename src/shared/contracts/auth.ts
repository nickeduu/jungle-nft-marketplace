import type { IsoDateTime } from './common'
import type { NftSummary } from './nft'

export interface User {
  id: string
  name: string
  email: string
  username: string
  avatarUrl: string | null
  bio: string
}

/**
 * Returned by register/login and by `GET /api/auth/session` (session recovery after refresh).
 * The token is the only thing the client stores; every private request is validated by the API.
 */
export interface Session {
  user: User
  /** Opaque bearer token sent as `Authorization: Bearer <token>` (and as Socket.IO `auth.token`). */
  token: string
  expiresAt: IsoDateTime
}

export interface LoginRequest {
  email: string
  password: string
}

/**
 * POST /api/auth/register — Figma "Criar perfil de colecionador": username, e-mail, password
 * (the confirmation is checked by the form). The display name starts as the username.
 * Rules (also enforced by the API): username 3–20 chars `[a-z0-9._]` starting with a letter;
 * password ≥ 8 chars with at least one letter and one digit.
 */
export interface RegisterRequest {
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

/**
 * GET /api/favorites, PUT/DELETE /api/favorites/:nftId — the authenticated user's list.
 * `version` increases on every change (also carried by the `favorites.updated` event).
 */
export interface FavoritesResponse {
  /** Most recent first. */
  nftIds: string[]
  /** Summaries of `nftIds`, same order (favorites page). */
  items: NftSummary[]
  version: number
}
