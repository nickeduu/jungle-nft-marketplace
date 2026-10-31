import { expect, test, type Page } from '@playwright/test'
import { ANA, appReady, login } from './support/auth'

/**
 * Visual regression (README §9): home, NFT detail, cart and checkout at 1440, 768 and 390 px
 * (projects visual-desktop / visual-tablet / visual-mobile in playwright.config.ts).
 *
 * Stable capture conditions:
 * - fresh context per test → mock DB starts from the deterministic seed (default scenario);
 * - fixed clock (`setFixedTime`: Date is frozen, timers still run, so mock latency works);
 * - realtime connected, data loaded, every image (lazy ones included) loaded and decoded,
 *   web fonts ready, animations and caret disabled by `toHaveScreenshot`;
 * - device scale factor 1 and the same OS/fonts as the committed baselines (the platform is
 *   part of the snapshot path).
 *
 * Baselines change only with an intentional visual change: `npm run test:visual:update`,
 * then review the new PNGs in the diff before committing (README › Regressão visual).
 */

const FIXED_NOW = new Date('2026-03-15T15:00:00-03:00')

async function settle(page: Page) {
  await appReady(page)
  await page.waitForLoadState('networkidle')
  await page.evaluate(async () => {
    await document.fonts.ready
    const images = [...document.images]
    for (const img of images) img.loading = 'eager'
    await Promise.all(images.map((img) => img.decode().catch(() => undefined)))
  })
  // Nothing may still be loading (skeletons) or fall back to the placeholder.
  await expect(page.locator('[data-slot="skeleton"], [aria-busy="true"]')).toHaveCount(0)
  await expect(page.locator('img[data-fallback]')).toHaveCount(0)
  await expect(page.getByTestId('feedback-toast')).toHaveCount(0)
}

async function snap(page: Page, name: string) {
  await settle(page)
  await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true })
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_NOW)
})

test('início / catálogo', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('nft-card')).toHaveCount(9)
  await snap(page, 'home')
})

test('detalhe do NFT', async ({ page }) => {
  await page.goto('/nfts/nft-001')
  await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  await expect(page.getByTestId('related-list')).toBeVisible()
  await snap(page, 'nft-detail')
})

/** Signs in as Ana and adds Distant Galaxy 1/50 and Emerald Ape #042 1/50 through the UI. */
async function fillCart(page: Page) {
  await login(page, ANA, '/login?redirect=%2Fnfts%2Fnft-distant-galaxy')
  for (const nft of ['nft-distant-galaxy', 'nft-001']) {
    if (!page.url().endsWith(nft)) await page.goto(`/nfts/${nft}`)
    await page.getByRole('button', { name: /^Comprar/ }).click()
    await expect(page.getByTestId('action-notice')).toContainText('adicionado ao carrinho')
  }
}

test('carrinho', async ({ page }) => {
  await fillCart(page)
  await page.goto('/cart')
  await expect(page.getByTestId('cart-item')).toHaveCount(2)
  await snap(page, 'cart')
})

test('pagamento / checkout', async ({ page }) => {
  await fillCart(page)
  await page.goto('/checkout')
  // 1.63 + 1.19 + Ethereum fee 0.016.
  await expect(page.getByTestId('checkout-total')).toHaveText('2.836 ETH')
  await snap(page, 'checkout')
})
