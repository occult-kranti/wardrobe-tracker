import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sharedAliases } from './packages/shared/aliases.mjs'

/**
 * THE PORTAL'S OWN CONFIG, AND WHY IT IS A SECOND FILE RATHER THAN A SECOND ENTRY.
 *
 * vite.config.ts carries precacheServiceWorker(), and that plugin is
 * unconditional: it runs once at closeBundle for the whole build, writes the
 * consumer PWA's offline shopping list from EVERY .js and .css the bundle
 * emitted, and fails the build outright if public/sw.js was not copied, if no
 * .woff2 landed, or if the bundle emitted no script or no stylesheet.
 *
 * A monitoring board built through that plugin does one of two bad things.
 * Either it passes — and then every alpha tester's phone precaches the admin
 * dashboard, because generateBundle collects chunks with no entry filter, and
 * the next push to main publishes the board to the open web, because
 * .github/workflows/deploy.yml force-pushes the whole of dist/ to gh-pages.
 * Or it fails at "sw.js does not exist" the moment publicDir is turned off,
 * which it must be, because public/ holds 18MB of films the board has no use
 * for. Neither is acceptable, and the plugin has no env guard to switch off.
 *
 * So the portal gets its own plugin list, its own outDir and its own entry,
 * and vite.config.ts is not edited at all. This file is the whole separation.
 */

const here = fileURLToPath(new URL('.', import.meta.url))

/**
 * Dev only: '/' IS the portal, and the closet app is not reachable on this
 * server at all. That is the point of the separation, and serving the app's
 * index.html here by accident would undo it.
 *
 * The URL is REWRITTEN rather than redirected, so the address bar stays at '/'
 * and a reload does not walk the owner to a different page than the one they
 * bookmarked.
 */
function portalAtTheRoot(): Plugin {
  return {
    name: 'almari-portal-at-the-root',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [pathname, query] = (req.url ?? '/').split('?')
        if (pathname === '/' || pathname === '/index.html') {
          req.url = `/portal.html${query ? `?${query}` : ''}`
        }
        next()
      })
    },
  }
}

export default defineConfig({
  /**
   * ROOT STAYS THE REPO ROOT — DO NOT MOVE IT.
   *
   * @tailwindcss/vite takes its source-scanning base from the RESOLVED vite
   * root. Point root at a subdirectory and Tailwind stops scanning
   * src/components/ui.tsx, so every utility class the reused primitives depend
   * on is dropped from the emitted sheet and the board renders as unstyled
   * HTML — with no error, no warning, and nothing in the build output to say
   * what happened. If root ever has to move, the compensating line is
   * `@source "../src";` in src/portal/portal.css.
   */
  plugins: [react(), tailwindcss(), portalAtTheRoot()],
  base: './',
  /* No sw.js, no manifest, no demo.mp4, no sample wardrobes. The three faces
     the board needs are pulled through the asset pipeline by portal.css. */
  publicDir: false,
  resolve: { alias: sharedAliases() },
  build: {
    outDir: 'dist/portal',
    emptyOutDir: true,
    rollupOptions: { input: resolve(here, 'portal.html') },
  },
  /* 5173 is the app's dev server, 4173 and 4174 are the browser suites' preview
     servers, and 4180 is test-workroom.mjs's own static server. These two are
     unclaimed. strictPort so a collision fails loudly instead of drifting to
     another port and leaving the owner unsure which server they are reading. */
  server: { port: 4175, strictPort: true },
  preview: { port: 4176, strictPort: true },
})
