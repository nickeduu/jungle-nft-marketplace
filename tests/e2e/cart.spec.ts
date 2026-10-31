import { expect, test, type Page } from '@playwright/test'
import { ANA, BRUNO, isMobile, login, logout, submitLogin, toast } from './support/auth'
import { mockControl } from './support/mock-control'
import { recordRealtimeTransitions } from './support/realtime'

/**
 * Etapa 5 — cart (desktop 1440 + mobile 390). Fixture data (src/mocks/fixtures/nfts.ts):
 * - nft-001 Emerald Ape #042: 1/50 (ed-standard) 1.19 ETH, 3 in stock, max 5/order → max 3;
 *   Aberta (ed-open) 1.19 ETH, 25 in stock, max 10.
 * - nft-distant-galaxy: 1/50 (ed-standard) 1.63 ETH, 12 in stock, max 5/order; 1/1 sold out.
 * Estimated network fee: 0.016 ETH (Figma "Taxa estimada").
 */

const EMERALD = '/nfts/nft-001'
const GALAXY = '/nfts/nft-distant-galaxy'

const cartItems = (page: Page) => page.getByTestId('cart-item')
const cartItem = (page: Page, id: string) => page.locator(`[data-testid="cart-item"][data-item-id="${id}"]`)
const quantityOf = (page: Page, id: string) => cartItem(page, id).getByTestId('cart-item-quantity')
const increase = (page: Page, id: string) => cartItem(page, id).getByRole('button', { name: /^Aumentar quantidade/ })
const decrease = (page: Page, id: string) => cartItem(page, id).getByRole('button', { name: /^Diminuir quantidade/ })
const removeButton = (page: Page, id: string) => cartItem(page, id).getByRole('button', { name: /^Remover/ })
const visibleBadge = (page: Page) => page.getByTestId('cart-count-badge').filter({ visible: true })

/** Adds from the detail page (edition via URL, quantity via the stepper) and waits for the API. */
async function addFromDetail(page: Page, path: string, { edition, quantity = 1 }: { edition?: string; quantity?: number } = {}) {
  await page.goto(edition ? `${path}?edition=${edition}` : path)
  await expect(page.getByTestId('nft-detail')).toBeVisible()
  for (let i = 1; i < quantity; i++) await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
  await page.getByRole('button', { name: /^Comprar/ }).click()
  await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
}

async function openCart(page: Page) {
  await page.goto('/cart')
  await expect(cartItems(page).first().or(page.getByTestId('cart-empty'))).toBeVisible()
}

async function expectSummary(page: Page, subtotal: string, total: string) {
  await expect(page.getByTestId('cart-subtotal')).toHaveText(subtotal)
  await expect(page.getByTestId('cart-total')).toHaveText(total)
}

/** PATCH straight to the API with the page's own credentials (proves server-side validation). */
function patchQuantity(page: Page, path: string, quantity: number) {
  return page.evaluate(
    async ({ path, quantity }) => {
      const token = localStorage.getItem('jungle-session-token')
      const guest = localStorage.getItem('jungle-guest-cart')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      else if (guest) headers['X-Guest-Cart'] = guest
      const res = await fetch(path, { method: 'PATCH', headers, body: JSON.stringify({ quantity }) })
      return { status: res.status, body: (await res.json()) as { error?: { code: string; message: string } } }
    },
    { path, quantity },
  )
}

