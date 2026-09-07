import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sharedAliases } from './packages/shared/aliases.mjs'

const here = fileURLToPath(new URL('.', import.meta.url))
/** Both local servers open the operator entry at /; no consumer index fallback. */
function portalAtTheRoot(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const [pathname, query] = (req.url ?? '/').split('?')
    if (pathname === '/' || pathname === '/index.html') req.url = '/portal.html' + (query ? '?' + query : '')
    next()
  }
  return {
    name: 'almari-portal-at-the-root',
    configureServer(server) { server.middlewares.use(rewrite) },
    configurePreviewServer(server) { server.middlewares.use(rewrite) },
  }
}

/** Separate entry, output and plugins: never enters the consumer precache.
 * The owner authorized publishing this public shell on 2026-09-07. Deployment
 * stages it at /portal/ only after the consumer isolation gate.
 * Keep root here so Tailwind scans shared UI primitives in src/components.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), portalAtTheRoot()],
  base: './', publicDir: false,
  resolve: { alias: sharedAliases() },
  build: {
    outDir: 'dist-portal', emptyOutDir: true,
    rollupOptions: { input: resolve(here, 'portal.html') },
  },
  server: { port: 4175, host: '127.0.0.1', strictPort: true },
  preview: { port: 4177, host: '127.0.0.1', strictPort: true },
})
