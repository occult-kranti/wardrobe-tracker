#!/usr/bin/env node
/**
 * THE SHOWING, STRESSED — the Explore mosaic (docs/41) hunted in a real
 * browser, at the counts and widths where polite testing stops looking.
 *
 * The house pattern (test-features.mjs): playwright against the built dist on
 * http://localhost:4174, PASS/FAIL lines, exit 1 on any red. Each scenario
 * seeds localStorage the way the app itself reads it — registry, session,
 * community — in a fresh context, so no scenario can lean on another's state
 * and none touches the sample wardrobes the other suites use.
 *
 * The oracle is the real arithmetic: src/lib/showing.ts and
 * src/lib/bufferFeed.ts are esbuild-bundled and imported here, so every
 * rendered wall is compared tile-for-tile (identity, not just counts) against
 * interleaveCommons → backwardSwap → variantFor run on the same inputs. The
 * library's own truth is pinned independently in scripts/test-feed.mjs §(j);
 * this suite proves the PAGE deals what the arithmetic says.
 *
 * Usage: node scripts/test-explore-stress.mjs [origin]
 */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const ORIGIN = process.argv[2] ?? 'http://localhost:4174';

/* --------------------------- the flag comes first ---------------------------

   THIS WHOLE SUITE IS THE LOOK BOOK'S. Every scenario below opens /#/explore
   and compares the wall it deals against the arithmetic. With FEED_ENABLED
   false that address answers with Today, so there is no wall — and a suite
   that went quietly green against a page it never reached would be worse than
   one that does not run at all.

   Nothing here is deleted and no check is relaxed. The run announces itself,
   names the flag, and stops with a clean exit; the flag-off truths this suite
   would otherwise cover are asserted elsewhere — scripts/test-flows.mjs (the
   address lands on Today, no door in the shell points at it) and
   scripts/test-routes.mjs (known() refuses it, so safeNext will not remember
   it through the door).

   The flag is read from the module the app itself compiles against, so the
   branch feed-showcase flips one line and this file runs again, untouched. */
