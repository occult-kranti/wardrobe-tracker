#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sharedAliases } from '../packages/shared/aliases.mjs';

async function run() {
  const dir = mkdtempSync(join(tmpdir(), 'test-outdoors-'));
  let fail = 0;
  
  const check = (label, ok, detail = '') => {
    console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
    if (!ok) fail++;
  };

  try {
    await build({
      alias: sharedAliases(),
      entryPoints: {
        outdoors: fileURLToPath(new URL('../src/lib/outdoors.ts', import.meta.url)),
      },
      bundle: true,
      format: 'esm',
      outdir: dir,
      outExtension: { '.js': '.mjs' },
      logLevel: 'error',
    });

    const outdoors = await import(pathToFileURL(join(dir, 'outdoors.mjs')).href);
    
    // test suitsOutdoors
    const item1 = { id: 'i1', name: 'Winter Coat', season: ['winter', 'fall'] };
    check('suitsOutdoors cold suits winter coat', outdoors.suitsOutdoors(item1, 'cold'));
    check('suitsOutdoors warm rejects winter coat', !outdoors.suitsOutdoors(item1, 'warm'));

    const item2 = { id: 'i2', name: 'T-shirt', season: ['summer', 'spring'] };
    check('suitsOutdoors warm suits t-shirt', outdoors.suitsOutdoors(item2, 'warm'));
    check('suitsOutdoors cold rejects t-shirt', !outdoors.suitsOutdoors(item2, 'cold'));

    const item3 = { id: 'i3', name: 'No season' }; // undefined season
    check('suitsOutdoors suits untagged items', outdoors.suitsOutdoors(item3, 'cold'));
    check('suitsOutdoors suits untagged items (warm)', outdoors.suitsOutdoors(item3, 'warm'));

    check('suitsOutdoors null weather suits everything', outdoors.suitsOutdoors(item2, null));

    // test SPOILT_BY_RAIN
    const silkShirt = { id: 'i4', name: 'Silk Shirt', season: ['summer'] };
    check('suitsOutdoors wet rejects silk in name', !outdoors.suitsOutdoors(silkShirt, 'wet'));
    
    const suedeShoes = { id: 'i5', name: 'Shoes', material: 'suede' };
    check('suitsOutdoors wet rejects suede in material', !outdoors.suitsOutdoors(suedeShoes, 'wet'));

    const velvetNotes = { id: 'i6', name: 'Blazer', notes: 'has a velvet collar' };
    check('suitsOutdoors wet rejects velvet in notes', !outdoors.suitsOutdoors(velvetNotes, 'wet'));

    const rainJacket = { id: 'i7', name: 'Rain Jacket', material: 'nylon', season: ['spring'] };
    check('suitsOutdoors wet suits nylon', outdoors.suitsOutdoors(rainJacket, 'wet'));

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
