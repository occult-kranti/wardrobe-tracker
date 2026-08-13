#!/usr/bin/env node
/**
 * Pulls openly-licensed garment photographs from Wikimedia Commons.
 *
 * Commons is used rather than an aggregator because its API returns the licence
 * and the attribution in the same response as the image, so nothing ships whose
 * terms we cannot state. (Openverse sits behind a bot challenge from here.)
 *
 * Writes <slug>.jpg plus commons.manifest.json into the target directory, which
 * scripts/build-garment-photos.mjs then compresses and credits.
 *
 * Usage: node scripts/fetch-garment-photos.mjs <out-dir>
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/fetch-garment-photos.mjs <out-dir>');
  process.exit(2);
}
mkdirSync(out, { recursive: true });

/** Licences we may publish. Anything else is discarded, including NC and ND. */
const OK_LICENCE = /^(cc0|cc[- ]by([- ]sa)?( \d)?|public domain|pd|pdm)/i;

/** Words that mean the photo is not a usable garment shot. */
const REJECT = /(logo|diagram|map|chart|coat of arms|emblem|flag|seal of|patent|drawing|sketch|painting|portrait|self-portrait|statue|monument|plaque|sign|poster|stamp|banknote|coin|museum interior|exhibition view)/i;

const TARGETS = [
  // Survivors of the contact-sheet review, plus western basics the Indian pack
  // does not cover. Slugs rejected by eye live in scripts/build-garment-photos.mjs
  // with their reasons; re-adding them here would only re-download the junk.
  ['boot-chelsea', ['chelsea boot', 'chelsea boots leather']],
  ['loafer-penny', ['penny loafer', 'loafer shoe leather']],
  ['oxford-captoe', ['oxford shoe cap toe', 'oxford dress shoe']],
  ['derby-plain', ['derby shoe', 'blucher shoe']],
  ['sandal-leather', ['kolhapuri chappal', 'leather sandal handmade']],
  ['slip-on-suede', ['suede slip on shoe', 'espadrille shoe']],
  ['trail-runner', ['trail running shoe', 'hiking boot']],
  ['sneaker-white', ['sneakers white pair', 'tennis shoe pair']],
  ['backpack-daypack', ['backpack rucksack', 'daypack backpack']],
  ['duffle-weekender', ['duffel bag', 'holdall bag travel']],
  ['pashmina-shawl', ['pashmina shawl', 'kashmiri shawl embroidered']],
  ['sunglasses-wayfarer', ['sunglasses wayfarer', 'sunglasses black frame']],
  ['socks-crew', ['socks pair', 'cotton socks']],
  ['necklace-chain', ['silver chain necklace', 'gold chain necklace']],
  ['watch-dress-steel', ['wristwatch steel bracelet', 'wristwatch']],
  ['camisole-silk', ['camisole', 'silk camisole top']],
  ['gilet-quilted', ['quilted gilet', 'body warmer vest']],
  ['waistcoat', ['waistcoat', 'vest formal wear']],
  ['leggings-yoga', ['leggings', 'yoga pants']],
  ['suit-jacket', ['suit jacket', 'mens suit grey']],
  ['bangles-stack', ['bangles glass', 'indian bangles']],
  ['earring-jhumka', ['jhumka earrings', 'indian earrings silver']],
  ['tote-canvas', ['canvas tote bag', 'shopping bag cloth']],
  ['belt-leather', ['leather belt', 'belt buckle leather']],
  ['beanie-rib', ['knit hat wool', 'tuque', 'watch cap']],
  ['tie-necktie', ['necktie', 'tie silk single']],
  ['trench-coat', ['trench coat MET', 'raincoat gabardine', 'trenchcoat']],
  ['overcoat-wool', ['overcoat wool', 'winter coat wool']],
  ['hoodie-oversized', ['hoodie sweatshirt', 'hooded sweatshirt']],
  ['polo-pique', ['polo shirt', 'pique polo']],
  ['cargo-pants', ['cargo pants', 'cargo trousers']],
  ['dress-wrap', ['wrap dress', 'summer dress']],

  // Culled by eye from this pack's first run, with reasons — do not re-add:
  //   breeches-period (a drawing of a breeches BUOY — a sea-rescue device),
  //   jeogori/durumagi/gomusin (people, dolls, or the garment not visible),
  //   blouse-mx / wrapper / gele (identifiable people as the subject),
  //   smock (lab coats — the wrong garment; the flat beats a wrong photo),
  //   apron / chefs-jacket / track-pants / hat-panama (the garment incidental).
  // THE PERIOD PACK, for the five briefed wardrobes. Commons carries the
  // public-domain museum costume photography these garments actually live in —
  // Met Open Access, Rijksmuseum, LACMA — so an 18th-century coat can wear a
  // photograph of an 18th-century coat rather than falling back to the flat.
  ['coat-justaucorps', ['coat MET 18th century', 'suit coat silk MET', 'justaucorps']],
  ['waistcoat-embroidered', ['waistcoat 1780', 'vest MET silk', 'gilet brode']],
  ['tricorne-hat', ['tricorne', 'cocked hat MET', 'hat 18th century beaver']],
  ['banyan-robe', ['banyan MET', 'japonse rok', 'banyan chintz']],
  ['buckle-shoe', ['shoe buckle 18th century', 'buckled shoes 18th century leather']],
  ['sword-smallsword', ['smallsword hilt 18th century', 'small sword dress']],
  ['chima-hanbok', ['chima hanbok skirt', 'hanbok skirt']],
  ['binyeo-hairpin', ['binyeo hairpin', 'korean traditional hairpin', 'hairpin joseon']],
  ['bojagi-cloth', ['furoshiki', 'wrapping cloth textile', 'patchwork textile asia']],
  ['geta-clogs', ['geta sandals pair', 'geta footwear japan', 'japanese clogs wood']],
  ['monpe-trousers', ['monpe trousers', 'japanese farm clothing woman', 'work trousers japan']],
  ['rebozo-shawl', ['rebozo', 'mexican shawl woven']],
  ['coral-beads', ['coral bead necklace', 'coral beads african']],
  ['clogs-kitchen', ['clogs pair wooden', 'klompen', 'garden clogs']],
];

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = { 'User-Agent': 'toile-wardrobe-demo/1.0 (local POC; contact via repo)' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Commons rate-limits a tight loop into empty bodies. Throttle, and retry once. */
async function getJson(url, attempt = 0) {
  await sleep(350);
  try {
    const res = await fetch(url, { headers: UA });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (err) {
    if (attempt < 2) {
      await sleep(1200 * (attempt + 1));
      return getJson(url, attempt + 1);
    }
    return null;
  }
}

async function search(term) {
  const url =
    `${API}?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}` +
    `&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=900&format=json&origin=*`;
  const json = await getJson(url);
  return Object.values(json?.query?.pages ?? {});
}

function candidates(pages) {
  const found = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.thumburl) continue;
    if (REJECT.test(page.title)) continue;
    if (!/\.(jpe?g|png)$/i.test(page.title)) continue;
    const meta = info.extmetadata ?? {};
    const licence = (meta.LicenseShortName?.value ?? '').replace(/<[^>]+>/g, '').trim();
    if (!OK_LICENCE.test(licence)) continue;
    // Portrait or square reads better in a 4:5 tile than a wide landscape.
    if (info.thumbwidth && info.thumbheight && info.thumbwidth / info.thumbheight > 1.8) continue;
    const artist = (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || null;
    found.push({
      title: page.title,
      image_url: info.thumburl,
      license: licence,
      attribution: artist,
      landing_url: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    });
  }
  return found;
}

// The manifest MERGES across runs. It used to be rewritten each pass, which
// silently stripped the licence from everything downloaded earlier — and the
// builder drops any photo it cannot attribute, so those files would vanish.
const manifestPath = join(out, 'commons.manifest.json');
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : [];
const recorded = new Set(manifest.map(m => m.slug));
let filled = 0;
for (const [slug, terms] of TARGETS) {
  const dest = join(out, `${slug}.jpg`);
  // Keep a file only when its licence is on record beside it; otherwise refetch
  // so the image and the terms it ships under are guaranteed to be the same pick.
  if (existsSync(dest) && statSync(dest).size > 8192 && recorded.has(slug)) {
    console.log(`have  ${slug}`);
    continue;
  }
  // EVERY candidate from every term, not the first that looked right. The
  // first pick's download failing used to fail the whole slug, while the
  // second candidate — often a museum object photo — sat unexamined.
  let list = [];
  for (const term of terms) {
    try {
      list = list.concat(candidates(await search(term)));
    } catch { /* next term */ }
  }
  let done = false;
  for (const chosen of list.slice(0, 6)) {
    try {
      // A sub-8KB body is Commons rate-limiting us with an error page, not a
      // photograph. Back off once before giving up on the candidate.
      let buf = null;
      for (let go = 0; go < 2 && !buf; go++) {
        await sleep(600 + go * 1500);
        const res = await fetch(chosen.image_url, { headers: UA });
        const got = Buffer.from(await res.arrayBuffer());
        if (got.length >= 8192) buf = got;
      }
      if (!buf) throw new Error('too small');
      writeFileSync(dest, buf);
      const at = manifest.findIndex(m => m.slug === slug);
      if (at >= 0) manifest[at] = { slug, ...chosen };
      else manifest.push({ slug, ...chosen });
      recorded.add(slug);
      filled += 1;
      console.log(`ok    ${slug}  ${chosen.license}  ${(buf.length / 1024).toFixed(0)}KB  ${chosen.title.slice(0, 46)}`);
      done = true;
      break;
    } catch { /* try the next candidate */ }
  }
  if (!done) console.log(`MISS  ${slug}`);
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`\nFilled ${filled} of ${TARGETS.length}.`);