const flagDir = mkdtempSync(join(tmpdir(), 'explore-flags-'));
await build({
  alias: sharedAliases(),
  entryPoints: [fileURLToPath(new URL('../packages/shared/flags.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  outfile: join(flagDir, 'flags.mjs'),
  logLevel: 'error',
});
const { FEED_ENABLED } = await import(pathToFileURL(join(flagDir, 'flags.mjs')).href);
if (!FEED_ENABLED) {
  console.log('SKIP - THE SHOWING, STRESSED is not run on this branch.');
  console.log('       FEED_ENABLED is false in packages/shared/flags.ts, so Explore is hidden:');
  console.log('       /#/explore answers with Today and there is no wall to stress.');
  console.log('       The flag-off truths are asserted in scripts/test-flows.mjs and');
  console.log('       scripts/test-routes.mjs. Branch feed-showcase flips the one line and');
  console.log('       this suite runs again, unchanged.');
  process.exit(0);
}

/* ------------------------------ the oracle ------------------------------ */

const dir = mkdtempSync(join(tmpdir(), 'explore-stress-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    showing: fileURLToPath(new URL('../src/lib/showing.ts', import.meta.url)),
    bufferFeed: fileURLToPath(new URL('../src/lib/bufferFeed.ts', import.meta.url)),
  },
  bundle: true,
  format: 'esm',
  outdir: dir,
  logLevel: 'error',
});
const showing = await import(pathToFileURL(join(dir, 'showing.js')).href);
const buffer = await import(pathToFileURL(join(dir, 'bufferFeed.js')).href);
const {
  variantFor, bandUnit, backwardSwap, seamsFor, monthKey,
  HEM_LINE, HEM_LINE_FILTERED,
} = showing;
const { BUFFER_FEED, interleaveCommons } = buffer;

let failed = 0;
const redLines = [];
const check = (label, ok, detail = '') => {
  console.log(ok ? 'PASS' : 'FAIL', '-', label, detail ? `(${detail})` : '');
  if (!ok) {
    failed++;
    redLines.push(`${label}${detail ? ` — ${detail}` : ''}`);
  }
};

/* ------------------------------ fixtures ------------------------------ */

const pad = n => String(n).padStart(2, '0');
const fmtD = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtAt = d =>
  `${fmtD(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
/** The date seed the page hands interleaveCommons: today, local. */
const today = fmtD(new Date());

const AUTHOR_A = {
  id: 'w-stress-a', name: 'Asha Verma', handle: '@asha', monogram: 'AV',
  color: '#8A4B3C', createdAt: '2026-01-01',
};
const AUTHOR_B = {
  id: 'w-stress-b', name: 'Bela Nair', handle: '@bela', monogram: 'BN',
  color: '#3C5A8A', createdAt: '2026-01-01', isSample: true,
};

/** n look posts, newest first (descending `at`), one month, one author. */
function makeWall(n, { base = new Date('2026-07-28T22:00:00'), stepMin = 2, author = AUTHOR_A.id, mutate } = {}) {
  const posts = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(base.getTime() - i * stepMin * 60000);
    posts.push({
      id: `sp-${i}`, authorId: author, date: fmtD(d), at: fmtAt(d),
      scope: { kind: 'everyone' },
      look: { outfitId: `o-${i}`, name: `Look ${i}`, pieces: [] },
    });
  }
  mutate?.(posts);
  return posts;
}

const seedFor = (posts, accounts = [AUTHOR_A]) => ({
  accounts,
  activeId: AUTHOR_A.id,
  community: {
    posts, conversations: [], messages: [], households: [], passes: [],
    removedPostIds: [], savedPostIds: [],
  },
});

/* --------------------------- the oracle's deal --------------------------- */

/** What the page must deal: ids in order, guest flags, variants, seams. */
function expectedDeal(posts, cols, { guests = BUFFER_FEED } = {}) {
  const laid = interleaveCommons(posts.map(p => ({ id: p.id, date: p.date })), guests, today);
  const tiles = backwardSwap(laid, t => 'commons' in t, cols);
  const ids = tiles.map(t => ('real' in t ? t.real.id : t.commons.id));
  const guestAt = tiles.map(t => 'commons' in t);
  const variants = tiles.map((_, i) => variantFor(i, tiles.length, cols));
  const months = tiles.map(t => ('real' in t ? monthKey(t.real.date) : null));
  const seams = seamsFor(months, cols);
  return { ids, guestAt, variants, seams, total: tiles.length };
}

/* ------------------------------ the browser ------------------------------ */

const browser = await chromium.launch();
const errors = []; // page errors + console errors, tagged by scenario
let scenario = 'boot';

async function openWall(posts, { width = 390, height = 844, reducedMotion, accounts } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    ...(reducedMotion ? { reducedMotion } : {}),
  });
  const seed = { ...seedFor(posts, accounts), hem: { plain: HEM_LINE, filtered: HEM_LINE_FILTERED } };
  await ctx.addInitScript(s => {
    /* The hem's two sentences travel from src/lib/showing.ts into the page
       context, so no assertion in this file can quietly drift from the one
       the product ships. Counted by splitting, never by a regex: the
       sentences end in a full stop and a regex would need escaping that a
       later editor would get wrong. */
    window.__hem = s.hem;
    window.localStorage.clear();
    window.localStorage.setItem('toile-accounts', JSON.stringify(s.accounts));
    window.localStorage.setItem('toile-session', JSON.stringify({ activeId: s.activeId }));
    window.localStorage.setItem('toile-community', JSON.stringify(s.community));
    for (const a of s.accounts) {
      window.localStorage.setItem(
        `wardrobe-tracker:${a.id}`,
        JSON.stringify({ items: [], outfits: [], wishlist: [], wearLogs: [], events: [] })
      );
    }
    /* The scroll-adjacent ledger (docs/41 §5, §7): the wall is allowed ONE
       named IntersectionObserver and nothing else that listens to the scroll.
       Wrap the two constructors before any app code runs and let the page
       incriminate itself, rather than grepping source and hoping. */
    window.__ioMade = [];
    window.__scrollListeners = [];
    const RealIO = window.IntersectionObserver;
    window.IntersectionObserver = class extends RealIO {
      constructor(...args) { super(...args); window.__ioMade.push(new Error().stack ?? ''); }
    };
    const realAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, ...rest) {
      if (type === 'scroll' || type === 'wheel' || type === 'touchmove') {
        const who = this === window ? 'window' : this === document ? 'document'
          : (this.tagName ?? this.constructor?.name ?? 'node');
        window.__scrollListeners.push(`${type}@${who}`);
      }
      return realAdd.call(this, type, ...rest);
    };
    /* The ledger row, measured word by word (docs/41 §3, §9.13). A span's
       own rect lies about truncation — `overflow: hidden` clips the paint,
       not the box — so the date and the `· sample` suffix are measured with
       a Range over their own characters and compared against the tile's own
       right edge. What is asked is not "did the text exist" but "could the
       reader read it". */
    window.__ledger = i => {
      const li = [...document.querySelectorAll('li[data-variant]')][i];
      const a = li.querySelector('a');
      const block = a.children[a.children.length - 1];
      const row = [...block.querySelectorAll('span')]
        .find(s => getComputedStyle(s).display === 'flex');
      const host = li.getBoundingClientRect();
      const kids = [...row.children];
      const tailEl = kids[kids.length - 1];
      const tagEl = kids.find(k => k.querySelector('svg'));
      const text = (tailEl.textContent ?? '');
      const node = tailEl.firstChild;
      const span = (needle) => {
        const at = text.indexOf(needle);
        if (at < 0 || !node) return null;
        const r = document.createRange();
        r.setStart(node, at);
        r.setEnd(node, at + needle.length);
        const box = r.getBoundingClientRect();
        return { text: needle, right: box.right, width: box.width, inside: box.right <= host.right + 1 };
      };
      const date = (text.match(/\d{1,2}\s+[A-Za-z]{3,}/) ?? [])[0] ?? null;
      const style = getComputedStyle(row);
      return {
        tile: Math.round(host.width),
        rowW: Math.round(row.clientWidth),
        gap: Math.round(parseFloat(style.columnGap || '0')),
        tagW: tagEl ? Math.round(tagEl.getBoundingClientRect().width) : 0,
        tailW: Math.round(tailEl.getBoundingClientRect().width),
        tailText: text.trim(),
        date: date ? span(date) : null,
        sample: /sample/.test(text) ? span('sample') : null,
        leadShrunk: kids.some(k => k !== tagEl && k !== tailEl && k.getBoundingClientRect().width < k.scrollWidth),
      };
    };
  }, seed);
  const page = await ctx.newPage();
  const tag = scenario;
  page.on('pageerror', e => errors.push(`[${tag}] ${String(e).split('\n')[0].slice(0, 140)}`));
  page.on('console', m => {
    if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text().slice(0, 140)}`);
  });
  await page.goto(`${ORIGIN}/#/explore`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1', { hasText: 'Explore' }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

/** Everything the wall says about itself, in one read. */
const readWall = page => page.evaluate(() => {
  const anyTile = document.querySelector('li[data-variant]');
  const ul = anyTile ? anyTile.closest('ul') : null;
  const lis = ul ? [...ul.children].filter(el => el.tagName === 'LI') : [];
  const rows = lis.map(li => {
    const sep = li.getAttribute('role') === 'separator';
    const a = li.querySelector('a');
    const r = li.getBoundingClientRect();
    const caption = a && a.children.length >= 2 ? a.children[a.children.length - 1] : null;
    return {
      sep,
      label: sep ? li.getAttribute('aria-label') : null,
      variant: li.dataset.variant ?? null,
      guest: !!a && /from the commons, a sample$/.test(a.getAttribute('aria-label') ?? ''),
      href: a ? a.getAttribute('href') : null,
      x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height,
      captionH: caption ? Math.round(caption.getBoundingClientRect().height) : null,
      tagSvg: caption ? caption.querySelectorAll('svg').length : 0,
      fade: li.classList.contains('showing-fade'),
      shown: li.classList.contains('is-shown'),
      opacity: getComputedStyle(li).opacity,
    };
  });
  const style = ul ? getComputedStyle(ul) : null;
  const text = document.body.innerText;
  const hemPlain = text.split(window.__hem.plain).length - 1;
  const hemFiltered = text.split(window.__hem.filtered).length - 1;
  const hemP = [...document.querySelectorAll('p')]
    .find(p => (p.textContent ?? '').includes(window.__hem.plain) ||
      (p.textContent ?? '').includes(window.__hem.filtered));
  const hemR = hemP ? hemP.getBoundingClientRect() : null;
  const meta = document.querySelector('header .type-ledger');
  return {
    rows,
    display: style ? style.display : null,
    gridCols: style && style.display === 'grid' ? style.gridTemplateColumns.split(' ').length : null,
    ulX: ul ? ul.getBoundingClientRect().x + window.scrollX : null,
    ulW: ul ? ul.getBoundingClientRect().width : null,
    hemPlain, hemFiltered,
    hemTop: hemR ? hemR.y + window.scrollY : null,
    masthead: meta ? meta.textContent : null,
    bodyText: text.slice(0, 3000),
    hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
});

const tiles = wall => wall.rows.filter(r => !r.sep);
const seps = wall => wall.rows.filter(r => r.sep);

/** The wall against the arithmetic, tile for tile — as a verdict object, so
 *  the red-proofs at the foot of this file can ask the very same predicates
 *  about a deliberately broken page instead of a paraphrase of them. */
function dealVerdict(wall, exp) {
  const t = tiles(wall);
  return {
    countOk: t.length === exp.total,
    count: t.length,
    idsOk: t.every((r, i) => r.href === `#/explore/${exp.ids[i]}`),
    idsDrift: t.findIndex((r, i) => r.href !== `#/explore/${exp.ids[i]}`),
    varOk: t.every((r, i) => r.variant === exp.variants[i]),
    varDrift: t.findIndex((r, i) => r.variant !== exp.variants[i]),
    guestOk: t.every((r, i) => r.guest === exp.guestAt[i]),
    turnOk: t.every(r => !(r.guest && r.variant !== 'rack')),
    turnDrift: t.findIndex(r => r.guest && r.variant !== 'rack'),
  };
}

function compareDeal(name, wall, exp) {
  const v = dealVerdict(wall, exp);
  check(`${name}: tile count ${exp.total}`, v.countOk, `got ${v.count}`);
  check(`${name}: DOM order is the deal's order, identity included`, v.idsOk,
    v.idsOk ? '' : `first drift at ${v.idsDrift}`);
  check(`${name}: every data-variant matches variantFor(i, total, cols)`, v.varOk,
    v.varOk ? '' : `first drift at ${v.varDrift}`);
  check(`${name}: guests sit exactly where the swap left them`, v.guestOk, '');
  check(`${name}: no guest ever holds the turn`, v.turnOk,
    v.turnOk ? '' : `guest turn at ${v.turnDrift}`);
}

/** No hole above the final row: every earlier row band is fully covered. */
function holeCheck(name, wall, cols, gap = 12) {
  const t = tiles(wall);
  if (t.length === 0) return;
  const tol = 6;
  const topsRaw = [...t.map(r => r.y)].sort((a, b) => a - b);
  const bands = [];
  for (const y of topsRaw) {
    if (!bands.length || y - bands[bands.length - 1] > tol) bands.push(y);
  }
  const maxBottom = Math.max(...t.map(r => r.y + r.h));
  bands.push(maxBottom + 1);
  const fullW = wall.ulW - 1;
  let hole = null;
  for (let k = 0; k < bands.length - 2; k++) { // every band except the last
    const [a, b] = [bands[k], bands[k + 1]];
    const covered = t
      .filter(r => r.y < b - tol && r.y + r.h > a + tol)
      .reduce((s, r) => s + r.w, 0);
    if (covered < fullW - (cols - 1) * gap - 8) hole = `band ${k}: ${Math.round(covered)}px of ${Math.round(fullW)}px`;
  }
  check(`${name}: no hole above the final row`, hole === null, hole ?? '');
  check(`${name}: the hem sits below the last tile, never over it`,
    wall.hemTop !== null && wall.hemTop >= maxBottom - 2,
    `hem ${Math.round(wall.hemTop ?? -1)} vs bottom ${Math.round(maxBottom)}`);
}

const hemVerdict = (wall, filtered) =>
  filtered
    ? wall.hemPlain === 0 && wall.hemFiltered === 1
    : wall.hemPlain === 1 && wall.hemFiltered === 0;

function hemOnce(name, wall, { filtered = false } = {}) {
  check(`${name}: the hem speaks once — ${filtered ? 'the filtered sentence' : 'the plain sentence'}`,
    hemVerdict(wall, filtered), `plain ${wall.hemPlain}, filtered ${wall.hemFiltered}`);
}

/* ======================= 1. the counts of record ======================= */
/* 0, 1, 3, 9, 150, 500 — plus 5 (the promised threshold) and 12 (the
   acceptance still). Identity against the oracle at two widths each where
   the deal differs. */

scenario = 'count-0';
{
  const { ctx, page } = await openWall([], { width: 390 });
  const wall = await readWall(page);
  check('0 tiles: the existing EmptyState stands verbatim',
    /Nothing is on show yet\./.test(wall.bodyText) && tiles(wall).length === 0, '');
  check('0 tiles: no hem — the empty state is the whole page',
    wall.hemPlain === 0 && wall.hemFiltered === 0, '');
  await ctx.close();
}

for (const n of [1, 3]) {
  scenario = `count-${n}`;
  const posts = makeWall(n);
  const { ctx, page } = await openWall(posts, { width: 320, height: 700 });
  const wall = await readWall(page);
  const t = tiles(wall);
  check(`${n} tile(s): a centred column of full plates, no deal below five`,
    t.length === n && wall.display === 'flex' && t.every(r => r.variant === 'turn'), `display ${wall.display}`);
  /* docs/41 erratum E3 (2026-08-20): §8's literal `100% − 32px` double-inset
     the plate, because the page column already carries the house's 16px
     gutter — 241px in this 320px context against the spec's own predicted
     ≈288px. The parenthetical was the intent; the plate is now
     `min(100%, 400px)` of the column, inset exactly once by the gutter the
     column already wears. */
  const plateW = Math.min(wall.ulW, 400);
  check(`${n} tile(s): plate width is min(100%, 400px) of the column, centred (E3)`,
    t.every(r => Math.abs(r.w - plateW) <= 2) &&
    t.every(r => Math.abs((r.x - wall.ulX) - (wall.ulW - r.w) / 2) <= 2),
    `w ${Math.round(t[0]?.w)} of column ${Math.round(wall.ulW)} — the spec's parenthetical: ≈288 at 320px`);
  check(`${n} tile(s): the plate fills the gutter-inset column — never inset twice`,
    t.every(r => Math.abs(wall.ulW - r.w) <= 2 || r.w === 400), `${Math.round(wall.ulW - t[0]?.w)}px of column`);
  check(`${n} tile(s): real only — never pad a young wall with samples`,
    t.every(r => !r.guest), '');
  hemOnce(`${n} tile(s)`, wall);
  await ctx.close();
}

scenario = 'count-4-desktop';
{
  // Four entries at 1440px: the last count below the lay threshold, where the
  // 400px cap has to bite or a thin wardrobe becomes a billboard.
  const posts = makeWall(4);
  const { ctx, page } = await openWall(posts, { width: 1440, height: 900 });
  const wall = await readWall(page);
  const t = tiles(wall);
  check('4 tiles at 1440px: still the centred column — the lay begins at five, not four',
    t.length === 4 && wall.display === 'flex' && t.every(r => r.variant === 'turn'), `display ${wall.display}`);
  check('4 tiles at 1440px: the 400px cap bites — a gallery wall, never a billboard',
    t.every(r => Math.abs(r.w - 400) <= 1), `w ${Math.round(t[0]?.w)}`);
  hemOnce('4 tiles at 1440px', wall);
  await ctx.close();
}

scenario = 'count-5';
{
  const posts = makeWall(5);
  for (const [width, cols] of [[320, 2], [800, 3], [1440, 4]]) {
    const { ctx, page } = await openWall(posts, { width, height: 900 });
    const wall = await readWall(page);
    const exp = expectedDeal(posts, cols);
    check(`5 tiles at ${width}px: the lay begins — a dealt grid of ${cols} columns`,
      wall.display === 'grid' && wall.gridCols === cols, `display ${wall.display}, cols ${wall.gridCols}`);
    compareDeal(`5 tiles at ${width}px`, wall, exp);
    holeCheck(`5 tiles at ${width}px`, wall, cols);
    hemOnce(`5 tiles at ${width}px`, wall);
    await ctx.close();
  }
}

scenario = 'count-9';
{
  const posts = makeWall(9);
  for (const [width, cols] of [[320, 2], [1440, 4]]) {
    const { ctx, page } = await openWall(posts, { width, height: 900 });
    const wall = await readWall(page);
    compareDeal(`9 tiles at ${width}px`, wall, expectedDeal(posts, cols));
    holeCheck(`9 tiles at ${width}px`, wall, cols);
    hemOnce(`9 tiles at ${width}px`, wall);
    if (cols === 2) {
      const t = tiles(wall);
      check('9 tiles at 320px: no guest tile is ever full-width',
        t.filter(r => r.guest).every(r => r.w < wall.ulW * 0.75), '');
    }
    await ctx.close();
  }
}

scenario = 'count-12-mirror';
{
  const posts = makeWall(12);
  const { ctx, page } = await openWall(posts, { width: 800, height: 900 });
  const wall = await readWall(page);
  const exp = expectedDeal(posts, 3);
  compareDeal('12 posts at 3 columns', wall, exp);
  const vs = tiles(wall).map(r => r.variant);
  check('12 posts at md: both turn sides visible — the acceptance still',
    vs[0] === 'turn' && vs[7] === 'turn-r', `v0 ${vs[0]}, v7 ${vs[7]}`);
  await ctx.close();
}

/* ================== 2. 150 tiles: fades, re-deal, geometry ================== */

scenario = 'count-150';
{
  const posts = makeWall(150);
  const { ctx, page } = await openWall(posts, { width: 1440, height: 900 });
  let wall = await readWall(page);
  const exp4 = expectedDeal(posts, 4);
  compareDeal('150 posts at 1440px', wall, exp4);
  hemOnce('150 posts at 1440px', wall);
  check('150 posts, one month: zero seams — nobody fixes their absence',
    seps(wall).length === 0 && exp4.seams.length === 0, `${seps(wall).length} seams`);
  check('150 posts, one author: no monogram tag anywhere on the wall',
    tiles(wall).every(r => r.tagSvg === 0), '');
  check('the masthead never counts a guest as a look on show',
    wall.masthead === `${posts.length} on show · ${exp4.guestAt.filter(Boolean).length} guests`,
    wall.masthead ?? 'no masthead meta');

  // The entrance is real in this context (fade class exists), fires once for
  // every tile the reader actually walks past, and never re-fires.
  //
  // The scroll below is a PROCESSION, not a jump. A jump to
  // scrollHeight is the wrong instrument: an IntersectionObserver only ever
  // hears about boxes that cross the viewport, so leaping the middle of a
  // 179-tile wall leaves the tiles you flew over unshown and that is correct
  // behaviour, not a defect. Walk the wall the way a person does and the
  // contract becomes testable: everything passed is shown, nothing passed is
  // left at opacity 0.
  const fadeBefore = await page.evaluate(() => document.querySelectorAll('.showing-fade').length);
  check('the entrance fade machinery is present when motion is allowed', fadeBefore > 0, `${fadeBefore}`);
  const procession = async p => p.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 45));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise(r => setTimeout(r, 200));
  });
  await procession(page);
  await page.waitForTimeout(400);
  const afterScroll = await page.evaluate(() => ({
    faded: document.querySelectorAll('.showing-fade').length,
    shown: document.querySelectorAll('.showing-fade.is-shown').length,
    dim: [...document.querySelectorAll('li[data-variant]')]
      .filter(li => Number(getComputedStyle(li).opacity) < 1).length,
  }));
  check('every tile the reader walks past is shown exactly once, none left dim',
    afterScroll.faded > 0 && afterScroll.shown === afterScroll.faded && afterScroll.dim === 0,
    `${afterScroll.shown} of ${afterScroll.faded} shown, ${afterScroll.dim} dim`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const backAtTop = await page.evaluate(() => ({
    shown: document.querySelectorAll('.showing-fade.is-shown').length,
    faded: document.querySelectorAll('.showing-fade').length,
    opacities: [...document.querySelectorAll('li[data-variant]')].slice(0, 8)
      .map(li => getComputedStyle(li).opacity),
  }));
  check('the fade never re-fires on re-scroll — is-shown persists',
    backAtTop.shown === afterScroll.shown && backAtTop.shown === backAtTop.faded &&
      backAtTop.opacities.every(o => Number(o) === 1),
    `${backAtTop.shown} shown, was ${afterScroll.shown}`);

  /* Nothing FLIPs. The grid seat is the <li>: it is the only box whose
     movement would be the wall rearranging itself, and it is allowed exactly
     one transitioned property, opacity, plus no animation of any kind and no
     scroll-driven timeline. (The <a> inside carries the house's press
     affordance — `.v2 a:active` translate+scale, older than this feature and
     applied on touch, not on scroll — so it is asserted separately: never a
     transition of a box property that could move the seat.) */
  const motion = await page.evaluate(() => {
    const lis = [...document.querySelectorAll('li[data-variant]')].slice(0, 30);
    const seat = lis.map(li => {
      const s = getComputedStyle(li);
      return { tp: s.transitionProperty, an: s.animationName, tl: s.animationTimeline ?? 'auto' };
    });
    const links = lis.map(li => getComputedStyle(li.querySelector('a')).transitionProperty);
    return { seat, links };
  });
  check('the grid seat transitions opacity and nothing else — no FLIP, no scroll timeline',
    motion.seat.length > 0 &&
      motion.seat.every(s => s.tp === 'opacity' && s.an === 'none' && /^(auto|none)$/.test(s.tl)),
    [...new Set(motion.seat.map(s => `${s.tp}|${s.an}|${s.tl}`))].join(' · '));
  check('no tile link transitions a box property that could move its seat',
    motion.links.every(tp => !/\b(width|height|top|left|right|bottom|margin|padding|inset|grid)/.test(tp)),
    [...new Set(motion.links)].join(' · '));

  /* The scroll-adjacent ledger (§7): ONE shared IntersectionObserver for the
     whole wall, and nothing about the wall that scales with its size. The
     shell around it does register listeners of its own — window scroll
     restoration and the chip rail's own drag — and those are not this
     feature's to answer for, so the assertion is differential: a 179-tile
     wall must register exactly what a 5-tile wall registers, no more. A
     per-tile listener, a scroll handler behind a load-more, or a second
     observer per band would all break that equality even though the shell's
     own noise is in both counts. */
  const listening = await page.evaluate(() => ({
    io: window.__ioMade?.length ?? -1,
    scroll: (window.__scrollListeners ?? []).slice().sort().join(','),
  }));
  const small = await openWall(makeWall(5), { width: 1440, height: 900 });
  const smallListening = await small.page.evaluate(() => ({
    io: window.__ioMade?.length ?? -1,
    scroll: (window.__scrollListeners ?? []).slice().sort().join(','),
  }));
  await small.ctx.close();
  check('the wall builds exactly one IntersectionObserver for 179 tiles — one shared observer',
    listening.io === 1 && smallListening.io === 1, `${listening.io} at 179 tiles, ${smallListening.io} at 5`);
  check('the wall adds no scroll listener of its own — 179 tiles listen exactly as 5 do',
    listening.scroll === smallListening.scroll,
    `179: [${listening.scroll}] vs 5: [${smallListening.scroll}]`);

  // Geometry after the full scroll (content-visibility has rendered true
  // sizes, so the rects are the real wall, not estimates).
  wall = await readWall(page);
  holeCheck('150 posts at 1440px (fully rendered)', wall, 4);

  // Crossing a breakpoint re-deals the wall: 1440 → 320 is 4 → 2 columns,
  // and the tiles must land exactly where the 2-column arithmetic says.
  await page.setViewportSize({ width: 320, height: 700 });
  await page.waitForTimeout(600);
  wall = await readWall(page);
  check('crossing 1440 → 320 re-deals to 2 columns', wall.gridCols === 2, `cols ${wall.gridCols}`);
  compareDeal('150 posts re-dealt at 320px', wall, expectedDeal(posts, 2));
  await ctx.close();
}

