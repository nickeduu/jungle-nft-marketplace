import { expect, test, type Page } from '@playwright/test'
import { mockControl } from './support/mock-control'

/**
 * NFT detail (Etapa 3). Runs on desktop (1440) and mobile (390).
 * Expected data comes from the deterministic fixtures (src/mocks/fixtures/nfts.ts):
 * - nft-001 "Emerald Ape #042" (Figma frame): editions 1/1, 1/10, 1/50 (3 in stock, max 5/order), Aberta; 4 images; 19 reviews.
 * - nft-distant-galaxy: 1/1 sold out, 1/10 (1 in stock), 1/50 1.63 ETH (12 in stock, max 5/order).
 * - nft-life-on-edena: single edition, no reviews, only NFT of its collection.
 */
const EMERALD = '/nfts/nft-001'
const GALAXY = '/nfts/nft-distant-galaxy'

const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

const detail = (page: Page) => page.getByTestId('nft-detail')
const edition = (page: Page, name: string) => page.getByRole('radio', { name: new RegExp(`^${name.replace('/', '\\/')},`) })
const quantity = (page: Page) => page.getByTestId('quantity-value')
const increment = (page: Page) => page.getByRole('button', { name: 'Aumentar quantidade' })
const decrement = (page: Page) => page.getByRole('button', { name: 'Diminuir quantidade' })
const thumbnails = (page: Page) => page.getByRole('tab', { name: /^Ver imagem/ })
const mainImage = (page: Page) => page.getByTestId('gallery-main-image')

async function openDetail(page: Page, url: string) {
  await page.goto(url)
  await expect(detail(page)).toBeVisible()
  // The URL always carries the resolved edition (replaced on load when missing/unknown).
  await expect(page).toHaveURL(/[?&]edition=/)
}

test.describe('Detalhe do NFT: acesso e conteúdo', () => {
  test('abre o detalhe a partir do catálogo com os dados do Figma', async ({ page }) => {
    await page.goto('/?q=emerald')
    await page.getByRole('link', { name: 'Emerald Ape #042', exact: true }).click()

    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    // Default edition: the cheapest available one (the price shown on the catalog card).
    await expect(page).toHaveURL(/\/nfts\/nft-001\?edition=ed-standard$/)
    await expect(edition(page, '1/50')).toBeChecked()
    await expect(page.getByTestId('purchase-total')).toContainText('1.19 ETH')
    await expect(page.getByTestId('rating-summary')).toContainText('Avaliação média 4.8 de 5, 19 avaliações')
    const info = page.getByRole('definition')
    await expect(info.filter({ hasText: '#0042' })).toBeVisible()
    await expect(info.filter({ hasText: 'Kurio Apes' })).toBeVisible()
    await expect(info.filter({ hasText: 'Óculos, Esmeralda, Raro' })).toBeVisible()
    // Figma edition chips, in order.
    await expect(page.getByRole('group', { name: 'Edição:' }).getByRole('radio')).toHaveCount(4)
    for (const name of ['1/1', '1/10', '1/50', 'Aberta']) await expect(edition(page, name)).toBeVisible()
  })

  test('acesso direto com edição na URL (REST via MSW)', async ({ page }) => {
    const api = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/nfts/nft-001')
    await page.goto(`${EMERALD}?edition=ed-gold`)
    expect((await api).fromServiceWorker()).toBe(true)

    await expect(edition(page, '1/10')).toBeChecked()
    await expect(page).toHaveURL(/edition=ed-gold/)
    await expect(page.getByTestId('purchase-total')).toContainText('1.79 ETH')
    await expect(page.getByTestId('quantity-limit')).toHaveText('Máximo de 1 por pedido.')
  })

  test('NFT inexistente mostra 404 com caminho de volta', async ({ page }) => {
    await page.goto('/nfts/nao-existe?edition=ed-standard')
    await expect(page.getByRole('heading', { level: 1, name: 'NFT não encontrado' })).toBeVisible()
    await page.getByRole('link', { name: 'Voltar ao início' }).click()
    await expect(page).toHaveURL(/\/$/)
  })

  test('edição desconhecida na URL é substituída pela edição padrão', async ({ page }) => {
    await page.goto(`${EMERALD}?edition=nao-existe`)
    await expect(page).toHaveURL(/edition=ed-standard/)
    await expect(edition(page, '1/50')).toBeChecked()
  })
})

