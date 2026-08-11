// Functional smoke test: drives the real app in a browser and asserts the core
// loops work end to end. Usage: node smoke.mjs <baseUrl>
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://localhost:4173/';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', '-', name, detail ? `(${detail})` : '');
};

const day = (offset) => {
  const d = new Date(Date.now() + offset * 86400000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const swatch = (bg, label) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="${bg}"/><text x="150" y="210" font-family="sans-serif" font-size="26" fill="#fff" text-anchor="middle">${label}</text></svg>`
  );

// Seed includes a v1-shaped payload on purpose: migration must absorb it.
const legacySeed = {
  items: [
    { id: 'i0', name: 'White Oxford Shirt', category: 'tops', color: '#f5f0eb', season: ['spring'], occasion: ['work'], imageUrl: swatch('#c9bfae', 'Oxford'), dateAdded: '2026-03-01', wearCount: 14, cost: 68, favorite: true, laundryStatus: 'clean' },
    { id: 'i1', name: 'Navy Crewneck', category: 'tops', color: '#2c3a54', season: ['fall'], occasion: ['casual'], imageUrl: swatch('#2c3a54', 'Navy'), dateAdded: '2026-03-04', wearCount: 9, cost: 45, favorite: false, laundryStatus: 'clean' },
    { id: 'i2', name: 'Indigo Tee', category: 'tops', color: '#31415e', season: ['summer'], occasion: ['casual'], imageUrl: '', dateAdded: '2026-03-06', wearCount: 0, cost: 30, favorite: false, laundryStatus: 'clean' },
    { id: 'i3', name: 'Raw Denim Jeans', category: 'bottoms', color: '#31415e', season: ['fall'], occasion: ['casual'], imageUrl: swatch('#25324a', 'Denim'), dateAdded: '2026-03-08', wearCount: 22, cost: 120, favorite: true, laundryStatus: 'clean' },
    { id: 'i4', name: 'Wool Overcoat', category: 'outerwear', color: '#3d3d3d', season: ['winter'], occasion: ['work'], imageUrl: swatch('#2a2a2a', 'Coat'), dateAdded: '2026-03-10', wearCount: 11, cost: 240, favorite: true, laundryStatus: 'clean' },
    { id: 'i5', name: 'White Sneakers', category: 'shoes', color: '#ffffff', season: ['spring'], occasion: ['casual'], imageUrl: swatch('#d8d2c8', 'Sneaker'), dateAdded: '2026-03-12', wearCount: 31, cost: 95, favorite: true, laundryStatus: 'clean' },
    { id: 'i6', name: 'Torn Chore Jacket', category: 'outerwear', color: '#5a7a6e', season: ['fall'], occasion: ['casual'], imageUrl: swatch('#48645a', 'Chore'), dateAdded: '2026-03-14', wearCount: 0, cost: 88, favorite: false, laundryStatus: 'clean' },
  ],
  outfits: [
    { id: 'o0', name: 'Monday Uniform', itemIds: ['i0', 'i3', 'i5'], favorite: true, dateCreated: '2026-04-01', wearCount: 7, lastWorn: day(-3) },
    { id: 'o1', name: 'Cold Snap', itemIds: ['i1', 'i4', 'i5'], favorite: true, dateCreated: '2026-04-05', wearCount: 3, lastWorn: day(-12) },
  ],
  wearLogs: [
    { id: 'l0', date: day(-3), itemIds: ['i0', 'i3', 'i5'], outfitId: 'o0' },
    { id: 'l1', date: day(-12), itemIds: ['i1', 'i4', 'i5'], outfitId: 'o1' },
  ],
  // v1 shape: boolean `purchased`, no status, no settings block, no schemaVersion
  wishlist: [
    { id: 'w0', name: 'Camel Cardigan', category: 'tops', color: '#d4a574', brand: 'Everlane', price: 88, priority: 'high', dateAdded: day(-5), purchased: false },
  ],
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// Fonts are external; in a sandboxed network they can hang forever.
await page.route('**://fonts.googleapis.com/**', r => r.abort());
await page.route('**://fonts.gstatic.com/**', r => r.abort());
await page.route('**://api.fontshare.com/**', r => r.abort());

const consoleErrors = [];
const isFontNoise = t => /ERR_FAILED|net::|fonts\.(googleapis|gstatic)|fontshare/i.test(t);
page.on('console', m => { if (m.type() === 'error' && !isFontNoise(m.text())) consoleErrors.push(m.text()); });
page.on('pageerror', e => { if (!isFontNoise(e.message)) consoleErrors.push('pageerror: ' + e.message); });

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await page.evaluate(s => localStorage.setItem('wardrobe-tracker', JSON.stringify(s)), legacySeed);
await page.reload({ waitUntil: 'domcontentloaded' });
const goRoute = async (r) => {
  await page.goto(`${baseUrl}#${r}`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
};

const routes = ['/', '/closet', '/outfits', '/calendar', '/ledger', '/wishlist', '/compare', '/settings'];
for (const r of routes) {
  consoleErrors.length = 0;
  await goRoute(r);
  await page.waitForTimeout(600);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const rendered = bodyText.trim().length > 40;
  check(`route ${r} renders`, rendered, rendered ? '' : 'empty body');
  check(`route ${r} no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
}

// Migration absorbed the v1 payload
await page.goto(`${baseUrl}#/`, { waitUntil: 'domcontentloaded' });
await goRoute('/closet');
await page.waitForTimeout(700);
const closetText = await page.evaluate(() => document.body.innerText);
check('v1 data renders after migration', /White Oxford Shirt/.test(closetText));
check('v1 categories survive', /Tops/i.test(closetText));
await goRoute('/wishlist');
await page.waitForTimeout(700);
const wishText = await page.evaluate(() => document.body.innerText);
check('v1 wishlist item survives', /Camel Cardigan/.test(wishText));

// No emoji leaked into the UI anywhere
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
for (const r of routes) {
  await goRoute(r);
  await page.waitForTimeout(300);
  const text = await page.evaluate(() => document.body.innerText);
  const found = text.match(emojiRe);
  check(`route ${r} emoji-free`, !found, found ? `found ${found[0]}` : '');
}

// Every image has alt text; every button has an accessible name
await goRoute('/closet');
await page.waitForTimeout(500);
const a11y = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')];
  const badImgs = imgs.filter(i => !i.getAttribute('alt') && i.getAttribute('alt') !== '').length;
  const btns = [...document.querySelectorAll('button')];
  const badBtns = btns.filter(b => !(b.innerText.trim() || b.getAttribute('aria-label') || b.getAttribute('title'))).length;
  const small = btns.filter(b => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44);
  }).map(b => `${(b.getAttribute('aria-label') || b.innerText.trim() || '?').slice(0, 24)}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
  return { badImgs, badBtns, totalBtns: btns.length, small };
});
check('all images have alt', a11y.badImgs === 0, `${a11y.badImgs} missing`);
check('all buttons have names', a11y.badBtns === 0, `${a11y.badBtns} unnamed of ${a11y.totalBtns}`);
check('touch targets >= 44px', a11y.small.length === 0, a11y.small.slice(0, 4).join(', '));

// Before You Buy surfaces owned similar pieces (the flagship feature)
await goRoute('/compare');
await page.waitForTimeout(600);
const compareText = await page.evaluate(() => document.body.innerText);
check('compare page has a colour control', /colou?r/i.test(compareText));
const hasCommerce = /\b(shop|buy now|affiliate|retailer|price compare)\b/i.test(compareText);
check('compare page has no commerce language', !hasCommerce);

// Dark mode renders with real tokens (not transparent/black default)
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await page.waitForTimeout(300);
const darkBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim());
check('dark theme token applies', darkBg.toLowerCase() === '#17140f', `got ${darkBg}`);
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

// Empty state renders rather than a broken screen
await page.evaluate(() => localStorage.removeItem('wardrobe-tracker'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);
const emptyText = await page.evaluate(() => document.body.innerText);
check('empty state renders content', emptyText.trim().length > 30);
const emptySvgs = await page.evaluate(() => document.querySelectorAll('svg').length);
check('empty state draws artwork', emptySvgs > 2, `${emptySvgs} svgs`);

await browser.close();

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('\nFAILURES:');
  failed.forEach(f => console.log(' -', f.name, f.detail ? `(${f.detail})` : ''));
}
process.exit(failed.length ? 1 : 0);
