import { expect, test, type Page } from '@playwright/test'
import { ANA, BRUNO, cachedQueryKeys, emailField, isMobile, login, logout, passwordField, submitLogin, toast } from './support/auth'
import { mockControl } from './support/mock-control'

/**
 * Etapa 4 — registration, login, logout and session (desktop 1440 + mobile 390).
 * Every request goes through Axios → MSW (Service Worker); the session is validated by the
 * simulated API, never by client state alone.
 */

const usernameField = (page: Page) => page.getByRole('main').getByLabel('Nome de usuário', { exact: true })
const confirmationField = (page: Page) => page.getByRole('main').getByLabel('Confirmar senha', { exact: true })
const createButton = (page: Page) => page.getByRole('button', { name: 'Criar perfil', exact: true })

async function fillRegistration(page: Page, values: { username: string; email: string; password: string; confirmation: string }) {
  await usernameField(page).fill(values.username)
  await emailField(page).fill(values.email)
  await passwordField(page).fill(values.password)
  await confirmationField(page).fill(values.confirmation)
}

/** Profile data as rendered (works on desktop and mobile). */
async function expectProfile(page: Page, user: { name: string; email: string; username: string }) {
  await page.goto('/profile')
  const details = page.getByTestId('profile-details')
  await expect(details.getByRole('definition').filter({ hasText: user.email })).toBeVisible()
  await expect(details.getByRole('definition').filter({ hasText: user.name }).first()).toBeVisible()
  await expect(details.getByText(`@${user.username}`)).toBeVisible()
}

