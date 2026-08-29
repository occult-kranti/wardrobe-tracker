#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
