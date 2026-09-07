#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sharedAliases } from '../packages/shared/aliases.mjs';

global.window = {
  localStorage: {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, value) { this.store[key] = String(value); },
    removeItem(key) { delete this.store[key]; },
    clear() { this.store = {}; }
  }
};

async function run() {
  const dir = mkdtempSync(join(tmpdir(), 'test-accounts-'));
  let fail = 0;
  
  const check = (label, ok, detail = '') => {
    console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
    if (!ok) fail++;
  };

  try {
    const hookMock = join(dir, 'useLocalStorage.mjs');
    writeFileSync(hookMock, `export function noteWriteRefused() {}`);

    const mockPlugin = {
      name: 'mock',
      setup(build) {
        build.onResolve({ filter: /useLocalStorage/ }, () => ({ path: hookMock }));
      },
    };

    await build({
      alias: sharedAliases(),
      plugins: [mockPlugin],
      entryPoints: {
        accounts: fileURLToPath(new URL('../src/lib/accounts.ts', import.meta.url)),
      },
      bundle: true,
      format: 'esm',
      outdir: dir,
      outExtension: { '.js': '.mjs' },
      logLevel: 'error',
    });

    const accounts = await import(pathToFileURL(join(dir, 'accounts.mjs')).href);

    // First HTML paint and React must agree, even with a refused or corrupt
    // preference. This executes the actual inline bootstrap with no app JS.
    const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
    const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
      .map(match => match[1]).find(script => script.includes('toile-theme'));
    const cases = [
      ['new device', null, 'gilt'],
      ['unrecognised saved theme', '{"theme":"future-theme"}', 'gilt'],
      ['malformed preference', '{broken', 'gilt'],
      ['null preference', 'null', 'gilt'],
      ['explicit dark preference', '{"theme":"dark"}', 'dark'],
      ['explicit old default', '{"theme":"dyehouse"}', 'dyehouse'],
      ['existing gilt preference', '{"theme":"gilt"}', 'gilt'],
      ['system preference', '{"theme":"system"}', 'system'],
    ];
    for (const [name, stored, expected] of cases) {
      window.localStorage.clear();
      if (stored !== null) window.localStorage.setItem(accounts.THEME_KEY, stored);
      let firstPaint = null;
      runInNewContext(bootstrap, {
        localStorage: window.localStorage,
        document: { documentElement: { setAttribute(_key, value) { firstPaint = value; } } },
      });
      check(`${name}: HTML and runtime choose the same theme`,
        accounts.loadTheme() === expected && firstPaint === (expected === 'system' ? null : expected));
    }
    window.localStorage.clear();
    const blockedStore = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('Storage refused'); };
    let refusedPaint;
    try {
      runInNewContext(bootstrap, {
        localStorage: window.localStorage,
        document: { documentElement: { setAttribute(_key, value) { refusedPaint = value; } } },
      });
      check('refused preference storage still opens Rose atelier', accounts.loadTheme() === 'gilt' && refusedPaint === 'gilt');
    } finally { window.localStorage.getItem = blockedStore; }
    accounts.saveTheme('obsidian');
    check('an explicit theme selection survives reopening', accounts.loadTheme() === 'obsidian');
    check('theme cycle returns to Rose atelier after system', accounts.nextTheme('system') === 'gilt');
    
    // test wardrobeKey namespacing
    check('wardrobeKey namespacing', accounts.wardrobeKey('123') === 'wardrobe-tracker:123');

    // test loadAccounts / saveAccounts round-trip
    window.localStorage.clear();
    const accs = [{ id: '1', name: 'A', handle: '@a', monogram: 'A', color: 'red', createdAt: '2026-01-01' }];
    accounts.saveAccounts(accs);
    const loaded = accounts.loadAccounts();
    check('loadAccounts/saveAccounts round-trip', JSON.stringify(loaded) === JSON.stringify(accs));
    
    // test handleFor slug generation
    check('handleFor slug generation - spaces', accounts.handleFor('My Wardrobe') === '@mywardrobe');
    check('handleFor slug generation - symbols', accounts.handleFor('  Hello! World! ') === '@helloworld');
    check('handleFor slug generation - empty string fallback', accounts.handleFor('!@#') === '@wardrobe');

  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(fail === 0 ? '\nALL TESTS PASSED' : `\n${fail} TESTS FAILED`);
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
