import { expect, test, type Page } from '@playwright/test'
import { ANA, appReady, BRUNO, cachedQueryKeys, isMobile, login, logout, socketUsers, submitLogin, toast } from './support/auth'
import { mockControl } from './support/mock-control'
import { recordRealtimeTransitions } from './support/realtime'

/**
 * Etapa 4 — favorites (optimistic update + rollback) and isolation between users,
 * including private Socket.IO events. Desktop 1440 + mobile 390.
 */

const heart = (page: Page, nftName: string) => page.getByRole('button', { name: `Favoritar ${nftName}`, exact: true })
const favoritesList = (page: Page) => page.getByTestId('favorites-list')

const listed = (page: Page, nftName: string) => favoritesList(page).getByRole('link', { name: nftName, exact: true })

/** Waits until the API confirmed the toggle (navigating away earlier would abort the request). */
async function toggleAndConfirm(page: Page, nftName: string, added: boolean) {
  await heart(page, nftName).click()
  await expect(toast(page, `${nftName} foi ${added ? 'adicionado aos' : 'removido dos'} favoritos.`)).toBeVisible()
}

async function favoriteNames(page: Page): Promise<string[]> {
  await expect(favoritesList(page).or(page.getByTestId('favorites-empty'))).toBeVisible()
  return favoritesList(page).getByTestId('nft-card').getByRole('link').allTextContents()
}