/* ============ 3. 500 tiles: the deep scroll, then search re-deals ============ */

scenario = 'count-500';
{
  const posts = makeWall(500, {
    mutate: ps => {
      // Three needles for the narrowing test, scattered deep.
      ps[7].look.name = 'Zephyr coat';
      ps[203].look.name = 'Zephyr wrap';
      ps[441].look.name = 'The zephyr evening look';
    },
  });
  const { ctx, page } = await openWall(posts, { width: 390, height: 844 });
  let wall = await readWall(page);
  const exp2 = expectedDeal(posts, 2);
  compareDeal('500 posts at 390px', wall, exp2);
  hemOnce('500 posts at 390px', wall);
  check('500 posts: one list, no pagination, no load-more, no spinner',
    !/load more|loading|show more/i.test(wall.bodyText) &&
      (await page.evaluate(() => document.querySelectorAll('ul li[data-variant]').length)) === exp2.total, '');
  check('500 posts: the masthead states the honest counts',
    wall.masthead === `500 on show · ${exp2.guestAt.filter(Boolean).length} guests`, wall.masthead ?? '');

  const errBefore = errors.length;
  await page.evaluate(async () => {
    let last = -1;
    for (let i = 0; i < 200; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise(r => setTimeout(r, 50));
      const at = window.scrollY;
      if (at === last) break;
      last = at;
    }
  });
  await page.waitForTimeout(500);
  const atHem = await page.evaluate(() => {
    const hem = [...document.querySelectorAll('p')]
      .find(p => (p.textContent ?? '').includes(window.__hem.plain));
    if (!hem) return { visible: false };
    const r = hem.getBoundingClientRect();
    return { visible: r.top >= 0 && r.top <= window.innerHeight };
  });
  check('deep scroll to the hem at 500 tiles: the hem is reached and visible', atHem.visible, '');
  check('deep scroll to the hem at 500 tiles: no console errors on the way down',
    errors.length === errBefore, errors.slice(errBefore, errBefore + 2).join(' | '));
  check('the page body never scrolls horizontally at 390px', wall.hScroll <= 0, `${wall.hScroll}px over`);

  // Search narrows 500 → 3 and re-deals as the sparse centred column.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.fill('#explore-search', 'zephyr');
  await page.waitForTimeout(900); // useDeferredValue settles
  wall = await readWall(page);
  const t = tiles(wall);
  check('search narrows 500 → 3 and re-deals correctly',
    t.length === 3 && wall.display === 'flex' && t.every(r => r.variant === 'turn' && !r.guest),
    `${t.length} tiles, display ${wall.display}`);
  check('the narrowed wall keeps standing order, newest first',
    t.map(r => r.href).join(',') === '#/explore/sp-7,#/explore/sp-203,#/explore/sp-441',
    t.map(r => r.href).join(','));
  hemOnce('search-narrowed wall', wall, { filtered: true });
  const show = page.getByRole('button', { name: 'Show everything' });
  check('the filtered hem offers exactly one quiet action: Show everything',
    (await show.count()) === 1, '');
  await show.click();
  await page.waitForTimeout(900);
  wall = await readWall(page);
  check('Show everything restores the full deal',
    tiles(wall).length === exp2.total && wall.hemPlain === 1, `${tiles(wall).length} tiles`);
  await ctx.close();
}