test.describe('Detalhe do NFT: galeria', () => {
  test('seleciona imagem pelas miniaturas', async ({ page }) => {
    await openDetail(page, EMERALD)
    await expect(thumbnails(page)).toHaveCount(4)
    await expect(mainImage(page)).toHaveAttribute('alt', 'Emerald Ape #042 — imagem 1 de 4')

    await thumbnails(page).nth(2).click()
    await expect(thumbnails(page).nth(2)).toHaveAttribute('aria-selected', 'true')
    await expect(thumbnails(page).nth(0)).toHaveAttribute('aria-selected', 'false')
    await expect(mainImage(page)).toHaveAttribute('alt', 'Emerald Ape #042 — imagem 3 de 4')
    const src = await mainImage(page).getAttribute('src')
    expect(src).toBe(await thumbnails(page).nth(2).locator('img').getAttribute('src'))
  })

  test('navega pela galeria com o teclado e amplia a imagem', async ({ page }) => {
    await openDetail(page, EMERALD)
    await thumbnails(page).first().focus()

    await page.keyboard.press('ArrowRight')
    await expect(thumbnails(page).nth(1)).toBeFocused()
    await expect(mainImage(page)).toHaveAttribute('alt', /imagem 2 de 4/)
    await page.keyboard.press('End')
    await expect(mainImage(page)).toHaveAttribute('alt', /imagem 4 de 4/)
    await page.keyboard.press('Home')
    await expect(mainImage(page)).toHaveAttribute('alt', /imagem 1 de 4/)

    // Zoom: dialog with focus trap; Escape closes and returns focus to the trigger.
    const zoom = page.getByRole('button', { name: 'Ampliar imagem' })
    await zoom.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Emerald Ape #042 — imagem 1 de 4' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('img', { name: 'Emerald Ape #042 — imagem 1 de 4' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(zoom).toBeFocused()
  })
})

test.describe('Detalhe do NFT: edições', () => {
  test('seleção de edição atualiza a URL e sobrevive ao refresh', async ({ page }) => {
    await openDetail(page, EMERALD)
    await page.getByTestId('edition-ed-open').click()
    await expect(edition(page, 'Aberta')).toBeChecked()
    await expect(page).toHaveURL(/edition=ed-open/)
    await expect(page.getByTestId('quantity-limit')).toHaveText('Máximo de 10 por pedido.')
    await expect(page.getByTestId('selected-edition-stock')).toContainText('Edição aberta: 25 disponíveis')

    await page.reload()
    await expect(edition(page, 'Aberta')).toBeChecked()
    await expect(page).toHaveURL(/edition=ed-open/)
  })

  test('setas do teclado trocam de edição', async ({ page }) => {
    await openDetail(page, EMERALD)
    await edition(page, '1/50').focus()
    await page.keyboard.press('ArrowLeft')
    await expect(edition(page, '1/10')).toBeChecked()
    await expect(edition(page, '1/10')).toBeFocused()
    await expect(page).toHaveURL(/edition=ed-gold/)
  })

  test('edição esgotada fica desabilitada e, por link direto, bloqueia a quantidade', async ({ page }) => {
    await openDetail(page, GALAXY)
    await expect(edition(page, '1/1')).toBeDisabled()
    await expect(page.getByTestId('edition-ed-genesis').getByTestId('edition-availability')).toHaveText('Esgotado')

    await page.goto(`${GALAXY}?edition=ed-genesis`)
    await expect(edition(page, '1/1')).toBeChecked()
    await expect(page.getByTestId('purchase-total')).toHaveText('Esgotada')
    await expect(page.getByTestId('quantity-limit')).toHaveText('Edição esgotada.')
    await expect(quantity(page)).toHaveText('0')
    await expect(increment(page)).toBeDisabled()
    await expect(decrement(page)).toBeDisabled()
  })
})

