import { expect, test, type Locator, type Page } from '@playwright/test'
import { mockControl } from './support/mock-control'

/**
 * Catalog E2E. Runs on desktop (1440, sidebar) and mobile (390, filters in a drawer).
 * Expected data comes from the deterministic fixtures in src/mocks/fixtures/nfts.ts.
 */

/** Mirrors CATALOG_PAGE_SIZE (3×3 grid, as in the Figma). */
const PAGE_SIZE = 9

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

const cards = (page: Page) => page.getByTestId('nft-card')
const searchBox = (page: Page) => page.getByRole('searchbox', { name: 'Buscar NFTs' }).locator('visible=true')

async function waitForResults(page: Page) {
  await expect(page.getByTestId('results-summary')).toHaveText(/encontrad/)
  await expect(page.getByTestId('catalog-grid').or(page.getByTestId('catalog-empty'))).not.toHaveAttribute('aria-busy', 'true')
}

/** Desktop: sidebar. Mobile: opens the filters drawer and returns it. */
async function filters(page: Page): Promise<Locator> {
  if (!isMobile(page)) return page.getByRole('complementary', { name: 'Filtros' })
  await page.getByRole('button', { name: 'Abrir filtros' }).click()
  const dialog = page.getByRole('dialog', { name: 'Filtros' })
  await expect(dialog).toBeVisible()
  return dialog
}

async function closeFilters(page: Page) {
  if (!isMobile(page)) return
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
}

const cardIds = (page: Page) => cards(page).evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.nftId))
const cardAttr = (page: Page, attr: string) =>
  cards(page).evaluateAll((els, name) => els.map((el) => el.getAttribute(name)), attr)

/** Exact decimal → wei (test-side, no floats). */
function toWei(eth: string): bigint {
  const [whole = '0', fraction = ''] = eth.split('.')
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'))
}