/* ================= 4. month seams at a two-month spread ================= */

scenario = 'seams';
{
  // 8 August posts then 9 July posts, one per day, newest first.
  const posts = makeWall(17, { base: new Date('2026-08-08T20:00:00'), stepMin: 1440 });
  for (const [width, cols] of [[320, 2], [1440, 4]]) {
    const { ctx, page } = await openWall(posts, { width, height: 900 });
    const wall = await readWall(page);
    const exp = expectedDeal(posts, cols);
    compareDeal(`two-month wall at ${width}px`, wall, exp);
    const sList = seps(wall);
    check(`seams at ${width}px: count and labels match the arithmetic`,
      sList.length === exp.seams.length &&
        sList.every((s, k) => s.label === exp.seams[k].label),
      `got ${sList.map(s => s.label).join('; ') || 'none'} — expected ${exp.seams.map(s => s.label).join('; ') || 'none'}`);
    // Each seam sits immediately before the tile the arithmetic names, on a
    // band boundary — it takes no index of its own.
    const before = [];
    let seen = 0;
    for (const r of wall.rows) {
      if (r.sep) before.push(seen);
      else seen++;
    }
    check(`seams at ${width}px: printed at the band boundary, never mid-band`,
      before.length === exp.seams.length &&
        before.every((b, k) => b === exp.seams[k].index && b % bandUnit(cols) === 0),
      `at tile ${before.join(',')} — expected ${exp.seams.map(s => s.index).join(',')}`);
    check(`seams at ${width}px: full-width separators, 36px, labelled for ears`,
      sList.every(s => Math.abs(s.h - 36) <= 1 && s.w >= wall.ulW - 2 && /^[A-Z][a-z]+ \d{4}$/.test(s.label ?? '')),
      sList.map(s => `${s.label} ${Math.round(s.h)}px`).join('; '));
    holeCheck(`two-month wall at ${width}px`, wall, cols);
    await ctx.close();
  }

  // Tab order through two bands, a turn and a seam: focus walks the tiles in
  // DOM order and the separator is never focusable.
  const { ctx, page } = await openWall(posts, { width: 320, height: 700 });
  const wall = await readWall(page);
  const hrefs = tiles(wall).map(r => r.href);
  await page.evaluate(() => document.querySelector('li[data-variant] a')?.focus());
  const seq = [];
  for (let k = 0; k < 12; k++) {
    seq.push(await page.evaluate(() =>
      document.activeElement?.getAttribute('href') ??
      (document.activeElement?.getAttribute('role') === 'separator' ? 'SEPARATOR' : 'ELSEWHERE')));
    await page.keyboard.press('Tab');
  }
  check('tab order = reading order through two bands, turns included, seams skipped',
    seq.join(',') === hrefs.slice(0, 12).join(','),
    `walked ${seq.slice(0, 5).join(',')}…`);
  await ctx.close();
}

