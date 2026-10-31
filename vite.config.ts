import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'

/**
 * Boot preloads injected into index.html:
 * - main.tsx loads the app and the mock worker with dynamic imports (parallel download, render
 *   after MSW starts). Vite only discovers those chunks after the entry runs; listing them as
 *   `modulepreload` starts the downloads with the HTML (one request level less before the first
 *   API call). Route chunks are not included: they depend on the URL.
 * - the Latin subset of Roboto Mono (all UI text): without the preload the first render is laid
 *   out with the fallback font and laid out again when the font arrives. Measured with 4× CPU
 *   throttling: total layout on the home 460 → 139 ms (ARCHITECTURE.md › Qualidade).
 */
const BOOT_FONT = /roboto-mono-latin-wght-normal-.*\.woff2$/

function preloadBootChunks(): Plugin {
  return {
    name: 'preload-boot-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle, chunk }) {
        if (!bundle || !chunk) return []
        const files = new Set<string>()
        const visit = (file: string) => {
          const item = bundle[file]
          if (!item || item.type !== 'chunk' || files.has(file) || file === chunk.fileName) return
          files.add(file)
          item.imports.forEach(visit)
        }
        chunk.dynamicImports.forEach(visit)
        const font = Object.keys(bundle).find((file) => BOOT_FONT.test(file))
        return [
          ...(font
            ? [{ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', crossorigin: true, href: `/${font}` }, injectTo: 'head' } satisfies HtmlTagDescriptor]
            : []),
          ...[...files].map(
            (file): HtmlTagDescriptor => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `/${file}` }, injectTo: 'head' }),
          ),
        ]
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // Must come before the React plugin (file-based routes → routeTree.gen.ts).
    tanstackRouter({ target: 'react', autoCodeSplitting: true, routesDirectory: './src/app/routes', generatedRouteTree: './src/app/router/routeTree.gen.ts' }),
    react(),
    tailwindcss(),
    preloadBootChunks(),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // MSW's cookie store is unused by the simulated API; see src/mocks/vendor/tough-cookie.ts.
      { find: /^tough-cookie$/, replacement: fileURLToPath(new URL('./src/mocks/vendor/tough-cookie.ts', import.meta.url)) },
    ],
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
})