test.describe('Favoritos', () => {
  test('adiciona no detalhe (PUT na API) e persiste após refresh', async ({ page }) => {
    await login(page, ANA, '/login?redirect=%2Fnfts%2Fnft-001')
    const button = heart(page, 'Emerald Ape #042')
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    const put = page.waitForResponse((r) => r.request().method() === 'PUT' && new URL(r.url()).pathname === '/api/favorites/nft-001')
    await button.click()
    const res = await put
    expect(res.fromServiceWorker()).toBe(true)
    expect(res.status()).toBe(200)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(toast(page, 'Emerald Ape #042 foi adicionado aos favoritos.')).toBeVisible()

    await page.reload()
    await expect(heart(page, 'Emerald Ape #042')).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/favorites')
    expect(await favoriteNames(page)).toEqual(['Emerald Ape #042', ...ANA.favorites])
  })

  test('remove na lista de interesse e persiste após refresh', async ({ page }) => {
    await login(page, ANA, '/login?redirect=%2Ffavorites')
    expect(await favoriteNames(page)).toEqual([...ANA.favorites])

    await heart(page, 'Distant Galaxy').click()
    // Optimistic: the card leaves the list before the API answers.
    await expect(listed(page, 'Distant Galaxy')).toHaveCount(0)
    await expect(toast(page, 'Distant Galaxy foi removido dos favoritos.')).toBeVisible()

    await page.reload()
    expect(await favoriteNames(page)).toEqual(['Violet Nomad #314'])
  })

  test('atualização otimista: a interface muda antes da resposta', async ({ page }) => {
    await login(page, BRUNO, '/login?redirect=%2Fnfts%2Fnft-001')
    const button = heart(page, 'Emerald Ape #042')
    // Ready once the user's list is loaded (the current state is known).
    await expect(button).not.toHaveAttribute('aria-disabled', 'true')
    await mockControl(page, '/scenario', { name: 'slow' })

    let answered = false
    void page
      .waitForResponse((r) => new URL(r.url()).pathname === '/api/favorites/nft-001')
      .then(() => {
        answered = true
      })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 1_000 })
    await expect(button).toHaveAttribute('aria-busy', 'true')
    expect(answered).toBe(false)

    // Confirmed by the API (2.5 s later): still favorited, no longer busy.
    await expect(button).not.toHaveAttribute('aria-busy', 'true', { timeout: 10_000 })
    expect(answered).toBe(true)
    await expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  test('rollback quando a API falha', async ({ page }) => {
    await login(page, BRUNO, '/login?redirect=%2Fnfts%2Fnft-001')
    const button = heart(page, 'Emerald Ape #042')
    await expect(button).not.toHaveAttribute('aria-disabled', 'true')
    await mockControl(page, '/scenario', { name: 'favorites-error' })

    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true', { timeout: 500 })
    // 500 after 800 ms → previous state restored and the user is told.
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    const error = toast(page, 'Não foi possível adicionar Emerald Ape #042 aos favoritos. A alteração foi desfeita.')
    await expect(error).toBeVisible()
    await expect(error).toHaveAttribute('data-tone', 'error')

    // The failed request did not change the server.
    await mockControl(page, '/scenario', { name: 'default' })
    await page.goto('/favorites')
    expect(await favoriteNames(page)).toEqual([...BRUNO.favorites])
  })

  test('catálogo e detalhe ficam sincronizados sem recarregar', async ({ page }) => {
    await login(page, BRUNO, '/login?redirect=%2F%3Fq%3Demerald')
    const card = page.getByTestId('nft-card').filter({ hasText: 'Emerald Ape #042' })
    await card.getByRole('button', { name: 'Favoritar Emerald Ape #042' }).click()
    await expect(card.getByRole('button', { name: 'Favoritar Emerald Ape #042' })).toHaveAttribute('aria-pressed', 'true')

    await card.getByRole('link', { name: 'Emerald Ape #042' }).click()
    const detailButton = heart(page, 'Emerald Ape #042')
    await expect(detailButton).toHaveAttribute('aria-pressed', 'true')
    await detailButton.click()
    await expect(detailButton).toHaveAttribute('aria-pressed', 'false')

    await page.goBack()
    await expect(card.getByRole('button', { name: 'Favoritar Emerald Ape #042' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('visitante é levado ao login e volta para favoritar', async ({ page }) => {
    await page.goto('/?q=emerald')
    await heart(page, 'Emerald Ape #042').click()
    await expect(page).toHaveURL(/\/login\?redirect=%2F%3Fq%3Demerald/)
    await submitLogin(page, ANA)
    await expect(page).toHaveURL(/\/\?q=emerald$/)
    await heart(page, 'Emerald Ape #042').click()
    await expect(heart(page, 'Emerald Ape #042')).toHaveAttribute('aria-pressed', 'true')
  })

  test('navegação mobile e header levam à lista de interesse', async ({ page }) => {
    await login(page, BRUNO)
    if (isMobile(page)) await page.getByRole('navigation', { name: 'Navegação inferior' }).getByRole('link', { name: 'Lista de interesse' }).click()
    else await page.getByRole('banner').getByRole('link', { name: 'Lista de interesse' }).click()
    await expect(page).toHaveURL(/\/favorites$/)
    expect(await favoriteNames(page)).toEqual([...BRUNO.favorites])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})

test.describe('Isolamento entre usuários', () => {
  test('favoritos independentes: A → logout → B → logout → A', async ({ page }) => {
    // 1–2. A signs in and adds a favorite.
    await login(page, ANA, '/login?redirect=%2Fnfts%2Fnft-001')
    await toggleAndConfirm(page, 'Emerald Ape #042', true)
    await page.goto('/favorites')
    expect(await favoriteNames(page)).toEqual(['Emerald Ape #042', ...ANA.favorites])

    // 3–5. A leaves; B does not see A's favorites — neither in the UI nor in the API response.
    await logout(page)
    await page.goto('/login?redirect=%2Ffavorites')
    const bList = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/favorites')
    await submitLogin(page, BRUNO)
    const body = JSON.stringify(await (await bList).json())
    expect(body).not.toContain('nft-001')
    expect(body).not.toContain('nft-distant-galaxy')
    expect(await favoriteNames(page)).toEqual([...BRUNO.favorites])
    expect(JSON.stringify(await cachedQueryKeys(page))).not.toContain('user-ana')

    // 6. B adds their own favorite.
    await page.goto('/nfts/nft-002')
    await toggleAndConfirm(page, 'Sage Nomad #009', true)

    // 7–8. A again: A's favorites preserved, B's not included.
    await logout(page)
    await login(page, ANA, '/login?redirect=%2Ffavorites')
    expect(await favoriteNames(page)).toEqual(['Emerald Ape #042', ...ANA.favorites])
  })

  test('API privada exige sessão e não aceita dados de outro usuário', async ({ page }) => {
    await page.goto('/')
    await appReady(page)
    const anonymous = await page.evaluate(() => fetch('/api/favorites').then((r) => r.status))
    expect(anonymous).toBe(401)
    const forged = await page.evaluate(() =>
      fetch('/api/favorites', { headers: { Authorization: 'Bearer token-inventado' } }).then((r) => r.status),
    )
    expect(forged).toBe(401)

    await login(page, BRUNO)
    await page.goto('/profile')
    await expect(page.getByTestId('profile-details')).toContainText(BRUNO.email)
    await expect(page.getByTestId('profile-details')).not.toContainText(ANA.email)
  })
})

test.describe('Socket.IO por sessão', () => {
  test('eventos privados chegam só à sessão do dono', async ({ page }) => {
    await login(page, BRUNO, '/login?redirect=%2Ffavorites')
    expect(await favoriteNames(page)).toEqual([...BRUNO.favorites])
    await expect.poll(() => socketUsers(page)).toEqual([BRUNO.id])

    // A change of Ana's favorites (another device) is not routed to Bruno's connection.
    const forAna = await mockControl(page, '/favorites', { email: ANA.email, nftId: 'nft-003', favorite: true })
    expect(forAna.json).toMatchObject({ deliveredTo: 0 })

    // Even if a private event for Ana reaches this socket, the client drops it.
    await mockControl(page, '/socket/emit', {
      event: 'favorites.updated',
      payload: {
        eventId: 'leak-1',
        resource: { type: 'favorites', id: ANA.id },
        version: 999,
        occurredAt: new Date().toISOString(),
        data: { nftIds: ['nft-003'] },
      },
    })

    // Bruno's own change from another device arrives live (no reload) — and after the
    // misrouted event above, so the list proves that one was ignored.
    const forBruno = await mockControl(page, '/favorites', { email: BRUNO.email, nftId: 'nft-001', favorite: true })
    expect(forBruno.json).toMatchObject({ deliveredTo: 1 })
    await expect(listed(page, 'Emerald Ape #042')).toBeVisible()
    expect(await favoriteNames(page)).toEqual(['Emerald Ape #042', ...BRUNO.favorites])
  })

  test('a conexão acompanha a sessão: login, logout, troca de usuário e reconexão', async ({ page }) => {
    await page.goto('/')
    await appReady(page)
    await expect.poll(() => socketUsers(page)).toEqual([null])

    await page.goto('/login')
    await submitLogin(page, ANA)
    await expect.poll(() => socketUsers(page)).toEqual([ANA.id])

    // Logout closes Ana's socket; the visitor socket has no private access.
    await logout(page)
    await expect.poll(() => socketUsers(page)).toEqual([null])

    await page.goto('/login?redirect=%2Ffavorites')
    await submitLogin(page, BRUNO)
    await expect(page).toHaveURL(/\/favorites$/)
    await expect.poll(() => socketUsers(page)).toEqual([BRUNO.id])

    // Network drop: socket.io-client reconnects with Bruno's token (same session).
    const transitions = await recordRealtimeTransitions(page)
    await mockControl(page, '/socket/disconnect')
    await expect.poll(transitions).toEqual(['disconnected', 'connected'])
    await expect.poll(() => socketUsers(page)).toEqual([BRUNO.id])
    const live = await mockControl(page, '/favorites', { email: BRUNO.email, nftId: 'nft-002', favorite: true })
    expect(live.json).toMatchObject({ deliveredTo: 1 })
    await expect(listed(page, 'Sage Nomad #009')).toBeVisible()

    // Ana's events (her session ended) reach nobody.
    const stale = await mockControl(page, '/favorites', { email: ANA.email, nftId: 'nft-002', favorite: true })
    expect(stale.json).toMatchObject({ deliveredTo: 0 })
  })

  test('eventos públicos de NFT continuam chegando para usuários autenticados', async ({ page }) => {
    await login(page, ANA, '/login?redirect=%2Fnfts%2Fnft-distant-galaxy')
    await expect.poll(() => socketUsers(page)).toEqual([ANA.id])
    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { priceEth: '2.5' })
    await expect(page.getByTestId('edition-ed-standard').getByTestId('edition-price')).toHaveText('2.5 ETH')
  })
})
