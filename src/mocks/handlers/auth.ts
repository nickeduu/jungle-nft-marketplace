import { http, HttpResponse } from 'msw'
import { hashPassword, newSalt, verifyPassword } from '@/mocks/auth/password'
import { applyScenario, errorResponse } from '@/mocks/scenarios'
import { sessionsTable, toPublicUser, usersTable } from '@/mocks/store/db'
import type { LoginRequest, RegisterRequest, Session, User } from '@/shared/contracts'
import { validateEmail, validateNewPassword, validateUsername } from '@/shared/lib/account-rules'
import type { UserRecord } from '@/mocks/fixtures/users'

const base = import.meta.env.VITE_API_BASE_URL

/** `Authorization: Bearer <token>` → token, or null. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization')
  const match = header?.match(/^Bearer (\S+)$/)
  return match?.[1] ?? null
}

/**
 * Resolves the authenticated user of a request. Every private endpoint goes through here:
 * the user comes from the server-side session, never from ids sent by the client.
 */
export function authenticate(request: Request): { user: UserRecord; token: string } | Response {
  const token = bearerToken(request)
  const lookup = sessionsTable.lookup(token)
  if (lookup.status === 'expired') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  if (lookup.status === 'missing' || !token) return errorResponse(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.')
  const user = usersTable.findById(lookup.session.userId)
  if (!user) return errorResponse(401, 'UNAUTHENTICATED', 'Entre na sua conta para continuar.')
  return { user, token }
}

function toSession(user: UserRecord, token: string, expiresAt: string): Session {
  return { user: toPublicUser(user), token, expiresAt }
}

async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>
  } catch {
    return {}
  }
}

const asText = (value: unknown) => (typeof value === 'string' ? value : '')

export const authHandlers = [
  http.post(`${base}/auth/register`, async ({ request }) => {
    const body = await readJson<RegisterRequest>(request)
    const username = asText(body.username)
    const email = asText(body.email)
    const password = asText(body.password)

    const fieldErrors: Record<string, string> = {}
    const usernameError = validateUsername(username)
    const emailError = validateEmail(email)
    const passwordError = validateNewPassword(password)
    if (usernameError) fieldErrors.username = usernameError
    if (emailError) fieldErrors.email = emailError
    if (passwordError) fieldErrors.password = passwordError

    const failure = await applyScenario('auth-register')
    if (failure) return failure
    if (Object.keys(fieldErrors).length > 0) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', fieldErrors)
    }
    if (usersTable.findByEmail(email)) {
      return errorResponse(409, 'EMAIL_TAKEN', 'Este e-mail já está cadastrado.', { email: 'Este e-mail já está cadastrado.' })
    }
    if (usersTable.findByUsername(username)) {
      return errorResponse(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', {
        username: 'Este nome de usuário já está em uso.',
      })
    }

    const salt = newSalt()
    const user = usersTable.create({
      id: `user-${crypto.randomUUID()}`,
      name: username.trim().toLowerCase(),
      username,
      email,
      avatarUrl: null,
      bio: '',
      passwordSalt: salt,
      passwordHash: await hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    })
    const session = sessionsTable.create(user.id)
    return HttpResponse.json<Session>(toSession(user, session.token, session.expiresAt), { status: 201 })
  }),

  http.post(`${base}/auth/login`, async ({ request }) => {
    const body = await readJson<LoginRequest>(request)
    const email = asText(body.email)
    const password = asText(body.password)

    const failure = await applyScenario('auth-login')
    if (failure) return failure
    const fieldErrors: Record<string, string> = {}
    if (!email.trim()) fieldErrors.email = 'Informe o e-mail.'
    if (!password) fieldErrors.password = 'Informe a senha.'
    if (Object.keys(fieldErrors).length > 0) {
      return errorResponse(422, 'VALIDATION_ERROR', 'Revise os campos destacados.', fieldErrors)
    }

    const user = usersTable.findByEmail(email)
    // Same answer for unknown e-mail and wrong password (no account enumeration).
    if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
      return errorResponse(401, 'UNAUTHENTICATED', 'E-mail ou senha incorretos.')
    }
    const session = sessionsTable.create(user.id)
    return HttpResponse.json<Session>(toSession(user, session.token, session.expiresAt))
  }),

  /** Session recovery (refresh): the client only keeps the token; the API says whether it is still valid. */
  http.get(`${base}/auth/session`, async ({ request }) => {
    const auth = authenticate(request)
    const failure = await applyScenario('auth-session')
    if (failure) return failure
    if (auth instanceof Response) return auth
    const lookup = sessionsTable.lookup(auth.token)
    if (lookup.status !== 'valid') return errorResponse(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
    return HttpResponse.json<Session>(toSession(auth.user, auth.token, lookup.session.expiresAt))
  }),

  /** Idempotent: an unknown or already-ended session also answers 204. */
  http.post(`${base}/auth/logout`, async ({ request }) => {
    const token = bearerToken(request)
    const failure = await applyScenario('auth-logout')
    if (failure) return failure
    if (token) sessionsTable.delete(token)
    return new HttpResponse(null, { status: 204 })
  }),

  http.get(`${base}/profile`, async ({ request }) => {
    const auth = authenticate(request)
    const failure = await applyScenario('profile')
    if (failure) return failure
    if (auth instanceof Response) return auth
    return HttpResponse.json<User>(toPublicUser(auth.user))
  }),
]
