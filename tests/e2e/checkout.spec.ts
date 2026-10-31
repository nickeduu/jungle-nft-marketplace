import { expect, test, type Page } from '@playwright/test'
import { ANA, BRUNO, emailField, isMobile, login, logout } from './support/auth'
import { mockControl } from './support/mock-control'
import { recordRealtimeTransitions } from './support/realtime'

/**
 * Etapa 6 — checkout, simulated payment and orders (desktop 1440 + mobile 390).
 * Ana's wallets: "Principal" (MetaMask, Ethereum) and "Reserva" (Coinbase, Polygon).
 * Fees: Ethereum 0.016, Polygon 0.002. Distant Galaxy 1/50 = 1.63 ETH. Payment resolves in 1.5 s.
 */

const total = (page: Page) => page.getByTestId('checkout-total')
const confirmButton = (page: Page) => page.getByRole('button', { name: /^(Confirmar compra|Enviando pedido…)$/ })
const orderPage = (page: Page) => page.getByTestId('order-page')

async function checkoutWith(page: Page, user = ANA, nft = '/nfts/nft-distant-galaxy') {
  await login(page, user, `/login?redirect=${encodeURIComponent(nft)}`)
  await page.getByRole('button', { name: /^Comprar/ }).click()
  await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
  await page.goto('/checkout')
  await expect(total(page)).toBeVisible()
}

async function connectSelectedWallet(page: Page) {
  await page.getByRole('button', { name: /^Conectar / }).click()
  await expect(page.getByTestId('wallet-connection')).toHaveAttribute('data-connected', 'true')
}

/** Orders of the signed-in user, straight from the API. */
function apiOrders(page: Page) {
  return page.evaluate(async () => {
    const res = await fetch('/api/orders', { headers: { Authorization: `Bearer ${localStorage.getItem('jungle-session-token')}` } })
    return (await res.json()) as Array<{ id: string; status: string }>
  })
}

test.describe('Checkout: acesso e dados', () => {
  test('autenticado vê itens, cotação e dados do colecionador', async ({ page }) => {
    await checkoutWith(page)
    await expect(page.getByTestId('checkout-items')).toContainText('Distant Galaxy')
    await expect(page.getByTestId('checkout-items')).toContainText('1 × 1.63 ETH')
    await expect(page.getByTestId('quote-fee')).toHaveText('0.016 ETH')
    await expect(total(page)).toHaveText('1.646 ETH')
    await expect(page.getByRole('main').getByLabel('Nome completo')).toHaveValue(ANA.name)
    await expect(emailField(page)).toHaveValue(ANA.email)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('visitante é levado ao login e volta ao checkout', async ({ page }) => {
    await page.goto('/checkout')
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout$/)
  })

  test('seleção de carteira define a rede e a taxa da cotação', async ({ page }) => {
    await checkoutWith(page)
    await page.getByTestId('wallet-option').filter({ hasText: 'Reserva' }).click()
    await expect(page.getByLabel('Rede', { exact: true })).toHaveValue('polygon')
    await expect(page.getByTestId('quote-fee')).toHaveText('0.002 ETH')
    await expect(total(page)).toHaveText('1.632 ETH')
  })

  test('conexão simulada: recusa, conexão e desconexão', async ({ page }) => {
    await checkoutWith(page)
    await mockControl(page, '/scenario', { name: 'wallet-reject' })
    await page.getByRole('button', { name: 'Conectar MetaMask' }).click()
    await expect(page.getByTestId('wallet-feedback')).toHaveText('A conexão foi recusada na carteira.')
    await expect(page.getByTestId('wallet-connection')).toHaveAttribute('data-connected', 'false')

    await mockControl(page, '/scenario', { name: 'default' })
    await connectSelectedWallet(page)
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await expect(page.getByTestId('wallet-connection')).toHaveAttribute('data-connected', 'false')
    // Paying requires a connected wallet.
    await confirmButton(page).click()
    await expect(page.getByTestId('wallet-feedback')).toHaveText('Conecte a carteira selecionada para pagar.')
  })

  test('rede diferente da carteira é recusada', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await page.getByLabel('Rede', { exact: true }).selectOption('solana')
    await confirmButton(page).click()
    await expect(page.getByLabel('Rede', { exact: true })).toHaveAccessibleDescription('A carteira Principal está na rede Ethereum.')
  })

  test('validação por teclado: nome obrigatório recebe o foco', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    const name = page.getByRole('main').getByLabel('Nome completo')
    await name.fill('')
    await name.press('Tab')
    await confirmButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(name).toHaveAccessibleDescription('Informe o nome completo.')
    await expect(name).toBeFocused()
    // Wallet radios are operable with the arrow keys.
    await page.getByRole('radio', { name: /Principal/ }).focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('radio', { name: /Reserva/ })).toBeChecked()
  })
})

