import { expect, test } from '@playwright/test'
import { mockControl } from './support/mock-control'
import { recordRealtimeTransitions } from './support/realtime'

const NFT_URL = '/nfts/nft-distant-galaxy'

test.describe('Fundação: React → Query → Axios → MSW', () => {
  test('carrega o NFT a partir do handler MSW (Service Worker)', async ({ page }) => {
    const apiResponse = page.waitForResponse((r) => r.url().endsWith('/api/nfts/nft-distant-galaxy'))
    await page.goto('/')
    await page.getByRole('link', { name: 'Ver NFT de demonstração' }).click()

    const response = await apiResponse
    expect(response.status()).toBe(200)
    // Proof the response was produced by the MSW Service Worker, not a real server.
    expect(response.fromServiceWorker()).toBe(true)

    await expect(page.getByRole('heading', { level: 1, name: 'Distant Galaxy' })).toBeVisible()
    await expect(page.getByTestId('edition-ed-standard').getByTestId('edition-price')).toHaveText('1.63 ETH')
  })

  test('acesso direto a NFT inexistente mostra 404 da API', async ({ page }) => {
    await page.goto('/nfts/nao-existe')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
  })

  test('rota inexistente mostra página não encontrada', async ({ page }) => {
    await page.goto('/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('cenário de erro 5xx mostra erro e recupera após nova tentativa', async ({ page }) => {
    await page.goto(`${NFT_URL}?scenario=server-error`)
    await expect(page.getByRole('heading', { name: 'Não foi possível carregar o NFT' })).toBeVisible({ timeout: 15_000 })

    await mockControl(page, '/scenario', { name: 'default' })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Distant Galaxy' })).toBeVisible()
  })

  test('cenário lento exibe skeleton antes do conteúdo', async ({ page }) => {
    await page.goto(`${NFT_URL}?scenario=slow`)
    await expect(page.getByTestId('nft-detail-skeleton')).toBeVisible()
    await expect(page.getByTestId('nft-detail')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Fundação: Socket.IO via MSW', () => {
  test('nft.updated recebido pelo socket.io-client atualiza a tela', async ({ page }) => {
    await page.goto(NFT_URL)
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
    await expect(page.getByTestId('nft-detail')).toHaveAttribute('data-version', '1')

    const result = await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', {
      priceEth: '1.75',
      available: 0,
    })
    expect(result.json).toMatchObject({ deliveredTo: 1 })

    const edition = page.getByTestId('edition-ed-standard')
    await expect(edition.getByTestId('edition-price')).toHaveText('1.75 ETH')
    await expect(edition.getByTestId('edition-availability')).toHaveText('Esgotado')
    await expect(page.getByTestId('nft-detail')).toHaveAttribute('data-version', '2')
    await expect(page.getByTestId('realtime-announcement')).toHaveText(/atualizados em tempo real/)

    // The same change is visible through REST after reload (store shared by REST and events).
    await page.reload()
    await expect(page.getByTestId('edition-ed-standard').getByTestId('edition-price')).toHaveText('1.75 ETH')
  })

  test('ignora eventos duplicados e antigos (versão)', async ({ page }) => {
    await page.goto(NFT_URL)
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
    const price = page.getByTestId('edition-ed-standard').getByTestId('edition-price')

    const res = await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { priceEth: '3' })
    const applied = (res.json as { event: Record<string, unknown> }).event
    await expect(page.getByTestId('nft-detail')).toHaveAttribute('data-version', '2')
    await expect(price).toHaveText('3 ETH')

    const emit = (payload: Record<string, unknown>) => mockControl(page, '/socket/emit', { event: 'nft.updated', payload })
    const standardAt = (priceEth: string) => ({ editions: [{ id: 'ed-standard', priceEth, available: 12 }] })

    // Duplicate: same eventId as an applied event (even with a higher version) is ignored.
    await emit({ ...applied, version: 50, data: standardAt('99') })
    // Stale: new eventId but version <= cached is ignored.
    await emit({ ...applied, eventId: 'stale-1', version: 1, data: standardAt('0.5') })
    // Marker (touches only ed-gold): Socket.IO preserves order, so once it is applied
    // the two events above were already processed.
    await emit({
      ...applied,
      eventId: 'marker-1',
      version: 3,
      data: { editions: [{ id: 'ed-gold', priceEth: '4.2', available: 0 }] },
    })
    await expect(page.getByTestId('edition-ed-gold').getByTestId('edition-availability')).toHaveText('Esgotado')
    await expect(page.getByTestId('nft-detail')).toHaveAttribute('data-version', '3')
    await expect(price).toHaveText('3 ETH')
  })

  test('reconecta após queda e reconcilia com a API REST', async ({ page }) => {
    await page.goto(NFT_URL)
    const status = page.getByTestId('realtime-status')
    const price = page.getByTestId('edition-ed-standard').getByTestId('edition-price')
    await expect(status).toHaveAttribute('data-status', 'connected')
    await expect(price).toHaveText('1.63 ETH')
    const transitions = await recordRealtimeTransitions(page)

    // Change lost by the client (no event emitted): the UI must still show the old price.
    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { priceEth: '2', silent: true })
    await expect(price).toHaveText('1.63 ETH')

    // Drop the connection; socket.io-client reconnects and the app refetches from REST.
    await mockControl(page, '/socket/disconnect')
    await expect.poll(transitions).toEqual(['disconnected', 'connected'])
    await expect(price).toHaveText('2 ETH')
  })

  test('conexão sobrevive além do pingTimeout (heartbeat do mock)', async ({ page }) => {
    await page.clock.install()
    await page.goto(NFT_URL)
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
    const transitions = await recordRealtimeTransitions(page)

    // Without mock heartbeats the client drops at 30s (pingInterval + pingTimeout) and reconnects.
    await page.clock.runFor(65_000)
    expect(await transitions()).toEqual([])

    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-gold', { available: 0 })
    await expect(page.getByTestId('edition-ed-gold').getByTestId('edition-availability')).toHaveText('Esgotado')
  })
})
