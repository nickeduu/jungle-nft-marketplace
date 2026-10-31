import { defineConfig, devices } from '@playwright/test'

/**
 * E2E runs against the production build served by `vite preview`, with MSW enabled
 * (same artifact as the demo deploy). `E2E_TARGET=dev` runs against the Vite dev server.
 * Each test gets a fresh browser context, so localStorage (mock DB + scenario) starts from the seed.
 */
const isDev = process.env.E2E_TARGET === 'dev'
const PORT = isDev ? 5173 : 4173
const baseURL = `http://localhost:${PORT}`
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  // Visual baselines: tests/e2e/__screenshots__/<platform>/<project>/ (README › Regressão visual).
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{projectName}/{arg}{ext}',
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css' } },
  projects: [
    { name: 'desktop-chromium', testIgnore: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', testIgnore: /visual\.spec\.ts/, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    // Visual regression at the README widths (390, 768, 1440), device scale factor 1.
    { name: 'visual-desktop', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: 'visual-tablet', testMatch: /visual\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1, hasTouch: true } },
    { name: 'visual-mobile', testMatch: /visual\.spec\.ts/, use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: isDev ? 'npm run dev' : 'npm run build && npm run preview',
    url: baseURL,
    // Never reuse: a leftover preview would serve a stale dist/ without rebuilding.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