test.describe('Cupons e cotação', () => {
  test('cupom válido entra na cotação; inválido e expirado são recusados', async ({ page }) => {
    await login(page, ANA, '/login?redirect=%2Fnfts%2Fnft-distant-galaxy')
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
    await page.goto('/cart')
    const code = page.getByLabel('Código promocional')

    await code.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(code).toHaveAccessibleDescription('Cupom inválido.')
    await code.fill('expirado')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(code).toHaveAccessibleDescription('Este cupom expirou.')

    await code.fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByTestId('cart-coupon')).toContainText('KURIO10')
    await expect(page.getByTestId('cart-discount')).toHaveText('(-) 0.163 ETH')
    await expect(page.getByTestId('cart-total')).toHaveText('1.483 ETH')

    await page.goto('/checkout')
    await expect(page.getByTestId('quote-discount')).toHaveText('(-) 0.163 ETH')
    await expect(total(page)).toHaveText('1.483 ETH')

    await page.goto('/cart')
    await page.getByRole('button', { name: 'Remover cupom' }).click()
    await expect(page.getByTestId('cart-total')).toHaveText('1.646 ETH')
  })

  test('mudança de preço durante o checkout exige nova confirmação', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { priceEth: '1.7' })
    await expect(total(page)).toHaveText('1.716 ETH')
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await expect(confirmButton(page)).toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: 'Revisei os novos valores' }).click()
    await expect(confirmButton(page)).not.toHaveAttribute('aria-disabled', 'true')
  })

  test('taxa alterada: a API recusa a cotação antiga e a interface pede revisão', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await mockControl(page, '/fees', { network: 'ethereum', feeEth: '0.02' })
    await confirmButton(page).click()
    await expect(page.getByTestId('checkout-error')).toHaveText('Preço, disponibilidade, cupom ou taxa mudaram. Revise os novos valores e confirme novamente.')
    await expect(page.getByTestId('quote-fee')).toHaveText('0.02 ETH')
    await expect(page.getByTestId('quote-changed')).toBeVisible()
    await page.getByRole('button', { name: 'Revisei os novos valores' }).click()
    await confirmButton(page).click()
    await expect(orderPage(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    await expect(page.getByTestId('order-total')).toHaveText('1.65 ETH')
  })

  test('edição esgotada durante o checkout bloqueia a compra', async ({ page }) => {
    await checkoutWith(page)
    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { available: 0 })
    await expect(page.getByTestId('quote-error')).toContainText('Distant Galaxy (edição 1/50) esgotou')
    await expect(page.getByTestId('quote-error').getByRole('link', { name: 'Revisar carrinho' })).toBeVisible()
  })
})

