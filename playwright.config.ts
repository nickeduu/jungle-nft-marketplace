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
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: isDev ? 'npm run dev' : 'npm run build && npm run preview',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