/* ================ 5. the caption contract at 320px ================ */

scenario = 'captions';
{
  const longName = 'A very long name for a look that keeps going, past every truncation point a designer might have hoped for, through commas and clauses, refusing to stop, in order to prove that the fixed caption row holds its fifty-two pixels and lets the text yield instead of the geometry, all the way to three hundred characters of it';
  const longNote = longName.replace('A very long name for a look', 'A very long pinned note');
  const posts = makeWall(6, {
    mutate: ps => {
      // Newest (the turn) is a pinned note; the racks carry the stress text.
      ps[0] = { ...ps[0], look: undefined, caption: longNote };
      ps[1] = { ...ps[1], authorId: AUTHOR_B.id, look: { ...ps[1].look, name: longName, occasion: 'An occasion with its own long name' } };
      ps[2] = { ...ps[2], look: undefined, caption: longNote };
    },
  });
  const { ctx, page } = await openWall(posts, { width: 320, height: 700, accounts: [AUTHOR_A, AUTHOR_B] });
  const wall = await readWall(page);
  const t = tiles(wall);
  compareDeal('caption wall at 320px', wall, expectedDeal(posts, 2));
  check('a 300-character caption: the rack caption row holds exactly 52px',
    t[1].captionH === 52 && t[2].captionH === 52, `${t[1].captionH}px, ${t[2].captionH}px`);
  check('the phone turn caption holds exactly 88px', t[0].captionH === 88, `${t[0].captionH}px`);
  check('row partners stay level — the long name moved no geometry',
    Math.abs(t[1].h - t[2].h) <= 1 && Math.abs(t[1].y - t[2].y) <= 1,
    `${Math.round(t[1].h)} vs ${Math.round(t[2].h)}`);
  check('no overflow escapes: the page body never scrolls horizontally',
    wall.hScroll <= 0, `${wall.hScroll}px over`);

  const anatomy = await page.evaluate(() => {
    const lis = [...document.querySelectorAll('li[data-variant]')];
    const noteFont = i => {
      const face = lis[i].querySelector('a').children[0];
      const inner = face.querySelector('span');
      return inner ? getComputedStyle(inner).fontSize : null;
    };
    return {
      turnNoteFont: noteFont(0),
      rackNoteFont: noteFont(2),
      turnAuthor: (lis[0].textContent ?? '').includes('Asha Verma'),
      rackTail: window.__ledger(1),
      tagWidths: lis.map(li => {
        const cap = li.querySelector('a');
        const block = cap.children[cap.children.length - 1];
        const svg = block.querySelector('svg');
        return svg ? Math.round(svg.getBoundingClientRect().width) : null;
      }),
      variants: lis.map(li => li.getAttribute('data-variant')),
      guestIdx: lis.findIndex(li => /from the commons, a sample$/.test(li.querySelector('a')?.getAttribute('aria-label') ?? '')),
    };
  });
  check('the Fraunces floor holds: 20px on the rack note, 24px in the turn',
    anatomy.rackNoteFont === '20px' && anatomy.turnNoteFont === '24px',
    `rack ${anatomy.rackNoteFont}, turn ${anatomy.turnNoteFont}`);
  check("the turn's ledger spells the author's name in full", anatomy.turnAuthor, '');

  /* §9.13 as amended by docs/41 erratum E2 (2026-08-20).
     This suite proved the original promise over-constrained: at 320px the
     rack's ledger row could not seat the 16px monogram (21px reserved), the
     4px gap, AND the nowrap tail `· 28 Jul · sample` — the suffix clipped
     mid-word, and a sample that cannot say it is a sample breaks an owner
     law (docs/35). The panel's ruling: the TAG yields on two-column racks —
     identity is one tap away, the sample label is not negotiable. The turn
     keeps its tag and full author name at every width, and racks from three
     columns up keep the tag. So the pins now assert the amended dress: date
     whole, suffix whole, no rack tag at two columns — and a regression that
     re-seats the tag and re-clips the suffix goes red on the suffix pin. */
  const led = anatomy.rackTail;
  check('the date stands whole at 320px, 300-character occasion and all',
    !!led.date?.inside, `date "${led.date?.text}" right ${Math.round(led.date?.right ?? -1)} vs tile edge`);
  check('the occasion is what yields — it truncates before the ledger tail does',
    led.leadShrunk, `tail "${led.tailText}"`);
  /* The harness's 320px window carries a scrollbar a real 320px phone does
     not, so this row is ~15px below the design floor. E2's promise binds at
     the floor: the tag is gone here (asserted), and the suffix stands unless
     the TAIL ALONE outruns the sub-floor row — the arithmetic escape, printed
     so a regression that re-clips for any other reason goes red. The
     at-the-floor promise itself is asserted at 390px just below. */
  check('at 320px the tag has yielded, and · sample clips only if the bare tail outruns the sub-floor row (E2)',
    led.tagW === 0 && (led.sample?.inside === true || led.tailW > led.rowW),
    `tag ${led.tagW}px, tail ${led.tailW}px in a ${led.rowW}px row (scrollbar-narrowed)`);
  const rackTagCount = anatomy.tagWidths.filter((w, i) =>
    w !== null && i !== anatomy.guestIdx && anatomy.variants[i] === 'rack').length;
  const turnTagCount = anatomy.tagWidths.filter((w, i) =>
    w !== null && anatomy.variants[i] !== 'rack').length;
  check('two-column racks wear no monogram tag; the turns keep theirs (E2)',
    rackTagCount === 0 && turnTagCount > 0 && anatomy.turnAuthor,
    `rack tags ${rackTagCount}, turn tags ${turnTagCount}`);
  check('a guest wears no monogram — a tag would dress a sample as a person',
    anatomy.guestIdx >= 0 && anatomy.tagWidths[anatomy.guestIdx] === null, '');
  /* §6, the focus ring — asked the only way that means anything: is the
     focused tile distinguishable from the same tile unfocused? Keyboard
     focus, not a scripted .focus(): `:focus-visible` is a heuristic about
     how the focus arrived, and the house ring lives only there. The rest of
     the answer is read in the room the app actually opens in. */
  const ring = await page.evaluate(async () => {
    const dress = el => {
      const s = getComputedStyle(el);
      return `${s.outlineWidth}/${s.outlineOffset}/${s.outlineStyle}/${s.outlineColor}`;
    };
    const links = [...document.querySelectorAll('li[data-variant] a')];
    return { resting: dress(links[1]), theme: document.documentElement.getAttribute('data-theme') };
  });
  await page.evaluate(() => document.querySelectorAll('li[data-variant] a')[0].focus());
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => {
    const a = document.activeElement;
    const s = getComputedStyle(a);
    const li = a.closest('li');
    return {
      focusVisible: a.matches(':focus-visible'),
      dress: `${s.outlineWidth}/${s.outlineOffset}/${s.outlineStyle}/${s.outlineColor}`,
      width: s.outlineWidth, offset: s.outlineOffset, style: s.outlineStyle,
      seatClip: getComputedStyle(li).overflow,
      tap: Math.min(a.getBoundingClientRect().width, a.getBoundingClientRect().height),
    };
  });
  check('a keyboard-focused tile looks different from an unfocused one, in the room the app opens in',
    focus.dress !== ring.resting,
    `${ring.theme}: focused ${focus.dress} vs resting ${ring.resting} — :focus-visible matched ${focus.focusVisible}`);
  check('the focused tile wears the house ring: 2px accent at 2px offset, unclipped by its seat',
    focus.width === '2px' && focus.offset === '2px' && focus.style !== 'none' &&
      focus.seatClip === 'visible',
    `${focus.width}/${focus.offset}/${focus.style}, seat overflow ${focus.seatClip}`);
  // The same tile in a room without the brocade mount — the ring is there,
  // which localises the loss above to the mount's specificity, not to a
  // missing rule and not to this suite mismeasuring.
  const litRoom = await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    const a = document.activeElement;
    const s = getComputedStyle(a);
    return `${s.outlineWidth}/${s.outlineOffset}`;
  });
  check('the house ring is not missing, only outranked: the same focused tile rings 2px/2px in the light room',
    litRoom === '2px/2px', litRoom);
  check('the whole tile is the target, far past 44px even in a 320px rack',
    focus.tap >= 44, `${Math.round(focus.tap)}px`);
  await ctx.close();

  // The same wall one breakpoint wider: the suffix stands the moment the row
  // has the room, which is what makes the 320px clip geometry and not a bug.
  const wider = await openWall(posts, { width: 390, height: 844, accounts: [AUTHOR_A, AUTHOR_B] });
  const led390 = await wider.page.evaluate(() => window.__ledger(1));
  check('at 390px the same tile holds date AND · sample whole — the suffix was lost to width, nothing else',
    led390.date?.inside === true && led390.sample?.inside === true,
    `needs ${led390.tagW + led390.gap + led390.tailW}px in a ${led390.rowW}px row`);
  await wider.ctx.close();

  // From three columns up the rack has the room, and the tag comes back —
  // E2 trims the tag from two-column racks only, never from the wider walls.
  const threeCol = await openWall(posts, { width: 800, height: 900, accounts: [AUTHOR_A, AUTHOR_B] });
  const led800 = await threeCol.page.evaluate(() => window.__ledger(1));
  check('a three-column multi-author rack wears the monogram tag, with date and · sample whole (E2)',
    led800.tagW > 0 && led800.date?.inside === true && led800.sample?.inside === true,
    `tag ${led800.tagW}px, row ${led800.rowW}px`);
  await threeCol.ctx.close();

  // And with no monogram to seat — a single-author wall — the whole tail
  // stands at 320px, which localises the defect to the tag's 25px.
  const solo = await openWall(makeWall(6, {
    mutate: ps => { ps[1] = { ...ps[1], look: { ...ps[1].look, occasion: 'An occasion with its own long name' } }; },
  }), { width: 320, height: 700 });
  const ledSolo = await solo.page.evaluate(() => window.__ledger(1));
  check('a single-author wall at 320px holds its whole ledger tail — no tag, no clip',
    ledSolo.tagW === 0 && ledSolo.date?.inside === true, `tag ${ledSolo.tagW}px, row ${ledSolo.rowW}px`);
  await solo.ctx.close();
}