test.describe('Pedidos', () => {
  test('compra confirmada: pendente → confirmado, recibo do snapshot e carrinho sem os itens', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    const created = page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/orders')
    await confirmButton(page).click()
    const res = await created
    expect(res.status()).toBe(201)
    expect(res.fromServiceWorker()).toBe(true)
    expect(res.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/)

    // Success only when the API says so (Socket.IO order.updated).
    await expect(orderPage(page)).toHaveAttribute('data-status', 'pending')
    await expect(orderPage(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    await expect(page.getByRole('heading', { name: 'Seus NFTs agora estão na sua carteira' })).toBeVisible()
    await expect(page.getByTestId('order-items')).toContainText('Distant Galaxy')
    await expect(page.getByTestId('order-total')).toHaveText('1.646 ETH')
    await expect(page.getByTestId('order-tx')).toHaveText(/^0x[0-9a-f]{4}…[0-9a-f]{4}$/)
    await page.getByRole('button', { name: 'Ver no explorador (simulado)' }).click()
    await expect(page.getByTestId('explorer-panel')).toContainText('Referência simulada')

    // Snapshot: later catalog changes do not alter the receipt; refresh keeps the order.
    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { priceEth: '9' })
    await page.reload()
    await expect(orderPage(page)).toHaveAttribute('data-status', 'confirmed')
    await expect(page.getByTestId('order-total')).toHaveText('1.646 ETH')

    await page.goto('/cart')
    await expect(page.getByTestId('cart-empty')).toBeVisible()
  })

  test('pagamento recusado preserva o carrinho', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await mockControl(page, '/scenario', { name: 'payment-rejected' })
    await confirmButton(page).click()
    await expect(orderPage(page)).toHaveAttribute('data-status', 'rejected', { timeout: 10_000 })
    await expect(page.getByTestId('order-rejection')).toHaveText('Pagamento recusado pela carteira (simulação).')
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByTestId('cart-item')).toHaveCount(1)
  })

  test('cliques repetidos criam um único pedido', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    let posts = 0
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/orders') posts += 1
    })
    await confirmButton(page).click()
    // Extra clicks while sending and right after the answer (the page may already have left).
    for (let i = 0; i < 3; i++) await confirmButton(page).click({ force: true, timeout: 500 }).catch(() => {})
    await expect(orderPage(page)).toBeVisible()
    expect(posts).toBe(1)
    expect(await apiOrders(page)).toHaveLength(1)
  })

  test('timeout após criar o pedido: a mesma tentativa recupera o mesmo pedido', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    const keys: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/orders') keys.push(r.headers()['idempotency-key'] ?? '')
    })
    await mockControl(page, '/scenario', { name: 'order-timeout' })
    await confirmButton(page).click()
    await expect(page.getByTestId('checkout-error')).toContainText('Não recebemos a confirmação do envio', { timeout: 10_000 })
    await expect(page.getByTestId('unknown-attempt')).toBeVisible()

    // The attempt also survives a refresh.
    await mockControl(page, '/scenario', { name: 'default' })
    await page.reload()
    await page.getByRole('button', { name: 'Verificar pedido' }).click()
    await expect(orderPage(page)).toBeVisible()
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
    const orders = await apiOrders(page)
    expect(orders).toHaveLength(1)
    await expect(page).toHaveURL(new RegExp(`/orders/${orders[0]!.id}$`))
  })

  test('mesma chave: mesmo conteúdo devolve o mesmo pedido; outro conteúdo gera conflito (API)', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    const created = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/orders')
    await confirmButton(page).click()
    const request = await created
    await expect(orderPage(page)).toBeVisible()
    const orderId = new URL(page.url()).pathname.split('/').pop()

    const replay = await page.evaluate(
      async ({ key, body }) => {
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('jungle-session-token')}`, 'Idempotency-Key': key }
        const same = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify(body) })
        const changed = await fetch('/api/orders', { method: 'POST', headers, body: JSON.stringify({ ...body, buyer: { ...body.buyer, fullName: 'Outra Pessoa' } }) })
        return { sameStatus: same.status, sameId: ((await same.json()) as { id: string }).id, changedStatus: changed.status }
      },
      { key: request.headers()['idempotency-key']!, body: request.postDataJSON() as { buyer: { fullName: string } } },
    )
    expect(replay).toEqual({ sameStatus: 200, sameId: orderId, changedStatus: 409 })
    expect(await apiOrders(page)).toHaveLength(1)
  })

  test('pedido pendente: refresh, recuperação, order.updated e eventos duplicados/antigos', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await mockControl(page, '/scenario', { name: 'payment-pending' })
    await confirmButton(page).click()
    await expect(orderPage(page)).toHaveAttribute('data-status', 'pending')
    const orderId = new URL(page.url()).pathname.split('/').pop()!

    await page.reload()
    await expect(orderPage(page)).toHaveAttribute('data-status', 'pending')
    // Reopening the checkout points to the pending order (cart still holds the items).
    await page.goto('/checkout')
    await page.getByTestId('pending-order-banner').getByRole('link', { name: 'Acompanhar pedido' }).click()
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`))
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')

    // Live update through Socket.IO (no reload).
    const resolved = await mockControl(page, `/orders/${orderId}/resolve`, { status: 'confirmed' })
    expect(resolved.json).toMatchObject({ status: 'confirmed', version: 2 })
    await expect(orderPage(page)).toHaveAttribute('data-status', 'confirmed')

    // A stale (version 1, "pending") event never regresses a terminal state.
    await mockControl(page, '/socket/emit', {
      event: 'order.updated',
      payload: { eventId: 'stale-order', resource: { type: 'order', id: orderId }, version: 1, occurredAt: new Date().toISOString(), data: { status: 'pending', txHash: null, rejectionReason: null } },
    })
    await page.waitForTimeout(300)
    await expect(orderPage(page)).toHaveAttribute('data-status', 'confirmed')
  })

  test('desconexão com pedido pendente: a reconexão reconcilia com a API', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await mockControl(page, '/scenario', { name: 'payment-pending' })
    await confirmButton(page).click()
    await expect(orderPage(page)).toHaveAttribute('data-status', 'pending')
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
    const orderId = new URL(page.url()).pathname.split('/').pop()!
    const transitions = await recordRealtimeTransitions(page)

    await mockControl(page, '/socket/disconnect')
    await mockControl(page, `/orders/${orderId}/resolve`, { status: 'rejected', reason: 'Saldo insuficiente (simulação).' })
    await expect.poll(transitions).toEqual(['disconnected', 'connected'])
    await expect(orderPage(page)).toHaveAttribute('data-status', 'rejected')
    await expect(page.getByTestId('order-rejection')).toHaveText('Saldo insuficiente (simulação).')
  })

  test('remove do carrinho só os itens e quantidades comprados', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await mockControl(page, '/scenario', { name: 'payment-pending' })
    await confirmButton(page).click()
    await expect(orderPage(page)).toHaveAttribute('data-status', 'pending')
    const orderId = new URL(page.url()).pathname.split('/').pop()!

    // After the order: one more unit of the same edition and another NFT.
    await mockControl(page, '/scenario', { name: 'default' })
    await page.goto('/nfts/nft-distant-galaxy')
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
    await page.goto('/nfts/nft-001')
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')

    await mockControl(page, `/orders/${orderId}/resolve`, { status: 'confirmed' })
    await page.goto('/cart')
    await expect(page.locator('[data-item-id="nft-distant-galaxy:ed-standard"]').getByTestId('cart-item-quantity')).toHaveText('1')
    await expect(page.locator('[data-item-id="nft-001:ed-standard"]')).toBeVisible()
  })

  test('pedidos são isolados por usuário', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await confirmButton(page).click()
    await expect(orderPage(page)).toBeVisible()
    const anaOrder = new URL(page.url()).pathname

    await logout(page)
    await login(page, BRUNO, `/login?redirect=${encodeURIComponent(anaOrder)}`)
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado' })).toBeVisible()
    expect(await apiOrders(page)).toEqual([])
  })
})

