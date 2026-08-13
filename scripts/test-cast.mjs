#!/usr/bin/env node
/**
 * The five authored sample wardrobes, checked before anyone opens one.
 *
 * These are hand-written data, and hand-written data fails in ways generated
 * data does not: a colour that is not a colour, an outfit naming a garment the
 * closet does not contain, two pieces sharing an id. Every one of those is
 * invisible until somebody is looking at the wardrobe it broke.
 */
import { build } from 'esbuild';
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path';

const out = join(mkdtempSync(join(tmpdir(), 'cast-')), 'cast.mjs');
await build({
  entryPoints: [new URL('../src/lib/personaCast.ts', import.meta.url).pathname],
  bundle: true, format: 'esm', outfile: out, logLevel: 'error',
});
const { CAST, CAST_BRIEFS } = await import(out);

let fail = 0;
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) fail++;
};

check('five wardrobes', CAST.length === 5, `${CAST.length}`);

const HEX = /^#[0-9a-fA-F]{6}$/;
const SEASONS = ['spring', 'summer', 'fall', 'winter'];
const ids = new Set();

for (const p of CAST) {
  const bad = p.items.filter(i => !HEX.test(i.color));
  check(`${p.id}: every colour is a colour`, bad.length === 0,
    bad.map(i => `${i.name}=${i.color}`).join(', '));

  const seasonBad = p.items.filter(i => !i.season.length || i.season.some(s => !SEASONS.includes(s)));
  check(`${p.id}: every season is a season`, seasonBad.length === 0,
    seasonBad.map(i => i.name).join(', '));

  const dupes = p.items.filter(i => { if (ids.has(i.id)) return true; ids.add(i.id); return false; });
  check(`${p.id}: no id collides with another wardrobe`, dupes.length === 0,
    dupes.map(i => i.id).join(', '));

  const known = new Set(p.items.map(i => i.id));
  const orphans = p.outfits.flatMap(o => o.itemIds.filter(id => !known.has(id)));
  check(`${p.id}: every outfit names pieces it owns`, orphans.length === 0, orphans.join(', '));
  check(`${p.id}: no outfit came out empty`, p.outfits.every(o => o.itemIds.length > 0),
    p.outfits.filter(o => !o.itemIds.length).map(o => o.name).join(', '));

  check(`${p.id}: a week of seven days`, p.calendar.length === 7, `${p.calendar.length}`);
  // The calendar carries OUTFIT ids by the time it leaves expand().
  const outfitIds = new Set(p.outfits.map(o => o.id));
  const weekBad = p.calendar.flatMap(d => d.outfits.filter(id => !outfitIds.has(id)));
  check(`${p.id}: the week resolves to outfits it owns`, weekBad.length === 0, weekBad.join(', '));
  check(`${p.id}: the week is not empty`, p.calendar.some(d => d.outfits.length > 0), '');

  // The lineage is recorded, and the character is not named.
  check(`${p.id}: it says where the idea came from`, p.philosophy.length >= 2, '');
}

// The rule the whole file rests on, asserted rather than trusted.
const NAMED = /\b(barry lyndon|roma|pachinko|the bear|half of a yellow sun|netflix|apple tv|hulu|fx)\b/i;
const prose = JSON.stringify(CAST_BRIEFS);
check('no film, show or studio is named anywhere in the data', !NAMED.test(prose),
  (prose.match(NAMED) ?? [''])[0]);

console.log(fail === 0 ? '\nALL CAST CHECKS PASSED' : `\n${fail} CAST CHECKS FAILED`);
process.exit(fail ? 1 : 0);
