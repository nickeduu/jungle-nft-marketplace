/**
 * Reproducible Lighthouse audit against the optimized build (vite preview, mocks ON,
 * default scenario). Runs N times per page × form factor and reports the median.
 *
 *   npm run lighthouse                      # 3 runs, mobile + desktop, home + detail
 *   npm run lighthouse -- --runs=1 --form=mobile
 *
 * Reports: lighthouse-reports/<timestamp>/{page}-{form}-run{n}.report.{html,json} + summary.json
 * Uses installed Chrome, or Playwright's Chromium if Chrome is not found (CHROME_PATH overrides).
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

const PORT = 4173
const ORIGIN = `http://localhost:${PORT}`
const PAGES = { home: '/', detail: '/nfts/nft-distant-galaxy' }
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const runs = Number(args.runs ?? 3)
const forms = args.form ? [args.form] : ['mobile', 'desktop']

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function waitForServer(url, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Preview server not reachable at ${url}`)
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  try {
    return chromeLauncher.Launcher.getInstallations()[0] ?? chromium.executablePath()
  } catch {
    return chromium.executablePath()
  }
}

// Run Vite directly with this Node binary (no shell): killing `preview` then stops the server itself.
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
})
const outDir = join('lighthouse-reports', new Date().toISOString().replace(/[:.]/g, '-'))
await mkdir(outDir, { recursive: true })

const summary = {
  lighthouseVersion: null,
  chromePath: chromePath(),
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  runsPerPage: runs,
  results: {},
}

try {
  await waitForServer(ORIGIN)
  for (const form of forms) {
    for (const [pageName, path] of Object.entries(PAGES)) {
      const samples = []
      for (let run = 1; run <= runs; run++) {
        // Fresh Chrome per run: no warm cache or registered Service Worker between samples.
        const chrome = await chromeLauncher.launch({ chromePath: summary.chromePath, chromeFlags: ['--headless=new'] })
        try {
          const result = await lighthouse(
            `${ORIGIN}${path}`,
            { port: chrome.port, output: ['html', 'json'], onlyCategories: CATEGORIES, logLevel: 'error' },
            form === 'desktop' ? desktopConfig : undefined,
          )
          if (!result) throw new Error('Lighthouse returned no result')
          const { lhr, report } = result
          summary.lighthouseVersion = lhr.lighthouseVersion
          const base = join(outDir, `${pageName}-${form}-run${run}`)
          await writeFile(`${base}.report.html`, report[0])
          await writeFile(`${base}.report.json`, report[1])
          samples.push({
            ...Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
            lcpMs: Math.round(lhr.audits['largest-contentful-paint']?.numericValue ?? 0),
            cls: Number((lhr.audits['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3)),
            tbtMs: Math.round(lhr.audits['total-blocking-time']?.numericValue ?? 0),
          })
        } finally {
          await chrome.kill()
        }
      }
      const keys = Object.keys(samples[0])
      const med = Object.fromEntries(keys.map((k) => [k, median(samples.map((s) => s[k]))]))
      summary.results[`${pageName}-${form}`] = { median: med, samples }
      console.log(`${pageName.padEnd(7)} ${form.padEnd(8)}`, JSON.stringify(med))
    }
  }
  await writeFile(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
  console.log(`\nReports: ${outDir}`)
} finally {
  preview.kill()
}