test.describe('Carrinho: adição', () => {
  test('adiciona NFT pelo detalhe (POST na API) e mostra no carrinho', async ({ page }) => {
    await login(page, ANA, '/login?redirect=%2Fnfts%2Fnft-001')
    const post = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/cart/items')
    await page.getByRole('button', { name: /^Comprar/ }).click()
    const res = await post
    expect(res.fromServiceWorker()).toBe(true)
    expect(res.status()).toBe(201)

    await openCart(page)
    const item = cartItem(page, 'nft-001:ed-standard')
    await expect(item).toContainText('Emerald Ape #042')
    await expect(item).toContainText('Edição: 1/50 · Kurio Apes')
    await expect(quantityOf(page, 'nft-001:ed-standard')).toHaveText('1')
    await expect(item.getByTestId('cart-item-total')).toContainText('1.19 ETH')
    await expectSummary(page, '1.19 ETH', '1.206 ETH')
    await expect(page.getByTestId('cart-fee')).toContainText('0.016 ETH')
    await expect(page.getByTestId('cart-count')).toHaveText('1 item')
  })

  test('adiciona a edição escolhida', async ({ page }) => {
    await addFromDetail(page, EMERALD, { edition: 'ed-open', quantity: 2 })
    await openCart(page)
    await expect(cartItems(page)).toHaveCount(1)
    await expect(cartItem(page, 'nft-001:ed-open')).toContainText('Edição: Aberta')
    await expect(quantityOf(page, 'nft-001:ed-open')).toHaveText('2')
    await expectSummary(page, '2.38 ETH', '2.396 ETH')
  })

  test('mesmo NFT e edição soma a quantidade em um único item', async ({ page }) => {
    await addFromDetail(page, GALAXY)
    await addFromDetail(page, GALAXY, { quantity: 2 })
    await openCart(page)
    await expect(cartItems(page)).toHaveCount(1)
    await expect(quantityOf(page, 'nft-distant-galaxy:ed-standard')).toHaveText('3')
    await expectSummary(page, '4.89 ETH', '4.906 ETH')
  })

  test('outra edição do mesmo NFT vira outro item', async ({ page }) => {
    await addFromDetail(page, EMERALD, { edition: 'ed-standard' })
    await addFromDetail(page, EMERALD, { edition: 'ed-gold' })
    await openCart(page)
    await expect(cartItems(page)).toHaveCount(2)
    await expect(cartItem(page, 'nft-001:ed-standard')).toContainText('Edição: 1/50')
    await expect(cartItem(page, 'nft-001:ed-gold')).toContainText('Edição: 1/10')
    await expectSummary(page, '2.98 ETH', '2.996 ETH')
  })

  // README: the cart is not private ("preservar os itens do visitante ao autenticar"); the checkout is.
  test('visitante tem carrinho, mas o checkout exige login', async ({ page }) => {
    await addFromDetail(page, GALAXY)
    await openCart(page)
    await expect(cartItem(page, 'nft-distant-galaxy:ed-standard')).toBeVisible()
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout$/)
  })

  test('após o login, volta ao checkout com os itens do visitante preservados e somados', async ({ page }) => {
    // Ana already has 1 × Distant Galaxy 1/50 in her account cart.
    await login(page, ANA, '/login?redirect=%2Fnfts%2Fnft-distant-galaxy')
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
    await logout(page)

    // As a visitor: 2 × the same edition + 1 × Emerald 1/50.
    await addFromDetail(page, GALAXY, { quantity: 2 })
    await addFromDetail(page, EMERALD)
    await openCart(page)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout$/)
    await submitLogin(page, ANA)

    await expect(page).toHaveURL(/\/checkout$/)
    await expect(toast(page, 'carrinho de visitante foram mantidos')).toBeVisible()
    const items = page.getByTestId('checkout-items')
    await expect(items).toContainText('Distant Galaxy')
    await expect(items).toContainText('3 × 1.63 ETH')
    await expect(items).toContainText('Emerald Ape #042')
    // Visitor cart is gone after the merge: logging out shows an empty visitor cart.
    await logout(page)
    await openCart(page)
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })
})

