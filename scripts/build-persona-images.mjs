#!/usr/bin/env node
/**
 * Compresses the persona lookbook renders and the brand reference shots into
 * public/wardrobe/, which Vite copies to the built site verbatim.
 *
 * These are photographs, so unlike the drawn plates in src/lib/garmentArt.ts they
 * cannot be inlined as data-URIs: 84 images at ~1MB each would be ~55MB, and
 * localStorage caps out around 5MB. They ship as files and the demo state stores
 * relative paths. That keeps the offline-first promise — the paths resolve
 * against the built site's own origin, never the network, which is also why
 * scripts/test-demo.mjs's "no remote urls" assertion still holds.
 *
 * Usage: node scripts/build-persona-images.mjs <personas-dir> <brands-dir>
 */
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const [personasDir, brandsDir] = process.argv.slice(2);
if (!personasDir) {
  console.error('usage: node scripts/build-persona-images.mjs <personas-dir> [brands-dir]');
  process.exit(2);
}

const OUT = fileURLToPath(new URL('../public/wardrobe/', import.meta.url));

/** Outfit renders are shown at 4:5 tiles and full width on a profile page. */
const OUTFIT = { w: 640, h: 960, q: 76 };
/** Brand product shots only ever appear as closet tiles. */
const PRODUCT = { w: 520, h: 693, q: 74 };

const PY = `
import sys, os
from PIL import Image
src, dst, w, h, q = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
im = Image.open(src).convert('RGB')
im.thumbnail((w, h), Image.LANCZOS)
im.save(dst, 'WEBP', quality=q, method=6)
print(os.path.getsize(dst))
`;

function convert(src, dst, spec) {
  const bytes = execFileSync('python3', ['-c', PY, src, dst, String(spec.w), String(spec.h), String(spec.q)], {
    encoding: 'utf8',
  });
  return Number(bytes.trim());
}

const manifest = { outfits: {}, products: [] };
let total = 0;

// ---- persona outfit renders: images/<persona>/<OUTFIT-ID>_<slug>.png
const personaImages = join(personasDir, 'images');
for (const persona of readdirSync(personaImages)) {
  const dir = join(personaImages, persona);
  if (!statSync(dir).isDirectory()) continue;
  mkdirSync(join(OUT, persona), { recursive: true });
  for (const file of readdirSync(dir).sort()) {
    if (extname(file) !== '.png') continue;
    const outfitId = basename(file, '.png').split('_')[0]; // 'AM-01'
    const rel = `wardrobe/${persona}/${outfitId}.webp`;
    total += convert(join(dir, file), join(OUT, persona, `${outfitId}.webp`), OUTFIT);
    manifest.outfits[outfitId] = rel;
  }
}

// ---- brand reference shots: <gender>/<brand>/<category>.jpg
if (brandsDir && existsSync(brandsDir)) {
  mkdirSync(join(OUT, 'brand'), { recursive: true });
  for (const group of readdirSync(brandsDir)) {
    const groupDir = join(brandsDir, group);
    if (!statSync(groupDir).isDirectory()) continue;
    for (const brand of readdirSync(groupDir)) {
      const brandDir = join(groupDir, brand);
      if (!statSync(brandDir).isDirectory()) continue;
      for (const file of readdirSync(brandDir).sort()) {
        if (!['.jpg', '.jpeg', '.png'].includes(extname(file).toLowerCase())) continue;
        const slug = `${brand}-${basename(file, extname(file))}`.toLowerCase();
        const rel = `wardrobe/brand/${slug}.webp`;
        total += convert(join(brandDir, file), join(OUT, 'brand', `${slug}.webp`), PRODUCT);
        manifest.products.push({ slug, brand, category: basename(file, extname(file)), path: rel });
      }
    }
  }
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));

const count = Object.keys(manifest.outfits).length + manifest.products.length;
console.log(`Converted ${count} images (${(total / 1048576).toFixed(1)}MB) into public/wardrobe/`);
