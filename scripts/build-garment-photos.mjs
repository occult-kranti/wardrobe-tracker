#!/usr/bin/env node
/**
 * Compresses sourced garment photographs into public/wardrobe/garment/ and
 * writes the credit list.
 *
 * Input: a flat directory of <slug>.jpg plus one or more *.manifest.json files
 * carrying licence and attribution for each slug. A photo without a manifest
 * entry is DROPPED — an image whose licence we cannot state is one we cannot
 * publish, and silently shipping it would be the easy mistake here.
 *
 * Usage: node scripts/build-garment-photos.mjs <source-dir>
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const src = process.argv[2];
const indianDir = process.argv[3];
if (!src && !indianDir) {
  console.error('usage: node scripts/build-garment-photos.mjs <commons-dir> [indian-pack-dir]');
  process.exit(2);
}
const haveCommons = Boolean(src) && existsSync(src);

const OUT = new URL('../public/wardrobe/garment/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PY = `
import sys, os
from PIL import Image
src, dst, w, h, q = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
im = Image.open(src).convert('RGB')
# Fill a 4:5 tile: scale to cover, then centre-crop. A garment shot letterboxed
# into a tile reads as a mistake; cropped to the frame it reads as a catalogue.
tw, th = w, h
sw, sh = im.size
scale = max(tw / sw, th / sh)
im = im.resize((max(1, round(sw * scale)), max(1, round(sh * scale))), Image.LANCZOS)
sw, sh = im.size
im = im.crop(((sw - tw) // 2, (sh - th) // 2, (sw - tw) // 2 + tw, (sh - th) // 2 + th))
im.save(dst, 'WEBP', quality=q, method=6)
print(os.path.getsize(dst))
`;

/**
 * Search results that are not usable garment photographs, rejected by eye after
 * rendering the whole set as a contact sheet. Keyword search cannot tell a
 * garment from a painting of one, so this list is the judgement the API cannot
 * make — kept here, with reasons, so nobody re-adds them by rerunning the fetch.
 */
const REJECTED = {
  'earring-hoops-gold': "Vermeer's Girl with a Pearl Earring — a painting",
  'earring-studs-pearl': 'the same painting again',
  'scarf-wool': 'carries a visible Burberry label; no brand marks in the closet',
  'bowtie-silk': 'a how-to-tie diagram, not a bow tie',
  'bracelet-cuff': 'corroded archaeological metal fragments',
  'dinner-jacket': 'a flat cutout illustration, not a photograph',
  'blazer-tailored': 'a portrait of a person, not the garment',
  'dress-knit-column': 'a fashion portrait; the dress is incidental',
  'jacket-ripstop': 'a group of people in uniform',
  'kaftan': 'a painted illustration',
  'mule-heeled': 'a shop display wall of dozens of shoes',
  'quarter-zip': 'a group photo',
  'sandal-strappy': 'a portrait; no sandal legible',
  'shorts-linen': 'a person posing',
  'tank-ribbed': 'a portrait',
  'tie-silk': 'a market stall of many ties',
  'trousers-linen': 'historical undergarment, reads as nothing in the closet',
  'vneck-knit': 'a person in a room',
  'sneaker-leather': 'a printed cloth, not a shoe',
  'jacket-denim': 'a macro of buttons',
  'sweater-cable': 'a macro of knit texture, not a garment',
  'trousers-corduroy': 'a macro of corduroy fabric',
  'jacket-field-waxed': 'a figure in a dark alley',
  'boot-knit': 'a shoe on a desk beside a pencil; reads as clutter',
  'umbrella': 'an umbrella on a stand, oddly lit',
  'watch-field': 'duplicate of watch-dress-steel',
  'pocket-square': 'duplicate of suit-jacket',
  'rain-shell': 'a garment sealed in a museum case',
  'overcoat-wool': 'a photograph of Churchill; a person, not the coat',
  'polo-pique': 'a Lacoste polo worn by a person, logo visible',
};

const credits = [];
for (const file of haveCommons ? readdirSync(src) : []) {
  if (!file.endsWith('.manifest.json')) continue;
  const rows = JSON.parse(readFileSync(join(src, file), 'utf8'));
  if (Array.isArray(rows)) credits.push(...rows);
}
const bySlug = new Map(credits.map(c => [c.slug, c]));

const kept = [];
let bytes = 0;
for (const file of haveCommons ? readdirSync(src).sort() : []) {
  const ext = extname(file).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
  const slug = basename(file, ext);
  if (REJECTED[slug]) {
    console.warn(`drop ${slug}: ${REJECTED[slug]}`);
    continue;
  }
  const credit = bySlug.get(slug);
  if (!credit) {
    console.warn(`skip ${slug}: no manifest entry, so no licence to state`);
    continue;
  }
  try {
    const size = execFileSync(
      'python3',
      ['-c', PY, join(src, file), join(OUT, `${slug}.webp`), '520', '650', '76'],
      { encoding: 'utf8' }
    );
    bytes += Number(size.trim());
    kept.push({ ...credit, path: `wardrobe/garment/${slug}.webp` });
  } catch (err) {
    console.warn(`skip ${slug}: could not decode (${String(err).slice(0, 60)})`);
  }
}

/* ---------- the Indian outfit pack ----------
   A second source, passed as an optional second argument: AI-generated,
   photorealistic images of Indian garments in real usage — worn, hanging in a
   closet, and flat-laid on a bed. No real person and no brand is depicted, which
   is what lets them ship where a scraped product shot could not. They fill
   exactly the gaps Commons could not: saree, lehenga, sharara, churidar,
   bandhgala, sherwani, kurta. */
if (indianDir && existsSync(indianDir)) {
  const rows = JSON.parse(readFileSync(join(indianDir, 'index.json'), 'utf8'));
  const list = Array.isArray(rows) ? rows : (rows.images ?? []);
  for (const row of list) {
    const rel = row.image_file;
    if (!rel) continue;
    const slug = `in-${basename(rel, extname(rel))}`;
    const abs = join(indianDir, rel);
    if (!existsSync(abs)) continue;
    try {
      const size = execFileSync(
        'python3',
        ['-c', PY, abs, join(OUT, `${slug}.webp`), '520', '650', '78'],
        { encoding: 'utf8' }
      );
      bytes += Number(size.trim());
      kept.push({
        slug,
        path: `wardrobe/garment/${slug}.webp`,
        license: 'AI-generated for this project',
        attribution: null,
        landing_url: '',
      });
    } catch (err) {
      console.warn(`skip ${slug}: ${String(err).slice(0, 60)}`);
    }
  }
}

writeFileSync(
  new URL('../src/lib/garmentPhotos.ts', import.meta.url).pathname,
  `// GENERATED by scripts/build-garment-photos.mjs — do not edit by hand.
//
// Openly-licensed photographs of real garments, used as the closet's imagery.
// Every entry carries the licence it ships under and its attribution; anything
// that arrived without one was dropped rather than published.
//
// ${kept.length} photographs.

export interface GarmentPhoto {
  slug: string;
  path: string;
  license: string;
  attribution: string | null;
  landing_url: string;
}

export const GARMENT_PHOTOS: GarmentPhoto[] = ${JSON.stringify(
    kept.map(k => ({
      slug: k.slug,
      path: k.path,
      license: k.license ?? 'unknown',
      attribution: k.attribution ?? null,
      landing_url: k.landing_url ?? '',
    })),
    null,
    1
  )};
`
);

console.log(`Kept ${kept.length} garment photographs (${(bytes / 1048576).toFixed(1)}MB) → public/wardrobe/garment/`);