test.describe('Carrinho: quantidade', () => {
  test('aumentar e diminuir atualizam subtotal do item e total geral', async ({ page }) => {
    await addFromDetail(page, GALAXY)
    await openCart(page)
    const id = 'nft-distant-galaxy:ed-standard'
    await increase(page, id).click()
    await expect(quantityOf(page, id)).toHaveText('2')
    await expect(cartItem(page, id).getByTestId('cart-item-total')).toContainText('3.26 ETH')
    await expectSummary(page, '3.26 ETH', '3.276 ETH')

    // Optimistic on screen at once; the writes run in series, so wait for the API to confirm
    // the last one before reloading (a reload would abort a request still queued).
    const confirmed = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && r.request().postDataJSON()?.quantity === 1 && r.url().endsWith('/api/cart/items/nft-distant-galaxy/ed-standard'),
    )
    await decrease(page, id).click()
    await expect(quantityOf(page, id)).toHaveText('1')
    await expectSummary(page, '1.63 ETH', '1.646 ETH')
    expect((await confirmed).status()).toBe(200)
    // Persisted by the API, not only on screen.
    await page.reload()
    await expect(quantityOf(page, id)).toHaveText('1')
  })

  test('alteração pendente aparece como "Salvando…" até a API confirmar', async ({ page }) => {
    await addFromDetail(page, GALAXY)
    await openCart(page)
    const id = 'nft-distant-galaxy:ed-standard'
    await mockControl(page, '/scenario', { name: 'slow' })

    await increase(page, id).click()
    await expect(quantityOf(page, id)).toHaveText('2')
    await expect(cartItem(page, id).getByTestId('cart-item-saving')).toHaveText('Salvando…')
    await expect(cartItem(page, id)).toHaveAttribute('aria-busy', 'true')

    // Presented as saved only after the API confirms (slow scenario: 2.5 s), and then persisted.
    await expect(cartItem(page, id).getByTestId('cart-item-saving')).toBeEmpty({ timeout: 10_000 })
    await expect(cartItem(page, id)).not.toHaveAttribute('aria-busy', 'true')
    await mockControl(page, '/scenario', { name: 'default' })
    await page.reload()
    await expect(quantityOf(page, id)).toHaveText('2')
  })

  test('não permite quantidade zero (nem pela interface, nem pela API)', async ({ page }) => {
    await addFromDetail(page, GALAXY)
    await openCart(page)
    const id = 'nft-distant-galaxy:ed-standard'
    await expect(decrease(page, id)).toBeDisabled()
    await decrease(page, id).click({ force: true })
    await expect(quantityOf(page, id)).toHaveText('1')

    const res = await patchQuantity(page, '/api/cart/items/nft-distant-galaxy/ed-standard', 0)
    expect(res.status).toBe(422)
  })

  test('respeita o estoque disponível', async ({ page }) => {
    // Emerald 1/50: 3 in stock (max 5 per order) → 3.
    await addFromDetail(page, EMERALD, { quantity: 2 })
    await openCart(page)
    const id = 'nft-001:ed-standard'
    await increase(page, id).click()
    await expect(quantityOf(page, id)).toHaveText('3')
    await expect(increase(page, id)).toBeDisabled()
    const res = await patchQuantity(page, '/api/cart/items/nft-001/ed-standard', 4)
    expect(res.status).toBe(409)
    expect(res.body.error?.code).toBe('AVAILABILITY_CONFLICT')
  })

  test('respeita o limite por pedido', async ({ page }) => {
    // Distant Galaxy 1/50: 12 in stock, max 5 per order.
    await addFromDetail(page, GALAXY, { quantity: 4 })
    await openCart(page)
    const id = 'nft-distant-galaxy:ed-standard'
    await increase(page, id).click()
    await expect(quantityOf(page, id)).toHaveText('5')
    await expect(increase(page, id)).toBeDisabled()
    await expectSummary(page, '8.15 ETH', '8.166 ETH')
    const res = await patchQuantity(page, '/api/cart/items/nft-distant-galaxy/ed-standard', 6)
    expect(res.status).toBe(409)
  })
})

