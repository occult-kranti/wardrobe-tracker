#!/usr/bin/env node
/**
 * Builds the standalone mobile design pack for hosting.
 *
 * The local gallery (design-android/serve.mjs) needs node; this one is a flat
 * folder of files that any static host serves, so the pack can live beside the
 * app at /mobile_version_v1/ and open on an actual phone.
 *
 * Usage: node scripts/build-mobile-gallery.mjs [outDir]
 *        (default dist/mobile_version_v1)
 */
import { cp, mkdir, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'design-mobile/mockups');
const OUT = process.argv[2] ?? join(ROOT, 'dist/mobile_version_v1');

/** The walk-through order — the order the product is actually met in, not
    alphabetical. The viewer's next/back follow it. */
const FLOW = [
  ['today', 'Today', 'The day’s one question, and the standing of the wardrobe.'],
  ['closet', 'Closet', 'Everything owned, behind doors that part on a rail.'],
  ['outfits', 'Outfits', 'Looks kept, and a hand dealt from what is clean.'],
  ['calendar', 'Calendar', 'A week where a plan is a plan until it is worn.'],
  ['ledger', 'Ledger', 'Cost per wear, utilisation, and the money resting.'],
  ['wishlist', 'Wishlist', 'Wanting, held for seven silent days.'],
  ['compare', 'Before you buy', 'The case against, made only of what is owned.'],
  ['events', 'Events', 'Days that are coming, and a look held for each.'],
  ['feed', 'Feed', 'Looks worn by people whose closets are known.'],
  ['chats', 'Conversations', 'Borrowing, lending, passing on.'],
  ['profile', 'Profile', 'The wardrobe’s own identity, and its households.'],
  ['rail', 'Shared rail', 'What is lent between houses that trust each other.'],
  ['settings', 'Settings', 'The rooms, the categories, and the export drawer.'],
  ['open', 'Wardrobes', 'More than one record on one device.'],
];

const ROOMS = [
  ['', 'As designed'],
  ['atelier', 'Atelier'],
  ['pattern', 'Pattern'],
  ['gilding', 'Gilding'],
  ['dyehouse', 'Dye house'],
];