test.describe('Cadastro', () => {
  test('cadastro válido cria a conta na API simulada e abre a sessão', async ({ page }) => {
    await page.goto('/register')
    await fillRegistration(page, { username: 'Carla.Kurio', email: 'carla@kurio.test', password: 'Senha1234', confirmation: 'Senha1234' })
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/register')
    await createButton(page).click()

    const res = await response
    expect(res.status()).toBe(201)
    expect(res.fromServiceWorker()).toBe(true)
    // The password never travels back.
    expect(JSON.stringify(await res.json())).not.toContain('Senha1234')
    await expect(page).toHaveURL(/\/$/)
    await expect(toast(page, 'Conta criada')).toBeVisible()
    await expectProfile(page, { name: 'carla.kurio', email: 'carla@kurio.test', username: 'carla.kurio' })

    // The new account can sign in again later.
    await logout(page)
    await login(page, { email: 'carla@kurio.test', password: 'Senha1234' })
    await expectProfile(page, { name: 'carla.kurio', email: 'carla@kurio.test', username: 'carla.kurio' })
  })

  test('e-mail já cadastrado é recusado pela API (409)', async ({ page }) => {
    await page.goto('/register')
    await fillRegistration(page, { username: 'outra.ana', email: ANA.email, password: 'Senha1234', confirmation: 'Senha1234' })
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/register')
    await createButton(page).click()

    expect((await response).status()).toBe(409)
    await expect(emailField(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(emailField(page)).toHaveAccessibleDescription('Este e-mail já está cadastrado.')
    await expect(emailField(page)).toBeFocused()
    await expect(page).toHaveURL(/\/register/)
  })

  test('e-mail inválido é barrado antes de chamar a API', async ({ page }) => {
    let calls = 0
    page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/auth/register') calls += 1
    })
    await page.goto('/register')
    await fillRegistration(page, { username: 'dani.kurio', email: 'dani@', password: 'Senha1234', confirmation: 'Senha1234' })
    await createButton(page).click()

    await expect(emailField(page)).toHaveAccessibleDescription('Informe um e-mail válido.')
    await expect(emailField(page)).toBeFocused()
    expect(calls).toBe(0)
  })

  test('senha fora da política é recusada', async ({ page }) => {
    await page.goto('/register')
    await fillRegistration(page, { username: 'edu.kurio', email: 'edu@kurio.test', password: 'abcdefgh', confirmation: 'abcdefgh' })
    await createButton(page).click()
    await expect(passwordField(page)).toHaveAccessibleDescription('A senha deve ter ao menos 8 caracteres, com letras e números.')

    // The message follows the input once corrected.
    await passwordField(page).fill('abcdefg1')
    await confirmationField(page).fill('abcdefg1')
    await expect(passwordField(page)).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('confirmação divergente', async ({ page }) => {
    await page.goto('/register')
    await fillRegistration(page, { username: 'fe.kurio', email: 'fe@kurio.test', password: 'Senha1234', confirmation: 'Senha12345' })
    await createButton(page).click()
    await expect(confirmationField(page)).toHaveAccessibleDescription('As senhas não coincidem.')
    await expect(confirmationField(page)).toBeFocused()
  })

  test('campos obrigatórios', async ({ page }) => {
    await page.goto('/register')
    await createButton(page).click()
    await expect(usernameField(page)).toHaveAccessibleDescription('Informe o nome de usuário.')
    await expect(emailField(page)).toHaveAccessibleDescription('Informe o e-mail.')
    await expect(passwordField(page)).toHaveAccessibleDescription('Informe a senha.')
    await expect(confirmationField(page)).toHaveAccessibleDescription('Confirme a senha.')
    await expect(usernameField(page)).toBeFocused()
  })
})

test.describe('Login e logout', () => {
  test('login válido abre a sessão do usuário', async ({ page }) => {
    await page.goto('/login')
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/login')
    await submitLogin(page, ANA)
    expect((await response).fromServiceWorker()).toBe(true)

    await expect(page).toHaveURL(/\/$/)
    await expect(toast(page, `Bem-vindo(a), ${ANA.name}.`)).toBeVisible()
    if (!isMobile(page)) await expect(page.getByTestId('account-link')).toContainText('Ana')
    await expectProfile(page, ANA)
  })

  test('credenciais inválidas', async ({ page }) => {
    await page.goto('/login')
    await submitLogin(page, { email: ANA.email, password: 'SenhaErrada1' })
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
    await expect(page).toHaveURL(/\/login/)

    // Unknown e-mail: same answer (no account enumeration).
    await submitLogin(page, { email: 'ninguem@kurio.test', password: 'Senha1234' })
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
  })

  test('campos do login são validados', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(emailField(page)).toHaveAccessibleDescription('Informe o e-mail.')
    await expect(passwordField(page)).toHaveAccessibleDescription('Informe a senha.')
    await expect(emailField(page)).toBeFocused()
  })

  test('logout encerra a sessão e protege as rotas privadas', async ({ page }) => {
    await login(page, ANA)
    await logout(page)
    if (!isMobile(page)) await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible()

    // The server session is gone too: the old token no longer recovers it.
    await page.reload()
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile/)
  })

  test('sessão persiste após refresh (validada pela API)', async ({ page }) => {
    await login(page, BRUNO)
    await page.goto('/profile')
    const session = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/session')
    await page.reload()
    const res = await session
    expect(res.status()).toBe(200)
    expect(res.fromServiceWorker()).toBe(true)
    await expect(page).toHaveURL(/\/profile$/)
    await expectProfile(page, BRUNO)
  })

  test('usuário autenticado em /login recebe navegação adequada', async ({ page }) => {
    await login(page, ANA)
    await page.goto('/login')
    const panel = page.getByTestId('signed-in-panel')
    await expect(panel).toContainText(`Você está conectado como ${ANA.name}`)
    await panel.getByRole('button', { name: 'Continuar navegando' }).click()
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('Sessão', () => {
  test('sessão é recuperada em uma nova aba', async ({ page, context }) => {
    await login(page, ANA)
    const other = await context.newPage()
    await other.goto('/profile')
    await expect(other).toHaveURL(/\/profile$/)
    await expect(other.getByTestId('profile-details')).toContainText(ANA.email)
  })

  test('sessão expirada durante a navegação leva ao login e retoma a página', async ({ page }) => {
    await login(page, ANA)
    await page.goto('/profile')
    await expect(page.getByTestId('profile-details')).toBeVisible()

    const { json } = await mockControl(page, '/sessions/expire', { email: ANA.email })
    expect(json).toMatchObject({ expired: 1 })

    // Next private request → 401 SESSION_EXPIRED → session ends and the guard redirects.
    await page.getByRole('navigation', { name: 'Meu perfil' }).getByRole('link', { name: 'Lista de interesse' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Ffavorites&reason=expired/)
    await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar de onde parou.')).toBeVisible()
    await expect(toast(page, 'Sua sessão expirou')).toBeVisible()

    await submitLogin(page, ANA)
    await expect(page).toHaveURL(/\/favorites$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Lista de interesse' })).toBeVisible()
  })

  test('token expirado não recupera a sessão no refresh', async ({ page }) => {
    await login(page, BRUNO)
    await mockControl(page, '/sessions/expire')
    await page.reload()
    await page.goto('/favorites')
    await expect(page).toHaveURL(/\/login\?redirect=%2Ffavorites/)
  })

  test('rota protegida sem autenticação redireciona e volta após o login', async ({ page }) => {
    await page.goto('/favorites')
    await expect(page).toHaveURL(/\/login\?redirect=%2Ffavorites$/)
    await submitLogin(page, BRUNO)
    await expect(page).toHaveURL(/\/favorites$/)
    await expect(page.getByTestId('favorites-list')).toContainText('Life On Edena')

    await logout(page)
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile$/)
  })

  test('redirect externo é ignorado (sem open redirect)', async ({ page }) => {
    await page.goto('/login?redirect=//evil.example/x')
    await submitLogin(page, ANA)
    await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/)
  })

  test('logout limpa o cache privado sem recarregar a página', async ({ page }) => {
    await login(page, ANA, '/login?redirect=%2F%3Fq%3Dviolet')
    const violet = page.getByRole('button', { name: 'Favoritar Violet Nomad #314' })
    await expect(violet).toHaveAttribute('aria-pressed', 'true')

    // In-app navigation only (a reload would reset the cache anyway and prove nothing).
    if (isMobile(page)) await page.getByRole('navigation', { name: 'Navegação inferior' }).getByRole('link', { name: 'Perfil' }).click()
    else await page.getByTestId('account-link').click()
    await expect(page.getByTestId('profile-details')).toContainText(ANA.email)
    const before = JSON.stringify(await cachedQueryKeys(page))
    expect(before).toContain('"private","user-ana","favorites"')
    expect(before).toContain('"private","user-ana","profile"')

    await page.getByRole('navigation', { name: 'Meu perfil' }).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    const after = JSON.stringify(await cachedQueryKeys(page))
    expect(after).not.toContain('user-ana')
    expect(after).not.toContain(ANA.email)
  })
})

test.describe('Perfil', () => {
  test('exibe os dados do usuário autenticado', async ({ page }) => {
    await login(page, BRUNO)
    await page.goto('/profile')
    const details = page.getByTestId('profile-details')
    await expect(page.getByRole('heading', { level: 1, name: 'Perfil do colecionador' })).toBeVisible()
    await expect(details).toContainText(BRUNO.name)
    await expect(details).toContainText(BRUNO.email)
    await expect(details).toContainText(BRUNO.username)
    await expect(details).toContainText(BRUNO.id)
    await expect(details).not.toContainText(ANA.email)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('logout pelo menu do perfil', async ({ page }) => {
    await login(page, ANA)
    await logout(page)
    await page.goto('/favorites')
    await expect(page).toHaveURL(/\/login/)
  })
})