test.describe('Carrinho: remoção e contador', () => {
  test('remove um item, depois o último, e mostra o estado vazio; o contador acompanha', async ({ page }) => {
    await addFromDetail(page, GALAXY, { quantity: 2 })
    await addFromDetail(page, EMERALD)
    await openCart(page)
    await expect(visibleBadge(page)).toHaveText('3')
    await expect(page.getByTestId('cart-count')).toHaveText('3 itens')

    await removeButton(page, 'nft-001:ed-standard').click()
    await expect(cartItems(page)).toHaveCount(1)
    await expectSummary(page, '3.26 ETH', '3.276 ETH')
    await expect(visibleBadge(page)).toHaveText('2')

    await increase(page, 'nft-distant-galaxy:ed-standard').click()
    await expect(visibleBadge(page)).toHaveText('3')

    // Optimistic: empty at once; wait for the API before reloading (a reload would abort the request).
    const removed = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith('/api/cart/items/nft-distant-galaxy/ed-standard'))
    await removeButton(page, 'nft-distant-galaxy:ed-standard').click()
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    await expect(page.getByTestId('cart-summary')).toHaveCount(0)
    await expect(visibleBadge(page)).toHaveCount(0)
    expect((await removed).status()).toBe(200)
    await page.reload()
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })
})

test.describe('Carrinho: persistência e isolamento', () => {
  test('persiste após refresh e em nova aba', async ({ page, context }) => {
    await login(page, BRUNO, '/login?redirect=%2Fnfts%2Fnft-distant-galaxy')
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
    await openCart(page)
    await page.reload()
    await expect(cartItem(page, 'nft-distant-galaxy:ed-standard')).toBeVisible()

    const other = await context.newPage()
    await other.goto('/cart')
    await expect(cartItem(other, 'nft-distant-galaxy:ed-standard')).toBeVisible()
  })

  test('carrinhos de A e B são independentes e o de A é restaurado', async ({ page }) => {
    // 1–4. A adds two NFTs; refresh keeps them.
    await login(page, ANA, '/login?redirect=%2Fnfts%2Fnft-001')
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
    await addFromDetail(page, GALAXY)
    await openCart(page)
    await page.reload()
    await expect(cartItems(page)).toHaveCount(2)

    // 5–8. B sees none of A's items (UI and API) and adds their own.
    await logout(page)
    await page.goto('/login?redirect=%2Fcart')
    const bCart = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/cart')
    await submitLogin(page, BRUNO)
    const body = JSON.stringify(await (await bCart).json())
    expect(body).not.toContain('nft-001')
    expect(body).not.toContain('nft-distant-galaxy')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
    await addFromDetail(page, '/nfts/nft-life-on-edena')

    // 9–10. A again: intact.
    await logout(page)
    await login(page, ANA, '/login?redirect=%2Fcart')
    await expect(cartItems(page)).toHaveCount(2)
    await expect(cartItem(page, 'nft-001:ed-standard')).toBeVisible()
    await expect(cartItem(page, 'nft-distant-galaxy:ed-standard')).toBeVisible()
    await expect(page.getByText('Life On Edena')).toHaveCount(0)
  })
})

