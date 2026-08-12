// Builds the three closet fill-states a real product meets:
//
//   starting — the cold start: four pieces, one outfit, three wears, no costs
//              on half, one photo missing. The first-week experience.
//   average  — the honest middle, sized from the market research: an app user
//              who catalogued ~34 pieces (not their whole closet), ~40% without
//              photos, sparse costs, eight weeks of gappy logs, four outfits,
//              one wishlist entry mid-cooling-off. Most users live here.
//   (complete = the shipped personas; not built here.)
//
// Prints JSON states keyed by name; the snapshot harness seeds localStorage
// with them. Deterministic — same fixture every run.
import { writeFileSync } from 'node:fs';

const today = new Date();
const D = n => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function rand(...parts) {
  const s = parts.join('|');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let t = (h >>> 0) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const photo = slug => `wardrobe/garment/${slug}.webp`;
const brand = slug => `wardrobe/brand/${slug}.webp`;

/* ---------- starting: week one ---------- */

const startingItems = [
  { id: 's1', name: 'White poplin shirt', category: 'tops', color: '#F4F0E8', cost: 45, imageUrl: brand('hm-shirt'), season: ['spring','summer','fall','winter'], occasion: ['work'] },
  { id: 's2', name: 'Dark straight jeans', category: 'bottoms', color: '#2E3440', cost: 80, imageUrl: brand('gap-jeans'), season: ['spring','summer','fall','winter'], occasion: ['casual'] },
  { id: 's3', name: 'Grey crewneck', category: 'tops', color: '#8A8578', imageUrl: '', season: ['fall','winter'], occasion: ['casual'] },
  { id: 's4', name: 'White sneakers', category: 'shoes', color: '#EDEAE2', cost: 90, imageUrl: photo('sneaker-white'), season: ['spring','summer','fall','winter'], occasion: ['casual'] },
].map(i => ({ ...i, wearCount: 0, favorite: false, laundryStatus: 'clean', dateAdded: D(-6) }));

const startingLogs = [
  { id: 'sl1', date: D(-4), itemIds: ['s1', 's2', 's4'] },
  { id: 'sl2', date: D(-2), itemIds: ['s3', 's2', 's4'] },
  { id: 'sl3', date: D(0), itemIds: ['s1', 's2'] },
];

/* ---------- average: the honest middle ---------- */

const AVG = [
  ['tops', ['Striped tee', 'Black tee', 'Linen shirt', 'Blue oxford', 'Silk blouse', 'Grey henley', 'Navy polo', 'Cream knit']],
  ['bottoms', ['Dark jeans', 'Beige chinos', 'Black trousers', 'Denim shorts', 'Wool skirt']],
  ['dresses', ['Navy wrap dress', 'Summer midi']],
  ['outerwear', ['Rain shell', 'Wool overcoat', 'Denim jacket']],
  ['layers', ['Grey hoodie', 'Black cardigan', 'Quilted gilet']],
  ['shoes', ['White sneakers', 'Chelsea boots', 'Loafers', 'Running shoes']],
  ['accessories', ['Leather belt', 'Canvas tote', 'Wool scarf', 'Sunglasses', 'Crew socks']],
  ['jewellery', ['Steel watch', 'Silver chain']],
];
// Every path below is a file that exists in public/ — the first snapshot run
// shipped slugs that don't, and the closet rendered alt-text where photographs
// should be. A fixture with broken images tests nothing but the 404 page.
const AVG_PHOTOS = {
  'Striped tee': brand('uniqlo-t-shirt'), 'Black tee': brand('levis-t-shirt'),
  'Linen shirt': brand('hm-shirt'), 'Blue oxford': brand('mango-shirt'),
  'Silk blouse': brand('zara-blouse'), 'Cream knit': brand('hm-sweater'),
  'Dark jeans': brand('levis-denim-jeans'), 'Beige chinos': brand('hm-chinos'),
  'Black trousers': brand('zara-trousers'), 'Navy wrap dress': brand('mango-dress'),
  'Rain shell': photo('gilet-quilted'), 'Denim jacket': brand('levis-trucker-jacket'),
  'Grey hoodie': brand('uniqlo-hoodie'), 'Quilted gilet': photo('gilet-quilted'),
  'White sneakers': photo('sneaker-white'), 'Chelsea boots': photo('boot-chelsea'),
  'Loafers': photo('loafer-penny'), 'Running shoes': photo('trail-runner'),
  'Leather belt': photo('belt-leather'), 'Wool scarf': photo('pashmina-shawl'),
  'Sunglasses': photo('sunglasses-wayfarer'), 'Steel watch': photo('watch-dress-steel'),
  'Silver chain': photo('necklace-chain'),
};
const COLORS = ['#2E3440', '#8A8578', '#F4F0E8', '#5C6B73', '#7A5C43', '#33415C', '#D9CBB8', '#1F1F1F'];

let ai = 0;
const avgItems = [];
for (const [category, names] of AVG) {
  for (const name of names) {
    const n = ai++;
    avgItems.push({
      id: `a${n}`,
      name,
      category,
      color: COLORS[Math.floor(rand('c', n) * COLORS.length)],
      // ~55% carry a cost — most people remember some prices, not all.
      cost: rand('cost', n) < 0.55 ? Math.round(15 + rand('amt', n) * 120) : undefined,
      // ~60% have a photo. The rest render as drawn flats: the honest state
      // of a catalogue that took one Saturday, not three.
      imageUrl: rand('ph', n) < 0.62 && AVG_PHOTOS[name] ? AVG_PHOTOS[name] : '',
      season: rand('sea', n) < 0.5 ? ['spring','summer','fall','winter'] : ['fall','winter'],
      occasion: rand('occ', n) < 0.5 ? ['casual'] : ['work'],
      wearCount: 0,
      favorite: rand('fav', n) < 0.12,
      laundryStatus: 'clean',
      dateAdded: D(-56 - Math.floor(rand('add', n) * 30)),
    });
  }
}

const avgOutfits = [
  { id: 'ao1', name: 'Office default', itemIds: ['a3', 'a10', 'a22'], occasion: 'work' },
  { id: 'ao2', name: 'Weekend errands', itemIds: ['a0', 'a8', 'a20'], occasion: 'casual' },
  { id: 'ao3', name: 'Dinner out', itemIds: ['a4', 'a10', 'a23'], occasion: 'party' },
  { id: 'ao4', name: 'Rainy commute', itemIds: ['a15', 'a8', 'a21'], occasion: 'work' },
].map(o => ({ ...o, favorite: false, dateCreated: D(-50), wearCount: 0 }));

// Eight weeks of gappy logs — about four a week, weighted to the same pieces
// the way real rotation is.
const avgLogs = [];
let li = 0;
for (let day = -56; day <= 0; day++) {
  if (rand('log', day) > 0.55) continue;
  const outfit = rand('mode', day) < 0.35 ? avgOutfits[Math.floor(rand('which', day) * avgOutfits.length)] : null;
  if (outfit) {
    avgLogs.push({ id: `al${li++}`, date: D(day), itemIds: [...outfit.itemIds], outfitId: outfit.id });
  } else {
    const top = `a${Math.floor(rand('t', day) * 8)}`;
    const bottom = `a${8 + Math.floor(rand('b', day) * 5)}`;
    // Shoes are a21–a24; a20 is the quilted gilet, which an off-by-one here
    // spent a while logging as footwear (and Running shoes never got worn).
    const shoe = `a${21 + Math.floor(rand('s', day) * 4)}`;
    avgLogs.push({ id: `al${li++}`, date: D(day), itemIds: [top, bottom, shoe] });
  }
}

const wishlist = [{
  id: 'w1', name: 'Camel wool coat', category: 'outerwear', color: '#B08B5E',
  priority: 'medium', dateAdded: D(-3),
  coolingOff: { endsAt: D(4), asked: false },
}];

// The house rule holds for fixtures too: wearCount and lastWorn are DERIVED
// from the logs, never asserted beside them. The first cut of this file broke
// it and every piece read "never worn" over 37 log entries.
function derive(items, logs, outfits) {
  const wears = new Map();
  const last = new Map();
  const oWears = new Map();
  const oLast = new Map();
  for (const log of logs) {
    if (log.planned) continue;
    for (const id of log.itemIds) {
      wears.set(id, (wears.get(id) ?? 0) + 1);
      if (!last.get(id) || log.date > last.get(id)) last.set(id, log.date);
    }
    if (log.outfitId) {
      oWears.set(log.outfitId, (oWears.get(log.outfitId) ?? 0) + 1);
      if (!oLast.get(log.outfitId) || log.date > oLast.get(log.outfitId)) oLast.set(log.outfitId, log.date);
    }
  }
  for (const i of items) {
    i.wearCount = wears.get(i.id) ?? 0;
    if (last.get(i.id)) i.lastWorn = last.get(i.id);
  }
  for (const o of outfits) {
    o.wearCount = oWears.get(o.id) ?? 0;
    if (oLast.get(o.id)) o.lastWorn = oLast.get(o.id);
  }
}
derive(startingItems, startingLogs, []);
derive(avgItems, avgLogs, avgOutfits);

const states = {
  starting: {
    schemaVersion: 5,
    items: startingItems, outfits: [], wearLogs: startingLogs, wishlist: [], events: [],
  },
  average: {
    schemaVersion: 5,
    items: avgItems, outfits: avgOutfits, wearLogs: avgLogs, wishlist, events: [],
  },
};

writeFileSync(new URL('./fill-states.json', import.meta.url), JSON.stringify(states));
console.log('starting:', startingItems.length, 'pieces,', startingLogs.length, 'logs');
console.log('average:', avgItems.length, 'pieces,', avgLogs.length, 'logs,', avgOutfits.length, 'outfits');