test.describe('Detalhe do NFT: quantidade e estoque', () => {
  test('quantidade mínima é 1', async ({ page }) => {
    await openDetail(page, GALAXY)
    await expect(quantity(page)).toHaveText('1')
    await expect(decrement(page)).toBeDisabled()
    // aria-disabled keeps it focusable; activating it changes nothing.
    await decrement(page).click({ force: true })
    await expect(quantity(page)).toHaveText('1')
  })

  test('respeita o limite por pedido e atualiza o total', async ({ page }) => {
    await openDetail(page, GALAXY)
    await expect(page.getByTestId('quantity-limit')).toHaveText('Máximo de 5 por pedido.')
    for (let i = 0; i < 4; i++) await increment(page).click()
    await expect(quantity(page)).toHaveText('5')
    await expect(increment(page)).toBeDisabled()
    // 1.63 × 5, exact decimal arithmetic.
    await expect(page.getByTestId('purchase-total')).toContainText('8.15 ETH')

    await increment(page).click({ force: true })
    await expect(quantity(page)).toHaveText('5')
    await decrement(page).click()
    await expect(quantity(page)).toHaveText('4')
    await expect(page.getByTestId('purchase-total')).toContainText('6.52 ETH')
  })

  test('estoque menor que o limite por pedido restringe a quantidade', async ({ page }) => {
    await openDetail(page, EMERALD)
    await expect(page.getByTestId('quantity-limit')).toHaveText('Apenas 3 disponíveis.')
    await increment(page).click()
    await increment(page).click()
    await expect(quantity(page)).toHaveText('3')
    await expect(increment(page)).toBeDisabled()
  })

  test('nft.updated via Socket.IO reduz o estoque e ajusta a quantidade', async ({ page }) => {
    await openDetail(page, GALAXY)
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')
    for (let i = 0; i < 4; i++) await increment(page).click()
    await expect(quantity(page)).toHaveText('5')

    const result = await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { available: 2 })
    expect(result.json).toMatchObject({ deliveredTo: 1 })

    await expect(quantity(page)).toHaveText('2')
    await expect(page.getByTestId('quantity-announcement')).toHaveText('Estoque reduzido: quantidade ajustada para 2.')
    await expect(page.getByTestId('quantity-limit')).toHaveText('Apenas 2 disponíveis.')
    await expect(page.getByTestId('purchase-total')).toContainText('3.26 ETH')
    await expect(page.getByTestId('realtime-announcement')).toHaveText(/atualizados em tempo real/)
    await expect(detail(page)).toHaveAttribute('data-version', '2')

    await mockControl(page, '/nfts/nft-distant-galaxy/editions/ed-standard', { available: 0 })
    await expect(page.getByTestId('quantity-announcement')).toHaveText('Esta edição esgotou.')
    await expect(page.getByTestId('purchase-total')).toHaveText('Esgotada')
    // The selected edition stays selected (the URL is the source of truth).
    await expect(page).toHaveURL(/edition=ed-standard/)
    await expect(edition(page, '1/50')).toBeChecked()
  })
})

test.describe('Detalhe do NFT: carregamento, falhas e ações', () => {
  test('skeleton durante carregamento lento', async ({ page }) => {
    await page.goto(`${EMERALD}?scenario=slow`)
    await expect(page.getByTestId('nft-detail-skeleton')).toBeVisible()
    await expect(detail(page)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('nft-detail-skeleton')).toBeHidden()
  })

  test('avaliações: lista, falha com nova tentativa e estado vazio', async ({ page }) => {
    await openDetail(page, EMERALD)
    // Other requests of the page settle first, so only the reviews hit the failure scenario.
    await expect(page.getByTestId('related-list')).toBeVisible()
    await mockControl(page, '/scenario', { name: 'server-error' })
    await page.getByRole('tab', { name: 'Avaliações de colecionadores (19)' }).click()
    // Transient failures are retried twice with backoff before the error is shown.
    await expect(page.getByText('Não foi possível carregar as avaliações.')).toBeVisible({ timeout: 15_000 })

    await mockControl(page, '/scenario', { name: 'default' })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('review-list').getByRole('listitem')).toHaveCount(19)

    await openDetail(page, '/nfts/nft-life-on-edena')
    await expect(page.getByTestId('rating-summary')).toHaveText('Sem avaliações')
    await page.getByRole('tab', { name: 'Avaliações de colecionadores (0)' }).click()
    await expect(page.getByText('Este NFT ainda não tem avaliações.')).toBeVisible()
    await expect(page.getByText('Não há outros NFTs desta coleção no momento.')).toBeVisible()
  })

  test('Comprar, Favoritar e Carrinho informam indisponibilidade sem simular sucesso', async ({ page }) => {
    await openDetail(page, EMERALD)
    const notice = page.getByTestId('action-notice')

    const buy = page.getByRole('button', { name: /^Comprar/ })
    await expect(buy).toHaveAttribute('aria-disabled', 'true')
    await buy.click({ force: true })
    await expect(notice).toHaveText('Compra indisponível nesta versão: requer login e carrinho.')

    await page.getByRole('button', { name: 'Favoritar' }).click({ force: true })
    await expect(notice).toHaveText('Favoritos indisponíveis nesta versão: requer login.')

    if (isMobile(page)) {
      await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click({ force: true })
      await expect(notice).toHaveText('Carrinho indisponível nesta versão.')
    }
    await expect(page).toHaveURL(/\/nfts\/nft-001/)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('"Mais desta coleção" lista a coleção sem o NFT atual e navega', async ({ page }) => {
    await openDetail(page, EMERALD)
    const related = page.getByTestId('related-list').getByTestId('nft-card')
    // Kurio Apes has 8 NFTs; the current one is excluded.
    await expect(related).toHaveCount(7)
    await expect(related.filter({ hasText: 'Emerald Ape #042' })).toHaveCount(0)

    const target = related.first()
    const name = (await target.getByRole('link').textContent()) ?? ''
    await target.getByRole('link').click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
    await expect(page).toHaveURL(/edition=/)
    await expect(mainImage(page)).toHaveAttribute('alt', /imagem 1 de/)
    await expect(quantity(page)).toHaveText(/^[01]$/)
  })
})

test.describe('Detalhe do NFT: compartilhamento', () => {
  test('copia o link com a edição selecionada', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await openDetail(page, `${EMERALD}?edition=ed-open`)
    await page.getByRole('button', { name: 'Copiar link' }).click()
    await expect(page.getByTestId('share-feedback')).toHaveText('Link copiado.')
    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toMatch(/\/nfts\/nft-001\?edition=ed-open$/)

    const mail = page.getByRole('link', { name: 'E-mail' })
    await expect(mail).toHaveAttribute('href', /^mailto:\?subject=Emerald%20Ape%20%23042&body=http.*nft-001%3Fedition%3Ded-open$/)
    await expect(page.getByRole('link', { name: 'X (abre em nova aba)' })).toHaveAttribute('target', '_blank')
  })

  test('usa o compartilhamento nativo quando o navegador oferece', async ({ page }) => {
    await page.addInitScript(() => {
      const calls: ShareData[] = []
      Object.assign(window, { __shareCalls: calls })
      Object.defineProperty(navigator, 'share', { value: (data: ShareData) => (calls.push(data), Promise.resolve()) })
    })
    await openDetail(page, EMERALD)
    await page.getByRole('button', { name: 'Compartilhar…' }).click()
    const calls = await page.evaluate(() => (window as unknown as { __shareCalls: ShareData[] }).__shareCalls)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.title).toBe('Emerald Ape #042')
    expect(calls[0]?.url).toMatch(/\/nfts\/nft-001\?edition=ed-standard$/)
  })

  test('sem Web Share API o botão nativo não aparece', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }))
    await openDetail(page, EMERALD)
    await expect(page.getByRole('button', { name: 'Compartilhar…' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Copiar link' })).toBeVisible()
  })
})