test.describe('Carrinho: falhas', () => {
  test('falha ao adicionar não simula sucesso', async ({ page }) => {
    await page.goto(GALAXY)
    await expect(page.getByTestId('nft-detail')).toBeVisible()
    await mockControl(page, '/scenario', { name: 'cart-error' })
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByRole('button', { name: /^Comprar/ })).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByTestId('action-notice')).toHaveText('Não foi possível adicionar ao carrinho. Tente novamente.')
    await mockControl(page, '/scenario', { name: 'default' })
    await openCart(page)
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('falha ao alterar quantidade: otimista e rollback', async ({ page }) => {
    await addFromDetail(page, GALAXY)
    await openCart(page)
    await mockControl(page, '/scenario', { name: 'cart-error' })
    const id = 'nft-distant-galaxy:ed-standard'
    await increase(page, id).click()
    // Immediately (optimistic), then restored when the API fails 800 ms later.
    await expect(quantityOf(page, id)).toHaveText('2', { timeout: 500 })
    await expect(quantityOf(page, id)).toHaveText('1')
    await expectSummary(page, '1.63 ETH', '1.646 ETH')
    await expect(toast(page, 'Não foi possível alterar a quantidade de Distant Galaxy (edição 1/50). A alteração foi desfeita.')).toBeVisible()
  })

  test('falha ao remover: o item volta', async ({ page }) => {
    await addFromDetail(page, GALAXY)
    await openCart(page)
    await mockControl(page, '/scenario', { name: 'cart-error' })
    await removeButton(page, 'nft-distant-galaxy:ed-standard').click()
    await expect(page.getByTestId('cart-empty')).toBeVisible({ timeout: 500 })
    await expect(cartItem(page, 'nft-distant-galaxy:ed-standard')).toBeVisible()
    await expect(toast(page, 'Não foi possível remover Distant Galaxy (edição 1/50). O item voltou ao carrinho.')).toBeVisible()
  })

  test('estoque insuficiente ao adicionar de novo', async ({ page }) => {
    await addFromDetail(page, EMERALD, { quantity: 3 })
    await page.reload()
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toHaveText('Você já tem 3 desta edição no carrinho; o máximo é 3.')
    await openCart(page)
    await expect(quantityOf(page, 'nft-001:ed-standard')).toHaveText('3')
  })

  test('edição esgotada não pode ser adicionada', async ({ page }) => {
    await page.goto(`${GALAXY}?edition=ed-genesis`)
    const buy = page.getByRole('button', { name: /^Comprar/ })
    await expect(buy).toHaveAttribute('aria-disabled', 'true')
    await buy.click({ force: true })
    await expect(page.getByTestId('action-notice')).toBeEmpty()
    // The API refuses it too.
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Guest-Cart': crypto.randomUUID() },
        body: JSON.stringify({ nftId: 'nft-distant-galaxy', editionId: 'ed-genesis', quantity: 1 }),
      })
      return res.status
    })
    expect(status).toBe(409)
  })
})

test.describe('Carrinho: tempo real', () => {
  const id = 'nft-distant-galaxy:ed-standard'

  test('evento reduzindo estoque ajusta a quantidade e informa o motivo, sem afetar outros itens', async ({ page }) => {
    await addFromDetail(page, GALAXY, { quantity: 4 })
    await addFromDetail(page, EMERALD)
    await openCart(page)
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')

    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { available: 2 })
    await expect(quantityOf(page, id)).toHaveText('2')
    await expect(cartItem(page, id).getByTestId('cart-item-notices')).toHaveText('Quantidade ajustada de 4 para 2: estoque reduzido.')
    await expect(quantityOf(page, 'nft-001:ed-standard')).toHaveText('1')
    await expect(cartItem(page, 'nft-001:ed-standard').getByTestId('cart-item-notices')).toBeEmpty()
    await expectSummary(page, '4.45 ETH', '4.466 ETH')
    await expect(visibleBadge(page)).toHaveText('3')
  })

  test('evento esgotando a edição bloqueia o checkout até remover o item', async ({ page }) => {
    await login(page, BRUNO, '/login?redirect=%2Fnfts%2Fnft-distant-galaxy')
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
    await addFromDetail(page, EMERALD)
    await openCart(page)

    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { available: 0 })
    await expect(cartItem(page, id)).toHaveAttribute('data-status', 'unavailable')
    await expect(cartItem(page, id).getByTestId('cart-item-notices')).toContainText('Esgotado')
    await expect(increase(page, id)).toBeDisabled()
    const checkout = page.getByRole('button', { name: 'Conectar e finalizar' })
    await expect(checkout).toHaveAttribute('aria-disabled', 'true')
    await expect(page.getByTestId('checkout-blocked')).toHaveText('Remova os itens esgotados para continuar.')
    // Direct URL is refused as well (checkout guard re-validates with the API).
    await page.goto('/checkout')
    await expect(page).toHaveURL(/\/cart$/)

    await removeButton(page, id).click()
    await expect(checkout).not.toHaveAttribute('aria-disabled', 'true')
    await checkout.click()
    await expect(page).toHaveURL(/\/checkout$/)
  })

  test('reconexão reconcilia o carrinho com a API (mudança de preço perdida)', async ({ page }) => {
    await addFromDetail(page, GALAXY)
    await openCart(page)
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
    const transitions = await recordRealtimeTransitions(page)

    // Price change without event (lost while "offline"): the cart still shows the old price.
    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { priceEth: '2', silent: true })
    await expect(cartItem(page, id).getByTestId('cart-item-total')).toContainText('1.63 ETH')

    await mockControl(page, '/socket/disconnect')
    await expect.poll(transitions).toEqual(['disconnected', 'connected'])
    await expect(cartItem(page, id).getByTestId('cart-item-total')).toContainText('2 ETH')
    await expect(cartItem(page, id).getByTestId('cart-item-notices')).toHaveText('Preço atualizado: era 1.63 ETH, agora 2 ETH.')
    await expectSummary(page, '2 ETH', '2.016 ETH')
  })
})

