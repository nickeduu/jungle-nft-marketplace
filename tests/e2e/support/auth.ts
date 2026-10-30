import { expect, type Page } from '@playwright/test'
import { mockControl } from './mock-control'

/** Demo accounts (src/mocks/fixtures/users.ts; fictitious credentials documented in README). */
export const ANA = {
  id: 'user-ana',
  name: 'Ana Colecionadora',
  username: 'ana.kurio',
  email: 'ana@kurio.test',
  password: 'Kurio2026',
  /** Seed favorites. */
  favorites: ['Distant Galaxy', 'Violet Nomad #314'],
} as const

export const BRUNO = {
  id: 'user-bruno',
  name: 'Bruno Cunhagem',
  username: 'bruno.kurio',
  email: 'bruno@kurio.test',
  password: 'Kurio2026',
  favorites: ['Life On Edena'],
} as const

type Account = { email: string; password: string }

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

/** Scoped to <main>: the desktop footer has a (disabled) newsletter "E-mail" field. */
export const emailField = (page: Page) => page.getByRole('main').getByLabel('E-mail', { exact: true })
export const passwordField = (page: Page) => page.getByRole('main').getByLabel('Senha', { exact: true })

/** MSW (REST + Socket.IO) is active and the app rendered: control endpoints can be called. */
export async function appReady(page: Page) {
  await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
}

/** Fills and submits the login form (already on /login). */
export async function submitLogin(page: Page, account: Account) {
  await emailField(page).fill(account.email)
  await passwordField(page).fill(account.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

/** Signs in through the UI and waits until the app left the login page. */
export async function login(page: Page, account: Account, path = '/login') {
  await page.goto(path)
  await submitLogin(page, account)
  await expect(page).not.toHaveURL(/\/login/)
}

/** Signs out through the profile menu ("Sair"). */
export async function logout(page: Page) {
  await page.goto('/profile')
  await page.getByRole('navigation', { name: 'Meu perfil' }).getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/$/)
}

/** User each open Socket.IO connection is bound to on the simulated server (null = visitor). */
export async function socketUsers(page: Page): Promise<Array<string | null>> {
  const { json } = await mockControl(page, '/socket/connections')
  return (json as { connections: Array<{ userId: string | null }> }).connections.map((c) => c.userId)
}

/** Keys of the cached queries that hold data (window.__jungleQueryKeys, mock builds only). */
export async function cachedQueryKeys(page: Page): Promise<unknown[][]> {
  return page.evaluate(() => (window as unknown as { __jungleQueryKeys: () => unknown[][] }).__jungleQueryKeys())
}

export const toast = (page: Page, text: string | RegExp) => page.getByTestId('feedback-toast').filter({ hasText: text })