const page = (files) => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Toile — mobile design, v1</title>
<meta name="theme-color" content="#100E0B">
<style>
  *{margin:0;box-sizing:border-box}
  :root{--ink:#EAE2D0;--ink-2:#9C9179;--line:#3A322A;--gold:#C79B4A;--seal:#BE1231;--bg:#0B0A08}
  body{background:var(--bg);color:var(--ink);font:15px/1.5 Georgia,serif;
       display:flex;flex-direction:column;min-height:100svh;overflow:hidden}

  header{flex:none;display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line)}
  header h1{font:700 14px Georgia,serif;letter-spacing:.28em;flex:none}
  header .rule{width:44px;height:2px;background:var(--seal)}
  header .count{margin-left:auto;font:500 10px 'Courier New',monospace;letter-spacing:.14em;color:var(--ink-2)}

  main{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;
       justify-content:flex-start;overflow:hidden;padding:12px 10px 0}
  .frame{transform-origin:top center}
  iframe{width:412px;height:1060px;border:0;background:transparent;display:block}

  .meta{flex:none;text-align:center;padding:10px 18px 4px;max-width:620px;margin:0 auto}
  @media (max-height:760px){ .meta p{display:none} .meta{padding:6px 18px 2px} }
  .meta h2{font:400 21px Georgia,serif}
  .meta p{font:italic 400 14px Georgia,serif;color:var(--ink-2);margin-top:3px}

  nav.bar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:8px;
      padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));
      border-top:1px solid var(--line);background:var(--bg)}
  /* Row one is always the walk: back, where you are, next. Anything else
     wraps beneath it rather than shouldering Next off a narrow screen. */
  .walk{display:flex;align-items:center;gap:8px;width:100%}
  .walk #pick{flex:1;min-width:0}
  .extras{display:flex;align-items:center;gap:8px;width:100%}
  button{font:600 10px 'Courier New',monospace;letter-spacing:.12em;text-transform:uppercase;
         background:none;border:1px solid #4A4036;color:var(--ink);padding:11px 13px;border-radius:2px;cursor:pointer;min-height:44px}
  button:disabled{opacity:.35}
  button.on{background:var(--ink);color:var(--bg);border-color:transparent}
  .spread{flex:1}
  select{font:600 10px 'Courier New',monospace;letter-spacing:.1em;text-transform:uppercase;background:#17130F;
         color:var(--ink);border:1px solid #4A4036;border-radius:2px;padding:11px 8px;min-height:44px}
  .rooms{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
  .rooms::-webkit-scrollbar{display:none}
  @media (max-width:640px){ .rooms{display:none} }
  @media (min-width:641px){ select.roomsel{display:none} }
</style>
<body>
<header>
  <h1>TOILE</h1><span class="rule"></span>
  <span class="count" id="count"></span>
</header>

<div class="meta"><h2 id="title"></h2><p id="blurb"></p></div>

<main id="stage"><div class="frame" id="frame"><iframe id="f" title="screen"></iframe></div></main>

<nav class="bar">
  <div class="walk">
    <button id="prev" aria-label="Previous screen">‹</button>
    <select id="pick" aria-label="Choose a screen"></select>
    <button id="next" aria-label="Next screen">›</button>
  </div>
  <div class="extras">
    <button id="stagebtn" hidden aria-pressed="false">See the moment</button>
    <span class="spread"></span>
    <div class="rooms" id="rooms"></div>
    <select class="roomsel" id="roomsel" aria-label="Room"></select>
  </div>
</nav>

<script>
const FLOW = ${JSON.stringify(files)};
const ROOMS = ${JSON.stringify(ROOMS)};
let i = 0, room = '', stageIdx = 0, contentH = 1060;

const f = document.getElementById('f');
const pick = document.getElementById('pick');
const roomsel = document.getElementById('roomsel');

for (const [n, [slug, title]] of FLOW.entries()) {
  pick.append(new Option(title, String(n)));
}
for (const [value, label] of ROOMS) {
  roomsel.append(new Option(label, value));
  const b = document.createElement('button');
  b.textContent = label; b.dataset.room = value;
  b.onclick = () => { room = value; paint(); };
  document.getElementById('rooms').append(b);
}

/* The mockups are drawn at 412px; a phone is often narrower and always
   shorter. Scale the whole frame to fit rather than letting it clip. */
function fit() {
  /* Measure the room that is genuinely left: the viewport minus the chrome
     above and below. Measuring the stage itself is circular — it is a flex
     box sized around a 975px iframe, so it always claims to be big enough
     and pushes the nav off the screen. */
  const head = document.querySelector('header').getBoundingClientRect().height;
  const meta = document.querySelector('.meta').getBoundingClientRect().height;
  const bar = document.querySelector('nav.bar').getBoundingClientRect().height;
  const stage = document.getElementById('stage');
  /* visualViewport is the part actually on screen — innerHeight still counts
     the strip behind a phone's retracting toolbar, and sizing to it puts this
     viewer's own buttons under the browser chrome. */
  const vh = Math.min(window.innerHeight, window.visualViewport ? window.visualViewport.height : Infinity);
  const availH = Math.max(160, vh - head - meta - bar - 18);
  const availW = stage.clientWidth - 16;
  const s = Math.min(availW / 412, availH / contentH, 1);
  const frame = document.getElementById('frame');
  frame.style.transform = 'scale(' + s.toFixed(3) + ')';
  frame.style.height = Math.round(contentH * s) + 'px';
  frame.style.width = '412px';
  f.style.height = contentH + 'px';
}

/* The mockup files lay their stages — the screen at rest, and the screen
   mid-art-moment — side by side, which at phone width means the second one
   sits below the fold and is never seen. Show exactly one at a time. */
function showStage() {
  const d = f.contentDocument;
  if (!d || !d.body) return;
  const stages = [...d.querySelectorAll('.stage')];
  const btn = document.getElementById('stagebtn');
  btn.hidden = stages.length < 2;
  if (stages.length < 2) stageIdx = 0;
  btn.textContent = stageIdx === 0 ? 'See the moment' : 'Back to rest';
  btn.setAttribute('aria-pressed', String(stageIdx === 1));
  stages.forEach((st, n) => { st.style.display = n === stageIdx ? 'flex' : 'none'; });
  d.body.style.padding = '0';
  d.body.style.display = 'block';
  const shown = stages[stageIdx];
  if (shown) contentH = Math.max(940, Math.ceil(shown.getBoundingClientRect().height) + 24);
}

function applyRoom() {
  try {
    const d = f.contentDocument;
    if (!d) return;
    d.querySelectorAll('.phone').forEach(ph => {
      if (room) { if (!ph.dataset.prev) ph.dataset.prev = ph.getAttribute('data-room') || ''; ph.setAttribute('data-room', room); }
      else if (ph.dataset.prev !== undefined) ph.setAttribute('data-room', ph.dataset.prev);
    });
  } catch {}
}

function paint() {
  const [slug, title, blurb] = FLOW[i];
  document.getElementById('title').textContent = title;
  document.getElementById('blurb').textContent = blurb;
  document.getElementById('count').textContent = (i + 1) + ' / ' + FLOW.length;
  pick.value = String(i);
  roomsel.value = room;
  [...document.querySelectorAll('.rooms button')].forEach(b => b.classList.toggle('on', b.dataset.room === room));
  document.getElementById('prev').disabled = i === 0;
  document.getElementById('next').disabled = i === FLOW.length - 1;
  const want = slug + '.html';
  if (!f.src.endsWith(want)) {
    f.src = want;
    f.onload = () => { showStage(); applyRoom(); fit(); };
  } else { showStage(); applyRoom(); fit(); }
  location.hash = slug;
}

const go = n => { i = Math.min(FLOW.length - 1, Math.max(0, n)); stageIdx = 0; paint(); };
document.getElementById('stagebtn').onclick = () => { stageIdx = stageIdx === 0 ? 1 : 0; paint(); };
document.getElementById('prev').onclick = () => go(i - 1);
document.getElementById('next').onclick = () => go(i + 1);
pick.onchange = e => go(Number(e.target.value));
roomsel.onchange = e => { room = e.target.value; paint(); };
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') go(i + 1);
  if (e.key === 'ArrowLeft') go(i - 1);
});
addEventListener('resize', fit);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

/* Swipe, because this is meant to be read on a phone. */
let x0 = null;
document.getElementById('stage').addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
document.getElementById('stage').addEventListener('touchend', e => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0;
  if (Math.abs(dx) > 60) go(i + (dx < 0 ? 1 : -1));
  x0 = null;
}, { passive: true });

const want = location.hash.slice(1);
const found = FLOW.findIndex(s => s[0] === want);
i = found < 0 ? 0 : found;
paint(); fit();
</script>
</body>
</html>`;

await mkdir(OUT, { recursive: true });
await cp(SRC, OUT, { recursive: true });
const files = FLOW.filter(async () => true);
await writeFile(join(OUT, 'index.html'), page(FLOW));

const written = (await readdir(OUT)).filter(f => f.endsWith('.html')).length;
console.log(`mobile gallery → ${OUT} (${written} html files, ${FLOW.length} in the flow)`);