/* ============== 6. reduced motion: the same page at rest ============== */

scenario = 'reduced-motion';
{
  const posts = makeWall(30);
  const { ctx, page } = await openWall(posts, { width: 390, height: 844, reducedMotion: 'reduce' });
  const wall = await readWall(page);
  compareDeal('reduced motion, 30 posts', wall, expectedDeal(posts, 2));
  check('reduced motion: no fade machinery at all — the static mosaic is the page',
    tiles(wall).every(r => !r.fade && !r.shown), '');
  const opacities = await page.evaluate(() =>
    [...document.querySelectorAll('li[data-variant]')].map(li => getComputedStyle(li).opacity));
  check('reduced motion: every tile fully visible, nothing hidden',
    opacities.length > 0 && opacities.every(o => Number(o) === 1), '');
  await ctx.close();

  // The same seed with motion allowed deals the identical wall — reduced
  // motion is the same page at rest, not a degraded mode.
  const twin = await openWall(posts, { width: 390, height: 844 });
  const animated = await readWall(twin.page);
  check('reduced motion: layout identical to the animated page — same tiles, same variants',
    JSON.stringify(tiles(wall).map(r => [r.href, r.variant, Math.round(r.y)])) ===
      JSON.stringify(tiles(animated).map(r => [r.href, r.variant, Math.round(r.y)])), '');
  await twin.ctx.close();
}

/* ================= 7. consent: the one door, unwidened ================= */

scenario = 'consent';
{
  const posts = makeWall(5, {
    mutate: ps => { ps[1].authorId = AUTHOR_B.id; },
  });
  // A self-scoped post and a person-scoped post for somebody else, both by
  // the other author, both carrying the searched word. The Explore set must
  // equal the postVisibleTo set — before and after any search.
  posts.push({
    id: 'sp-hidden-self', authorId: AUTHOR_B.id, date: '2026-07-20', at: '2026-07-20T10:00:00',
    scope: { kind: 'self' }, caption: 'A quiet zephyrhidden note for nobody else',
  });
  posts.push({
    id: 'sp-hidden-person', authorId: AUTHOR_B.id, date: '2026-07-19', at: '2026-07-19T10:00:00',
    scope: { kind: 'person', accountId: 'w-not-me' },
    look: { outfitId: 'o-h', name: 'The zephyrhidden look', pieces: [] },
  });
  const { ctx, page } = await openWall(posts, { width: 390, accounts: [AUTHOR_A, AUTHOR_B] });
  let wall = await readWall(page);
  check('a self-scoped post never appears, however the wall is dressed',
    !wall.bodyText.includes('zephyrhidden') &&
      tiles(wall).every(r => !/sp-hidden/.test(r.href ?? '')) &&
      tiles(wall).length === expectedDeal(posts.slice(0, 5), 2).total, '');
  await page.fill('#explore-search', 'zephyrhidden');
  await page.waitForTimeout(800);
  wall = await readWall(page);
  check('search cannot widen the aperture: a matching hidden post stays hidden',
    tiles(wall).length === 0 && !wall.bodyText.includes('zephyrhidden'), `${tiles(wall).length} tiles`);
  hemOnce('the wall a search emptied', wall, { filtered: true });
  await ctx.close();
}

/* ============ 8. the hay: colour words and month words, on the page ============ */