test.describe('Catálogo', () => {
  test('exibe o catálogo a partir da API simulada (MSW)', async ({ page }) => {
    const list = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/nfts')
    await page.goto('/')
    const response = await list
    expect(response.fromServiceWorker()).toBe(true)

    await waitForResults(page)
    await expect(page.getByTestId('results-summary')).toHaveText('32 NFTs encontrados')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    await expect(page.getByRole('navigation', { name: 'Paginação' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: /seja dono d/i })).toBeVisible()
  })

  test('busca atualiza a URL, envia `q` à API e trata resultado vazio', async ({ page }) => {
    await page.goto('/')
    await waitForResults(page)

    const request = page.waitForRequest((r) => new URL(r.url()).searchParams.get('q') === 'ape #')
    await searchBox(page).fill('ape #')
    await request
    await expect(page).toHaveURL(/[?&]q=ape(\+|%20)%23/)
    await waitForResults(page)
    await expect(cards(page)).toHaveCount(3)
    for (const name of await cards(page).getByRole('link').allTextContents()) expect(name).toMatch(/Ape #/)

    await searchBox(page).fill('zzz-nada')
    await expect(page.getByTestId('catalog-empty')).toContainText('Nenhum NFT encontrado')
    await page.getByTestId('catalog-empty').getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    await expect(searchBox(page)).toHaveValue('')
  })

  test('filtros combinados refletem na URL, na API e reiniciam a paginação', async ({ page }) => {
    await page.goto('/?page=2')
    await waitForResults(page)

    const panel = await filters(page)
    await panel.getByRole('button', { name: /Música/ }).click()
    await expect(page).toHaveURL(/category=music/)
    await expect(page).not.toHaveURL(/page=/)

    const request = page.waitForRequest((r) => {
      const params = new URL(r.url()).searchParams
      return params.getAll('category').includes('music') && params.getAll('network').includes('polygon')
    })
    await panel.getByRole('button', { name: /Polygon/ }).click()
    await request
    await expect(panel.getByRole('button', { name: /Música/ })).toHaveAttribute('aria-pressed', 'true')
    await closeFilters(page)

    await expect(page).toHaveURL(/category=music&network=polygon/)
    await waitForResults(page)
    await expect(cards(page)).toHaveCount(2)
    expect(new Set(await cardAttr(page, 'data-category'))).toEqual(new Set(['music']))
    expect(new Set(await cardAttr(page, 'data-network'))).toEqual(new Set(['polygon']))

    // Tab combines with the filters.
    await page.getByRole('link', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/tab=trending/)
    await expect(page).toHaveURL(/category=music/)
  })

  test('faixa de preço por teclado no slider', async ({ page }) => {
    await page.goto('/')
    await waitForResults(page)
    const panel = await filters(page)
    await expect(panel.getByTestId('price-range-label')).toHaveText('Preço: 0,02 - 12,30 ETH')

    // Radix: Home/End always move the first/last thumb; PageUp moves the focused one by 10 steps.
    await panel.getByRole('slider', { name: 'Preço mínimo' }).focus()
    for (let i = 0; i < 10; i++) await page.keyboard.press('PageUp')
    await expect(panel.getByTestId('price-range-label')).toHaveText('Preço: 1,02 - 12,30 ETH')
    await panel.getByRole('button', { name: 'Aplicar' }).click()
    await closeFilters(page)

    await expect(page).toHaveURL(/min=1\.02/)
    await expect(page).not.toHaveURL(/max=/)
    await waitForResults(page)
    const prices = await cardAttr(page, 'data-price')
    expect(prices.length).toBeGreaterThan(0)
    for (const price of prices) expect(toWei(price ?? '0') >= toWei('1.02')).toBe(true)
  })

  test('ordenação por preço é aplicada pela API', async ({ page }) => {
    await page.goto('/')
    await waitForResults(page)

    const scope = isMobile(page) ? await filters(page) : page
    await scope.getByLabel('Ordenar por:').locator('visible=true').selectOption('price-asc')
    await closeFilters(page)
    await expect(page).toHaveURL(/sort=price-asc/)
    await waitForResults(page)

    const prices = (await cardAttr(page, 'data-price')).map((p) => toWei(p ?? '0'))
    expect(prices.length).toBe(PAGE_SIZE)
    for (let i = 1; i < prices.length; i++) expect(prices[i]! >= prices[i - 1]!).toBe(true)
    expect(await cardAttr(page, 'data-price')).toContain('0.02')
  })

  test('paginação sobrevive a refresh e ao histórico do navegador', async ({ page }) => {
    await page.goto('/')
    await waitForResults(page)
    const page1 = await cardIds(page)

    await page.getByRole('link', { name: 'Próxima página' }).click()
    await expect(page).toHaveURL(/page=2/)
    await waitForResults(page)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    const page2 = await cardIds(page)
    expect(page2.some((id) => page1.includes(id))).toBe(false)

    await page.reload()
    await waitForResults(page)
    expect(await cardIds(page)).toEqual(page2)

    await page.goBack()
    await expect(page).not.toHaveURL(/page=/)
    await waitForResults(page)
    expect(await cardIds(page)).toEqual(page1)

    await page.goForward()
    await expect(page).toHaveURL(/page=2/)
    await waitForResults(page)
    expect(await cardIds(page)).toEqual(page2)
  })

  test('acesso direto a uma URL filtrada restaura os controles', async ({ page }) => {
    await page.goto('/?q=nomad&tab=trending&category=music,photography&network=polygon&sort=price-desc')
    await waitForResults(page)

    await expect(searchBox(page)).toHaveValue('nomad')
    await expect(page.getByRole('link', { name: 'Em alta' })).toHaveAttribute('aria-current', 'page')
    const panel = await filters(page)
    await expect(panel.getByRole('button', { name: /Música/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByRole('button', { name: /Fotografia/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByRole('button', { name: /Polygon/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByRole('button', { name: /Solana/ })).toHaveAttribute('aria-pressed', 'false')
    // Desktop: sort lives in the toolbar; mobile: inside the filters drawer.
    const sortScope = isMobile(page) ? panel : page
    await expect(sortScope.getByLabel('Ordenar por:').locator('visible=true')).toHaveValue('price-desc')
  })

  test('valores inválidos na URL são descartados; categoria desconhecida é rejeitada pela API', async ({ page }) => {
    await page.goto('/?sort=foo&page=-3&min=abc&network=bitcoin')
    await waitForResults(page)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    await page.goto('/?category=nao-existe')
    await expect(page.getByTestId('catalog-error')).toContainText('Filtros inválidos')
  })

  test('navega para o detalhe e volta preservando os filtros', async ({ page }) => {
    await page.goto('/?q=ape+%23&sort=name-asc')
    await waitForResults(page)
    const first = cards(page).first()
    const name = (await first.getByRole('link').textContent()) ?? ''

    await first.getByRole('link').click()
    await expect(page).toHaveURL(/\/nfts\/nft-/)
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/q=ape/)
    await expect(page).toHaveURL(/sort=name-asc/)
    await expect(searchBox(page)).toHaveValue('ape #')
    await expect(cards(page)).toHaveCount(3)
  })

  test('destaque do hero leva ao NFT', async ({ page }) => {
    await page.goto('/')
    const hero = page.getByRole('region', { name: /seja dono d/i })
    await hero.getByRole('button', { name: /Destaque 2 de/ }).click()
    await expect(hero.getByRole('button', { name: /Destaque 2 de/ })).toHaveAttribute('aria-pressed', 'true')
    const image = hero.getByRole('img', { name: /^Destaque: / })
    const alt = (await image.getAttribute('alt')) ?? ''
    await image.click()
    await expect(page.getByRole('heading', { level: 1, name: alt.replace('Destaque: ', '') })).toBeVisible()
  })
})

test.describe('Catálogo: carregamento, falhas e concorrência', () => {
  test('skeleton durante carregamento lento', async ({ page }) => {
    await page.goto('/?scenario=slow')
    await expect(page.getByTestId('catalog-grid')).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByTestId('catalog-grid').locator('li[aria-hidden="true"]')).toHaveCount(PAGE_SIZE)
    await expect(cards(page)).toHaveCount(PAGE_SIZE, { timeout: 10_000 })
  })

  test('erro 5xx com recuperação por nova tentativa', async ({ page }) => {
    await page.goto('/?scenario=server-error')
    await expect(page.getByTestId('catalog-error')).toContainText('Não foi possível carregar os NFTs', { timeout: 15_000 })
    await mockControl(page, '/scenario', { name: 'default' })
    await page.getByTestId('catalog-error').getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
  })

  test('cenário vazio mostra estado vazio', async ({ page }) => {
    await page.goto('/?scenario=empty')
    await expect(page.getByTestId('catalog-empty')).toContainText('Ainda não há NFTs')
  })

  test('resposta antiga e lenta não sobrescreve a busca mais recente', async ({ page }) => {
    // out-of-order: 1st list request answers in 2000 ms, the 2nd in 100 ms.
    await page.goto('/?scenario=out-of-order')
    const slowRequest = page.waitForEvent('requestfinished', { predicate: (r) => new URL(r.url()).pathname === '/api/nfts', timeout: 5_000 }).catch(() => null)
    await searchBox(page).fill('ape #')
    await searchBox(page).press('Enter')
    await expect(cards(page)).toHaveCount(3)

    // Let the stale (first) response window pass, then verify the newest result is kept.
    await slowRequest
    await page.waitForTimeout(2_200)
    await expect(cards(page)).toHaveCount(3)
    await expect(page.getByTestId('results-summary')).toHaveText('3 NFTs encontrados')
  })

  test('nft.updated via Socket.IO atualiza o preço no catálogo', async ({ page }) => {
    await page.goto('/?q=Golden+Beat')
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
    await expect(cards(page)).toHaveCount(1)
    await expect(cards(page).getByTestId('nft-card-price')).toContainText('0.99 ETH')

    await mockControl(page, '/nfts/nft-007/editions/ed-standard', { priceEth: '0.5' })
    await expect(cards(page).getByTestId('nft-card-price')).toContainText('0.5 ETH')
  })
})

test.describe('Catálogo: responsividade', () => {
  test('sem overflow horizontal em 390, 768 e 1440 px', async ({ page }) => {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')
      await waitForResults(page)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, `overflow em ${width}px`).toBe(0)
      if (width < 768) {
        await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toBeVisible()
        await expect(page.getByRole('complementary', { name: 'Filtros' })).toBeHidden()
      } else if (width >= 1024) {
        await expect(page.getByRole('complementary', { name: 'Filtros' })).toBeVisible()
        await expect(page.getByRole('navigation', { name: 'Principal' })).toBeVisible()
      } else {
        await expect(page.getByRole('button', { name: 'Filtros' })).toBeVisible()
      }
    }
  })
})