test.describe('Detalhe do NFT: responsividade', () => {
  test('desktop: breadcrumb, miniaturas à esquerda e painel de compra no fluxo', async ({ page }) => {
    test.skip(isMobile(page), 'layout desktop')
    await openDetail(page, EMERALD)
    const breadcrumb = page.getByRole('navigation', { name: 'Trilha de navegação' })
    await expect(breadcrumb.getByRole('link', { name: 'Início' })).toBeVisible()
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Emerald Ape #042')

    const thumb = await thumbnails(page).first().boundingBox()
    const main = await mainImage(page).boundingBox()
    expect(thumb && main && thumb.x + thumb.width <= main.x).toBe(true)
    await expect(page.getByTestId('purchase-panel')).toHaveCSS('position', 'static')
    await expect(page.getByTestId('selected-edition-price')).toHaveText('1.19 ETH')
    await expect(page.getByRole('button', { name: 'Voltar' })).toBeHidden()

    for (const width of [1440, 768]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  })

  test('mobile: barra inferior fixa sem esconder conteúdo e voltar', async ({ page }) => {
    test.skip(!isMobile(page), 'layout mobile')
    await page.goto('/?q=emerald')
    await page.getByRole('link', { name: 'Emerald Ape #042', exact: true }).click()
    await expect(detail(page)).toBeVisible()

    // Figma mobile-02: own header and purchase bar instead of the app bottom navigation.
    await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Trilha de navegação' })).toBeHidden()
    const bar = page.getByTestId('purchase-panel')
    await expect(bar).toHaveCSS('position', 'fixed')
    const viewport = page.viewportSize()!
    const barBox = (await bar.boundingBox())!
    expect(Math.round(barBox.y + barBox.height)).toBe(viewport.height)
    await expect(bar.getByRole('button', { name: 'Comprar NFT' })).toBeVisible()
    await expect(bar.getByTestId('purchase-total')).toHaveText('Total: 1.19 ETH')

    // The end of the page can be scrolled above the bar.
    const last = page.getByRole('button', { name: 'Simulação (MSW)' })
    await last.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const lastBox = (await last.boundingBox())!
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(barBox.y)

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page).toHaveURL(/\/\?q=emerald$/)
  })
})