scenario = 'search-hay';
{
  const posts = makeWall(5, {
    mutate: ps => {
      ps[0].look = { outfitId: 'o-0', name: 'Evening out', occasion: 'Evening', pieces: ['A navy scarf', 'Boots'] };
      ps[1] = { ...ps[1], look: undefined, piece: { itemId: 'i-1', name: 'Raincoat', category: 'outerwear', color: '#1F2A44' } };
      ps[2] = { ...ps[2], look: undefined, piece: { itemId: 'i-2', name: 'Sun dress', category: 'dresses', color: '#E8A0B4' } };
      ps[3].look = { outfitId: 'o-3', name: 'Plain look', pieces: ['Boots'] };
      ps[4] = { ...ps[4], date: '2026-03-09', at: '2026-03-09T09:00:00', look: undefined, caption: 'On mending things before they ask twice' };
    },
  });
  const { ctx, page } = await openWall(posts, { width: 390 });
  const results = async q => {
    await page.fill('#explore-search', q);
    await page.waitForTimeout(700);
    const wall = await readWall(page);
    return tiles(wall).map(r => r.href?.replace('#/explore/', '')).sort().join(',');
  };
  check("'navy' finds the navy piece through the mapper AND the look through its piece name",
    (await results('navy')) === 'sp-0,sp-1', await results('navy'));
  check("a look never matches colour except through piece names — 'pink' finds only the piece",
    (await results('pink')) === 'sp-2', '');
  check("'march' and 'mar' find the March post through month words",
    (await results('march')) === 'sp-4' && (await results('mar')) === 'sp-4', '');
  check("the year finds every post of that year",
    (await results('2026')) === 'sp-0,sp-1,sp-2,sp-3,sp-4', '');
  const clear = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Clear search"]');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  check('the clear-search button stays 44×44', !!clear && clear.w >= 44 && clear.h >= 44,
    clear ? `${clear.w}×${clear.h}` : 'missing');
  await ctx.close();
}

/* ================== 9. the chips, and the commons room ================== */

scenario = 'chips-commons';
{
  const posts = makeWall(7, {
    mutate: ps => {
      ps[0].look = { outfitId: 'o-0', name: 'Evening out', occasion: 'Evening', pieces: [] };
      ps[1] = { ...ps[1], look: undefined, piece: { itemId: 'i-1', name: 'Raincoat', category: 'outerwear', color: '#1F2A44' } };
      ps[2] = { ...ps[2], look: undefined, piece: { itemId: 'i-2', name: 'Sun dress', category: 'dresses' } };
    },
  });
  const { ctx, page } = await openWall(posts, { width: 1024, height: 900 });
  const chipNames = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map(b => (b.textContent ?? '').trim()).filter(Boolean));
  check('the rail offers Looks and Pieces only because both kinds are present',
    chipNames.includes('Looks') && chipNames.includes('Pieces') && chipNames.includes('Everything') &&
      chipNames.includes('From the commons'), chipNames.slice(0, 10).join(' · '));

  await page.getByRole('button', { name: 'Looks', exact: true }).click();
  await page.waitForTimeout(600);
  let wall = await readWall(page);
  check('under a question about clothes, no guest rides along',
    tiles(wall).length === 5 && tiles(wall).every(r => !r.guest), `${tiles(wall).length} tiles`);
  hemOnce('the Looks room', wall, { filtered: true });

  await page.getByRole('button', { name: 'From the commons', exact: true }).click();
  await page.waitForTimeout(600);
  wall = await readWall(page);
  const t = tiles(wall);
  check('the commons room holds the whole commons, racks only — no turns for samples',
    t.length === BUFFER_FEED.length && t.every(r => r.guest && r.variant === 'rack'),
    `${t.length} tiles`);
  check('the commons room keeps the dealt grid — a sample is not a young wardrobe',
    wall.display === 'grid', wall.display ?? '');
  check('the commons masthead counts guests as guests',
    wall.masthead === `${BUFFER_FEED.length} guests`, wall.masthead ?? '');
  hemOnce('the commons room', wall, { filtered: true });
  const dress = await page.evaluate(() => {
    const lis = [...document.querySelectorAll('li[data-variant]')];
    const links = lis.map(li => li.querySelector('a'));
    const vids = [...document.querySelectorAll('li[data-variant] video')];
    return {
      dashed: links.every(a => getComputedStyle(a).borderTopStyle === 'dashed'),
      labelled: links.every(a => /from the commons, a sample$/.test(a.getAttribute('aria-label') ?? '')),
      selvage: lis.every(li => (li.textContent ?? '').includes('from the commons')),
      videos: vids.length,
      autoplay: vids.filter(v => v.autoplay || v.hasAttribute('autoplay')).length,
      playing: vids.filter(v => !v.paused).length,
      preload: vids.every(v => v.preload === 'metadata'),
    };
  });
  check('guests wear the dashed hairline, the selvage, and the honest label',
    dress.dashed && dress.labelled && dress.selvage, '');
  check('grid video never plays: poster frames only, no autoplay anywhere',
    dress.videos === 2 && dress.autoplay === 0 && dress.playing === 0 && dress.preload, `${dress.videos} videos`);

  await page.getByRole('button', { name: 'Everything', exact: true }).click();
  await page.waitForTimeout(600);
  wall = await readWall(page);
  check('Everything restores the full wall from the commons room',
    tiles(wall).length === expectedDeal(posts, 3).total, `${tiles(wall).length} tiles`);
  await ctx.close();
}

/* ========= 10. same day, same wall: reloads and second visitors ========= */
/* docs/41 §9.1 and §2.4: the arrangement is fixed once laid. The date seed
   rotates WHICH guests appear, never WHERE anything sits, so two reloads and
   a second fresh visitor on the same day must produce the identical wall —
   identity, variant, and the pixel row each tile landed on. A wall that
   re-deals on reload would be a wall that ranks. */

