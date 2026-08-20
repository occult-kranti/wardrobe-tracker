import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { sharedAliases } from './packages/shared/aliases.mjs'

/**
 * THE SERVICE WORKER'S SHOPPING LIST, WRITTEN BY THE BUILD.
 *
 * public/sw.js used to precache nothing, and said so in a comment: Vite hashes
 * every asset name, so a list written by hand goes stale the moment we build.
 * True — of a list written by hand. This plugin writes it from the files the
 * build actually emitted, after they are emitted, so it cannot name a file
 * that is not there.
 *
 * It also stamps a hash of that list into the worker as the cache name. A new
 * build is therefore a new cache, `activate` drops every older one, and the
 * two problems that used to have no answer — a stale shell naming dead
 * filenames, and every superseded build's JS living in storage forever — both
 * end at the same line.
 *
 * If the placeholders are ever renamed or removed, this FAILS THE BUILD. A
 * worker that silently ships an unreplaced placeholder is a worker that caches
 * nothing, which is exactly the state this repo was in until 2026-08-20, and
 * it looks perfectly healthy from the outside.
 */
const BUILD_TOKEN = "'__ALMARI_BUILD__'";
const PRECACHE_TOKEN = "['__ALMARI_PRECACHE__']";

/* Files outside assets/ that the shell cannot open without, or that cost
   nothing to hold. Deliberately NOT here: demo.mp4 and demo-vertical.mp4 (18MB,
   the company board's films, no route in the app fetches them), feed-buffer/
   (unreachable while FEED_ENABLED is false) and wardrobe/ (5.5MB of sample
   photographs, cached by the worker on demand for whoever actually opens a
   sample). A precache is a promise about what a phone will spend. */
const SHELL_EXTRAS = [
  'manifest.webmanifest',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'icon.svg',
  'icon-maskable.svg',
];

function precacheServiceWorker(): Plugin {
  let outDir = 'dist';
  let root = process.cwd();
  const emitted: string[] = [];

  return {
    name: 'almari-sw-precache',
    apply: 'build',
    configResolved(config) {
      root = config.root;
      outDir = config.build.outDir;
    },
    generateBundle(_options, bundle) {
      emitted.length = 0;
      for (const file of Object.values(bundle)) {
        if (/\.(js|css)$/.test(file.fileName)) emitted.push(file.fileName);
      }
    },
    // closeBundle, not writeBundle: publicDir is copied into outDir around the
    // write, and sw.js is one of the files copied. Rewriting it before the copy
    // would hand the deploy the untouched original.
    closeBundle() {
      const dir = resolve(root, outDir);
      const worker = join(dir, 'sw.js');
      if (!existsSync(worker)) {
        this.error(`almari-sw-precache: ${worker} does not exist — public/sw.js was not copied into the build`);
      }

      const fontDir = join(dir, 'fonts');
      const fonts = existsSync(fontDir)
        ? readdirSync(fontDir).filter(name => name.endsWith('.woff2')).map(name => `fonts/${name}`)
        : [];
      const extras = SHELL_EXTRAS.filter(name => existsSync(join(dir, name)));
      const list = [...emitted, ...fonts, ...extras].sort();

      /* Three floors, because an empty or half-empty list is the one failure
         mode this plugin can have that still produces a green build and a
         worker that looks like it is working. */
      if (!emitted.some(name => name.endsWith('.js'))) {
        this.error('almari-sw-precache: the bundle emitted no JavaScript — nothing to precache');
      }
      if (!emitted.some(name => name.endsWith('.css'))) {
        this.error('almari-sw-precache: the bundle emitted no stylesheet — nothing to precache');
      }
      if (fonts.length === 0) {
        this.error('almari-sw-precache: no .woff2 in the build — the typefaces moved and offline text would fall back');
      }

      const build = createHash('sha256').update(list.join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync(worker, 'utf8');
      if (!source.includes(BUILD_TOKEN) || !source.includes(PRECACHE_TOKEN)) {
        this.error('almari-sw-precache: public/sw.js no longer carries both placeholders — it would ship caching nothing');
      }

      const written = source
        .replace(BUILD_TOKEN, JSON.stringify(build))
        .replace(PRECACHE_TOKEN, JSON.stringify(list.map(name => `./${name}`), null, 2));
      // Both placeholders appear exactly once, so both are gone by now. If one
      // is ever written twice, String.replace takes the first and leaves the
      // other standing — and the worker would read it as "no build has run"
      // and precache nothing, silently.
      if (written.includes('__ALMARI_')) {
        this.error('almari-sw-precache: a placeholder survived the rewrite — the worker would precache nothing');
      }
      writeFileSync(worker, written);
      this.info?.(`almari-sw-precache: ${list.length} files under cache almari-shell-${build}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), precacheServiceWorker()],
  base: './',
  resolve: { alias: sharedAliases() },
})