test.describe('Pedido pendente em tempo real', () => {
  /** Marks the window: if the page reloads, the marker is gone. */
  const markWindow = (page: Page) => page.evaluate(() => Object.assign(window, { __noReload: true }))
  const stillSameWindow = (page: Page) => page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload === true)

  test('o pagamento simulado resolve o pedido e a tela aberta atualiza sem refresh', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await confirmButton(page).click()
    await expect(orderPage(page)).toHaveAttribute('data-status', 'pending')
    await markWindow(page)
    await expect(orderPage(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    expect(await stillSameWindow(page)).toBe(true)
  })

  test('refresh durante o pagamento: o mock retoma e a tela atualiza sem novo refresh', async ({ page }) => {
    await checkoutWith(page)
    await connectSelectedWallet(page)
    await confirmButton(page).click()
    await expect(orderPage(page)).toHaveAttribute('data-status', 'pending')
    await page.reload()
    await expect(orderPage(page)).toBeVisible()
    await markWindow(page)
    await expect(orderPage(page)).toHaveAttribute('data-status', 'confirmed', { timeout: 10_000 })
    expect(await stillSameWindow(page)).toBe(true)
    expect(await apiOrders(page)).toHaveLength(1)
  })
})

test.describe('Carteiras no perfil', () => {
  test('cadastra a carteira secundária com validação e a usa no checkout', async ({ page }) => {
    await login(page, BRUNO, '/login?redirect=%2Fwallets')
    const secondary = page.getByTestId('wallet-secondary')
    await secondary.getByRole('button', { name: 'Adicionar' }).click()
    await secondary.getByLabel('Apelido da carteira').fill('Reserva do Bruno')
    await secondary.getByLabel('Tipo de carteira').selectOption('metamask')
    await secondary.getByLabel('Rede').selectOption('ethereum')
    await secondary.getByLabel('Endereço da carteira').fill('0x123')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByLabel('Endereço da carteira')).toHaveAccessibleDescription(
      'Endereço inválido: use 0x seguido de 40 caracteres hexadecimais.',
    )
    await secondary.getByLabel('Endereço da carteira').fill('0x1111222233334444555566667777888899990000')
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByTestId('feedback-toast').filter({ hasText: 'Carteira secundária salva.' })).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('wallet-secondary').getByLabel('Apelido da carteira')).toHaveValue('Reserva do Bruno')
    if (!isMobile(page)) await expect(page.getByRole('navigation', { name: 'Meu perfil' }).getByRole('link', { name: 'Carteiras' })).toHaveAttribute('aria-current', 'page')

    await page.goto('/nfts/nft-distant-galaxy')
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
    await page.goto('/checkout')
    await expect(page.getByTestId('wallet-option').filter({ hasText: 'Reserva do Bruno' })).toBeVisible()
  })
})