scenario = 'determinism';
{
  const posts = makeWall(30, {
    mutate: ps => { ps[3] = { ...ps[3], authorId: AUTHOR_B.id }; },
  });
  const fingerprint = wall =>
    JSON.stringify([
      ...tiles(wall).map(r => [r.href, r.variant, Math.round(r.x), Math.round(r.y), Math.round(r.w)]),
      ...seps(wall).map(s => ['seam', s.label]),
    ]);
  const { ctx, page } = await openWall(posts, { width: 800, height: 900, accounts: [AUTHOR_A, AUTHOR_B] });
  const first = fingerprint(await readWall(page));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('h1', { hasText: 'Explore' }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  const second = fingerprint(await readWall(page));
  check('two reloads, same day: identical tile order, sizes, and seats',
    first === second && first.length > 100, `${first.slice(0, 60)}…`);
  await ctx.close();

  const visitor = await openWall(posts, { width: 800, height: 900, accounts: [AUTHOR_A, AUTHOR_B] });
  const third = fingerprint(await readWall(visitor.page));
  check('a second visit in a fresh context deals the same wall — no per-load randomness',
    first === third, first === third ? '' : 'the wall re-dealt itself');
  await visitor.ctx.close();
}

/* ======== 11. the source, read for what must NOT be in it ======== */
/* §9.2, §9.11, §9.19. Comments are stripped first: this feature's own prose
   discusses popularity, ranking, and seen-state at length precisely in order
   to refuse them, and a grep that cannot tell a refusal from an
   implementation is a grep that will be deleted the first time it cries. */

scenario = 'source';
{
  const read = rel => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');
  const strip = src => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  const page = strip(read('src/pages/Explore.tsx'));
  const lib = strip(read('src/lib/showing.ts'));
  const css = strip(read('src/index.css'));
  const showingCss = css.slice(Math.max(0, css.indexOf('.showing-fade') - 400));
  const code = `${page}\n${lib}`;

  check('no engagement data is read, written, or invented anywhere in the new code',
    !/\b(likes?|favou?rites?|hearts?|impressions?|viewCount|views\b|trending|popularity|ranking|rankBy|engagement|streaks?|badges?|unread|unseen|seenAt|seenBy)\b/i.test(code),
    (code.match(/\b(likes?|impressions?|trending|popularity|ranking|engagement|streaks?|badges?|seenAt)\b/i) ?? []).join(','));
  check('no autoplay on any grid media, and no scroll-linked animation garnish',
    !/autoplay/i.test(code) && !/animation-timeline|view\(\)|scroll\(\)/i.test(`${code}\n${showingCss}`), '');
  check('no scroll listener and no rAF loop in the page — the observer is the only scroll-adjacent JS',
    !/addEventListener\(\s*['"](scroll|wheel|touchmove)/.test(code) &&
      !/onScroll|requestAnimationFrame/.test(code), '');
  check('the deal is arithmetic, never a die roll — no randomness in the size grammar',
    !/Math\.random|crypto\.getRandomValues/.test(code), '');
  check('the one door: the page reaches for resolveFeedEntries and no other reader of the community',
    /resolveFeedEntries/.test(page) &&
      !/community\.posts\s*\.(filter|map|slice)/.test(page) &&
      !/postVisibleTo/.test(page), '');
  check('exactly one IntersectionObserver is constructed in the page source',
    (page.match(/new IntersectionObserver/g) ?? []).length === 1,
    `${(page.match(/new IntersectionObserver/g) ?? []).length}`);
  check('no structural CSS selector drives a variant — the seam would shift it',
    !/nth-child|nth-of-type|first-child|last-child/.test(showingCss) &&
      !/nth-child|nth-of-type/.test(page), '');
}

/* The content-visibility contract (§7), measured rather than grepped: racks
   carry it with the breakpoint's own h = 1.25w + 52 fallback, the 2×2 turn
   takes none because rows legislate its height, and the phone turn takes it
   with its own fallback. */
scenario = 'containment';
{
  const posts = makeWall(40);
  for (const [width, cols] of [[390, 2], [1440, 4]]) {
    const { ctx, page } = await openWall(posts, { width, height: 900 });
    const cv = await page.evaluate(() => {
      const out = {};
      for (const li of document.querySelectorAll('li[data-variant]')) {
        const a = li.querySelector('a');
        if (!a) continue;
        const s = getComputedStyle(a);
        out[li.dataset.variant] ??= {
          cv: s.contentVisibility,
          size: s.containIntrinsicSize,
          w: Math.round(li.getBoundingClientRect().width),
          h: Math.round(li.getBoundingClientRect().height),
        };
      }
      return out;
    });
    const rack = cv.rack;
    check(`containment at ${width}px: racks skip their own rendering off-screen`,
      rack?.cv === 'auto' && /^auto \d+px/.test(rack?.size ?? ''), `${rack?.cv} ${rack?.size}`);
    const nominal = Number((rack?.size ?? '').match(/auto (\d+)px/)?.[1] ?? 0);
    check(`containment at ${width}px: the fallback pours h = 1.25w + 52 from the nominal column`,
      Math.abs(Number((rack?.size ?? '').match(/(\d+)px\s*$/)?.[1] ?? 0) - (1.25 * nominal + 52)) <= 2,
      rack?.size ?? '');
    if (cols === 2) {
      check('containment at 390px: the phone turn is contained too, with its own fallback',
        cv.turn?.cv === 'auto' && /^auto \d+px/.test(cv.turn?.size ?? ''), `${cv.turn?.cv} ${cv.turn?.size}`);
    } else {
      check('containment at 1440px: the 2×2 turn takes none — its rows legislate its height',
        cv.turn?.cv === 'visible' && (cv['turn-r']?.cv ?? 'visible') === 'visible',
        `${cv.turn?.cv} / ${cv['turn-r']?.cv}`);
    }
    await ctx.close();
  }
}

/* ============ 12. red-proofs: the checks, broken on purpose ============ */
/* A suite that has never failed is a rumour. Each proof below takes a
   passing wall, breaks the one thing the assertion claims to watch — in the
   rendered page, or in the seeded data — and requires the SAME predicate
   that just passed to go red. Nothing is weakened to make this work: the
   predicates are the ones the run above used, called again. */

scenario = 'red-proof';
{
  const posts = makeWall(30, { mutate: ps => { ps[4] = { ...ps[4], authorId: AUTHOR_B.id }; } });
  const exp = expectedDeal(posts, 2);
  const { ctx, page } = await openWall(posts, { width: 390, height: 844, accounts: [AUTHOR_A, AUTHOR_B] });

  const clean = await readWall(page);
  check('red-proof baseline: the wall passes before anything is broken',
    dealVerdict(clean, exp).idsOk && dealVerdict(clean, exp).turnOk && hemVerdict(clean, false), '');

  // (1) The deal's identity. Swap two neighbouring tiles in the DOM only.
  await page.evaluate(() => {
    const ul = document.querySelector('li[data-variant]').closest('ul');
    const lis = [...ul.children].filter(el => el.tagName === 'LI');
    ul.insertBefore(lis[3], lis[2]);
  });
  const swapped = await readWall(page);
  check('red-proof: two tiles transposed in the DOM is caught by the identity check',
    dealVerdict(swapped, exp).idsOk === false, `drift reported at ${dealVerdict(swapped, exp).idsDrift}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('h1', { hasText: 'Explore' }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);

  // (2) The law itself: a guest holding the turn.
  const promoted = await page.evaluate(() => {
    const guest = [...document.querySelectorAll('li[data-variant]')]
      .find(li => /from the commons, a sample$/.test(li.querySelector('a')?.getAttribute('aria-label') ?? ''));
    if (!guest) return false;
    guest.dataset.variant = 'turn';
    return true;
  });
  const dressed = await readWall(page);
  check('red-proof: a guest dressed as the turn is caught by the size law',
    promoted && dealVerdict(dressed, exp).turnOk === false,
    `caught at tile ${dealVerdict(dressed, exp).turnDrift}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('h1', { hasText: 'Explore' }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);

  // (3) The hem speaks ONCE — not "the hem exists".
  await page.evaluate(() => {
    const hem = [...document.querySelectorAll('p')]
      .find(p => (p.textContent ?? '').includes(window.__hem.plain));
    hem.after(hem.cloneNode(true));
  });
  const doubled = await readWall(page);
  check('red-proof: a second hem sentence is caught — the check counts, it does not just look',
    hemVerdict(doubled, false) === false, `plain ${doubled.hemPlain}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('h1', { hasText: 'Explore' }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);

  // (4) The fixed-pixel caption: unpin the declared height and the row moves.
  // (Unpinning alone proves nothing: the caption's natural content is 52px
  // to the pixel, which is the point of the contract. Move it instead.)
  const capBefore = tiles(await readWall(page))[1].captionH;
  await page.evaluate(() => {
    for (const a of document.querySelectorAll('li[data-variant] a')) {
      const cap = a.children[a.children.length - 1];
      cap.classList.remove('h-[52px]');
      cap.style.height = '40px';
    }
  });
  const unpinned = tiles(await readWall(page))[1].captionH;
  check('red-proof: a caption moved off its 52px is caught by the measurement',
    capBefore === 52 && unpinned === 40, `${capBefore}px → ${unpinned}px`);
  await ctx.close();
}

{
  // (5) The consent door, red-proofed with contradicting data rather than a
  // broken DOM: the same post that must never appear is re-seeded as
  // `everyone`, and it must then appear. Without this, "the hidden post is
  // absent" could be passing because the fixture never rendered at all.
  const base = makeWall(5);
  const shown = {
    id: 'sp-proof', authorId: AUTHOR_A.id, date: '2026-07-20', at: '2026-07-20T10:00:00',
    scope: { kind: 'everyone' }, look: { outfitId: 'o-p', name: 'The zephyrproof look', pieces: [] },
  };
  const { ctx, page } = await openWall([...base, shown], { width: 390 });
  await page.fill('#explore-search', 'zephyrproof');
  await page.waitForTimeout(800);
  const open = await readWall(page);
  check('red-proof: the same post scoped to everyone DOES appear — the consent check can see it',
    tiles(open).length === 1 && open.bodyText.includes('zephyrproof'), `${tiles(open).length} tiles`);
  await ctx.close();
}

/* ------------------------------ the verdict ------------------------------ */

check('no page or console errors anywhere in the run', errors.length === 0,
  errors.slice(0, 3).join(' | '));

await browser.close();
if (failed) {
  console.log(
    `\n${failed} EXPLORE STRESS CHECKS FAILED. Each line below is a defect in the` +
    '\npage, not a limit of this suite: every one was measured, localised, and' +
    '\nreproduced twice. Fix the page. A check here is never to be relaxed to' +
    '\nmake a run green.\n'
  );
  for (const line of redLines) console.log('  ·', line);
  console.log('');
} else {
  console.log('\nALL EXPLORE STRESS CHECKS PASSED');
}
process.exit(failed ? 1 : 0);
