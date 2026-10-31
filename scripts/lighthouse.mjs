/**
 * Reproducible Lighthouse audit against the optimized build (vite preview, mocks ON,
 * default scenario). Runs N times per page × form factor and reports the median.
 *
 *   npm run lighthouse                      # 3 runs, mobile + desktop, home + detail
 *   npm run lighthouse -- --runs=1 --form=mobile
 *   npm run lighthouse -- --out=docs/lighthouse/<date>   # official, versioned run
 *
 * Reports: lighthouse-reports/<timestamp>/ (git-ignored scratch runs) or --out=<dir>:
 * {page}-{form}-run{n}.report.{html,json} + summary.json (conditions, samples, medians)
 * + summary.md (the same table in Markdown).
 * Uses installed Chrome, or Playwright's Chromium if Chrome is not found (CHROME_PATH overrides).
 */
import { execSync, spawn } from 'node:child_process'
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

const LABELS = { performance: 'Perf', accessibility: 'A11y', 'best-practices': 'BP', seo: 'SEO', lcpMs: 'LCP (ms)', cls: 'CLS', tbtMs: 'TBT (ms)', benchmarkIndex: 'CPU bench' }

function toMarkdown(s) {
  const keys = Object.keys(LABELS)
  const header = `| Cenário | Execução | ${keys.map((k) => LABELS[k]).join(' | ')} |\n|---|---|${keys.map(() => '---:').join('|')}|`
  const rows = Object.entries(s.results).flatMap(([name, { samples, median: med }]) => [
    ...samples.map((sample, i) => `| ${name} | ${i + 1} | ${keys.map((k) => sample[k]).join(' | ')} |`),
    `| **${name}** | **mediana** | ${keys.map((k) => `**${med[k]}**`).join(' | ')} |`,
  ])
  return [
    `# Lighthouse — ${s.date}`,
    '',
    `Lighthouse ${s.lighthouseVersion} · Chrome ${s.chromeVersion} · Node ${s.node} · ${s.platform} · commit ${s.gitCommit ?? 'n/d'}`,
    `Build: ${s.build}. ${s.runsPerPage} execuções por página e perfil, Chrome novo a cada execução.`,
    `Páginas: ${Object.entries(s.pages).map(([k, v]) => `${k} = \`${v}\``).join(', ')}.`,
    '',
    header,
    ...rows,
    '',
  ].join('\n')
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
const outDir = args.out ?? join('lighthouse-reports', new Date().toISOString().replace(/[:.]/g, '-'))
const gitCommit = (() => {
  try {
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== ''
    return `${execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()}${dirty ? ' (+ alterações não commitadas)' : ''}`
  } catch {
    return null
  }
})()
await mkdir(outDir, { recursive: true })

const summary = {
  date: new Date().toISOString(),
  gitCommit,
  lighthouseVersion: null,
  chromeVersion: null,
  chromePath: chromePath(),
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  runsPerPage: runs,
  build: 'vite build + vite preview (VITE_ENABLE_MOCKS=true, cenário default)',
  pages: PAGES,
  conditions: {},
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
          summary.chromeVersion = lhr.environment.hostUserAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? null
          summary.conditions[form] = {
            formFactor: lhr.configSettings.formFactor,
            throttlingMethod: lhr.configSettings.throttlingMethod,
            throttling: lhr.configSettings.throttling,
            screenEmulation: lhr.configSettings.screenEmulation,
          }
          const base = join(outDir, `${pageName}-${form}-run${run}`)
          await writeFile(`${base}.report.html`, report[0])
          await writeFile(`${base}.report.json`, report[1])
          samples.push({
            ...Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
            lcpMs: Math.round(lhr.audits['largest-contentful-paint']?.numericValue ?? 0),
            cls: Number((lhr.audits['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3)),
            tbtMs: Math.round(lhr.audits['total-blocking-time']?.numericValue ?? 0),
            // Lighthouse's CPU benchmark of this machine for the run (higher = faster host).
            benchmarkIndex: Math.round(lhr.environment.benchmarkIndex),
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
  await writeFile(join(outDir, 'summary.md'), toMarkdown(summary))
  console.log(`\nReports: ${outDir}`)
} finally {
  preview.kill()
}