test.describe('Carrinho: interface e checkout', () => {
  test('desktop: tabela com resumo à direita', async ({ page }) => {
    test.skip(isMobile(page), 'layout desktop')
    await addFromDetail(page, GALAXY)
    await openCart(page)
    await expect(page.getByRole('navigation', { name: 'Trilha de navegação' })).toContainText('Carrinho')
    const list = await page.getByTestId('cart-items').boundingBox()
    const summary = await page.getByTestId('cart-summary').boundingBox()
    expect(list && summary && summary.x > list.x + list.width - 1).toBe(true)
    await expect(cartItem(page, id()).getByTestId('cart-item-price')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('mobile: cards, resumo abaixo e navegação inferior com contador', async ({ page }) => {
    test.skip(!isMobile(page), 'layout mobile')
    await addFromDetail(page, GALAXY, { quantity: 2 })
    await openCart(page)
    const list = await page.getByTestId('cart-items').boundingBox()
    const summary = await page.getByTestId('cart-summary').boundingBox()
    expect(list && summary && summary.y >= list.y + list.height - 1).toBe(true)
    // Unit price column is hidden; the line total stays visible.
    await expect(cartItem(page, id()).getByTestId('cart-item-price')).toBeHidden()
    await expect(cartItem(page, id()).getByTestId('cart-item-total')).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Navegação inferior' })
    await expect(nav.getByRole('link', { name: 'Carrinho, 2 itens' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('estado vazio', async ({ page }) => {
    await page.goto('/cart')
    const empty = page.getByTestId('cart-empty')
    await expect(empty).toContainText('Seu carrinho está vazio')
    await expect(page.getByTestId('cart-total')).toHaveCount(0)
    await empty.getByRole('link', { name: 'Explorar NFTs' }).click()
    await expect(page).toHaveURL(/\/#catalogo$/)
  })

  test('skeleton durante carregamento lento', async ({ page }) => {
    await addFromDetail(page, GALAXY)
    await mockControl(page, '/scenario', { name: 'slow' })
    await page.goto('/cart')
    await expect(page.getByTestId('cart-skeleton')).toBeVisible()
    await expect(cartItem(page, id())).toBeVisible({ timeout: 10_000 })
  })

  test('navega para o checkout com o estado do carrinho', async ({ page }) => {
    await login(page, ANA, '/login?redirect=%2Fnfts%2Fnft-distant-galaxy')
    await page.getByRole('button', { name: 'Aumentar quantidade' }).click()
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
    await openCart(page)
    await page.getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByTestId('checkout-items')).toContainText('2 × 1.63 ETH')
    await expect(page.getByTestId('checkout-total')).toHaveText('3.276 ETH')
    // Etapa 6: confirming is real now; just opening the checkout creates no order.
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeVisible()
    await expect(page).toHaveURL(/\/checkout$/)
  })

  test('checkout com carrinho vazio redireciona para o carrinho', async ({ page }) => {
    await login(page, BRUNO, '/login?redirect=%2Fcheckout')
    await expect(page).toHaveURL(/\/cart$/)
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  function id() {
    return 'nft-distant-galaxy:ed-standard'
  }
})
