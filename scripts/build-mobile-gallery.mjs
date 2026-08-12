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
<meta name="theme-color" content="#0B0A08">
<style>
  *{margin:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  :root{--ink:#EAE2D0;--ink-2:#9C9179;--line:#3A322A;--gold:#C79B4A;--seal:#BE1231;--bg:#0B0A08}
  html,body{height:100%;overscroll-behavior:none}
  body{background:var(--bg);color:var(--ink);font:15px/1.5 Georgia,serif;
       display:flex;flex-direction:column;overflow:hidden}

  /* ---- chrome: one compact line top, one bar bottom. Both retract. ---- */
  header{flex:none;display:flex;align-items:center;gap:10px;
    padding:calc(8px + env(safe-area-inset-top,0px)) 14px 8px;border-bottom:1px solid var(--line)}
  header .mark{font:700 12px Georgia,serif;letter-spacing:.26em;flex:none}
  header .rule{width:26px;height:2px;background:var(--seal);flex:none}
  header h2{font:400 16px Georgia,serif;flex:1;min-width:0;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap;text-align:center}
  header .count{font:500 10px 'Courier New',monospace;letter-spacing:.1em;color:var(--ink-2);flex:none}

  main{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;
       overflow:hidden;position:relative}
  .frame{transform-origin:center center}
  iframe{width:412px;height:935px;border:0;background:transparent;display:block}

  nav.bar{flex:none;display:flex;flex-wrap:wrap;align-items:center;gap:7px;
      padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));
      border-top:1px solid var(--line);background:var(--bg)}
  .walk{display:flex;align-items:center;gap:7px;width:100%}
  .walk #pick{flex:1;min-width:0}
  .extras{display:flex;align-items:center;gap:7px;width:100%}
  button{font:600 10px 'Courier New',monospace;letter-spacing:.1em;text-transform:uppercase;
         background:none;border:1px solid #4A4036;color:var(--ink);padding:10px 12px;
         border-radius:2px;cursor:pointer;min-height:44px}
  button:disabled{opacity:.3}
  button.on{background:var(--ink);color:var(--bg);border-color:transparent}
  .spread{flex:1}
  select{font:600 10px 'Courier New',monospace;letter-spacing:.1em;text-transform:uppercase;
    background:#17130F;color:var(--ink);border:1px solid #4A4036;border-radius:2px;
    padding:10px 6px;min-height:44px}
  .rooms{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
  .rooms::-webkit-scrollbar{display:none}
  @media (max-width:700px){ .rooms{display:none} }
  @media (min-width:701px){ select.roomsel{display:none} }

  /* ---- immersive: the screen and nothing else ----
     The mockups are 412x915. On a phone the chrome around them was taking
     nearly half the height, so the design was being read at 55%. Immersive
     drops every bar, and a tap anywhere brings them back. */
  body.immersive header, body.immersive nav.bar{display:none}
  .exit{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:8px;z-index:20;
    display:none;background:rgba(11,10,8,.55);border-color:rgba(90,79,66,.6);color:var(--ink-2);
    min-height:36px;padding:7px 10px;font-size:12px;line-height:1;opacity:.75}
  .exit:active{opacity:1}
  /* A click inside an iframe never reaches this document, so immersive mode
     needs its own surface to be tapped on — without it, full screen is a
     one-way door on a touch device. */
  .tapcatch{position:fixed;inset:0;z-index:15;display:none}
  body.immersive .tapcatch{display:block}
  body.immersive .exit{display:block}
  .hint{position:fixed;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top,0px));
    z-index:20;display:none;font:500 9px 'Courier New',monospace;letter-spacing:.14em;
    text-transform:uppercase;color:var(--ink-2);background:rgba(11,10,8,.82);padding:7px 12px;
    border:1px solid var(--line);border-radius:2px;pointer-events:none;transition:opacity .5s}
  body.immersive .hint{display:block}

  /* ---- the notes drawer: the caption lifted out of the frame ---- */
  .notes{position:fixed;left:0;right:0;bottom:0;z-index:30;background:#12100C;
    border-top:1px solid var(--line);padding:16px 18px calc(18px + env(safe-area-inset-bottom,0px));
    transform:translateY(101%);transition:transform .28s ease-out;max-height:62svh;overflow:auto}
  .notes.open{transform:none}
  .notes p{font:400 14px/1.6 Georgia,serif;color:var(--ink-2)}
  .notes b{color:var(--ink)}
  .notes .close{margin-top:14px}
</style>
<body>

<header>
  <span class="mark">TOILE</span><span class="rule"></span>
  <h2 id="title"></h2>
  <span class="count" id="count"></span>
</header>

<main id="stage">
  <div class="frame" id="frame"><iframe id="f" title="screen"></iframe></div>
</main>

<div class="tapcatch" id="tapcatch"></div>
<button class="exit" id="exit" aria-label="Leave full screen" title="Leave full screen">✕</button>
<div class="hint" id="hint">Tap to show the controls</div>

<nav class="bar">
  <div class="walk">
    <button id="prev" aria-label="Previous screen">‹</button>
    <select id="pick" aria-label="Choose a screen"></select>
    <button id="next" aria-label="Next screen">›</button>
  </div>
  <div class="extras">
    <button id="stagebtn" hidden aria-pressed="false">See the moment</button>
    <button id="notesbtn" aria-expanded="false">Notes</button>
    <span class="spread"></span>
    <div class="rooms" id="rooms"></div>
    <select class="roomsel" id="roomsel" aria-label="Room"></select>
    <button id="full" aria-label="Full screen">Full screen</button>
  </div>
</nav>

<div class="notes" id="notes"><p id="notetext"></p>
  <button class="close" id="notesclose">Close</button></div>

<script>
const FLOW = ${JSON.stringify(files)};
const ROOMS = ${JSON.stringify(ROOMS)};
let i = 0, room = '', stageIdx = 0, contentH = 935;

const f = document.getElementById('f');
const pick = document.getElementById('pick');
const roomsel = document.getElementById('roomsel');

for (const [n, [slug, title]] of FLOW.entries()) pick.append(new Option(title, String(n)));
for (const [value, label] of ROOMS) {
  roomsel.append(new Option(label, value));
  const b = document.createElement('button');
  b.textContent = label; b.dataset.room = value;
  b.onclick = () => { room = value; paint(); };
  document.getElementById('rooms').append(b);
}

/* The mockup files lay their stages — the screen at rest, and the screen
   mid-art-moment — side by side, which at phone width means the second sits
   below the fold and is never seen. Show exactly one, and lift its caption
   out of the frame: a paragraph of prose inside the scaled iframe was
   costing the design a third of its height. */
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
  d.body.style.cssText += ';padding:0;display:block;background:transparent';
  const shown = stages[stageIdx];
  if (!shown) return;
  const cap = shown.querySelector('.caption-note');
  document.getElementById('notetext').innerHTML = cap ? cap.innerHTML : '';
  if (cap) cap.style.display = 'none';
  const phone = shown.querySelector('.phone');
  contentH = phone ? Math.ceil(phone.getBoundingClientRect().height) + 20 : 935;
}

function fit() {
  /* visualViewport is the part actually on screen — innerHeight still counts
     the strip behind a phone's retracting toolbar. */
  const vv = window.visualViewport;
  const vh = Math.min(window.innerHeight, vv ? vv.height : Infinity);
  const vw = Math.min(window.innerWidth, vv ? vv.width : Infinity);
  const imm = document.body.classList.contains('immersive');
  const head = imm ? 0 : document.querySelector('header').getBoundingClientRect().height;
  const bar = imm ? 0 : document.querySelector('nav.bar').getBoundingClientRect().height;
  const availH = Math.max(200, vh - head - bar - (imm ? 8 : 14));
  const availW = vw - (imm ? 6 : 14);
  const s = Math.min(availW / 412, availH / contentH);
  const frame = document.getElementById('frame');
  frame.style.transform = 'scale(' + s.toFixed(3) + ')';
  frame.style.width = '412px';
  frame.style.height = contentH + 'px';
  f.style.height = contentH + 'px';
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
  const [slug, title] = FLOW[i];
  document.getElementById('title').textContent = title;
  document.getElementById('count').textContent = (i + 1) + '/' + FLOW.length;
  pick.value = String(i);
  roomsel.value = room;
  [...document.querySelectorAll('.rooms button')].forEach(b => b.classList.toggle('on', b.dataset.room === room));
  document.getElementById('prev').disabled = i === 0;
  document.getElementById('next').disabled = i === FLOW.length - 1;
  const want = slug + '.html';
  if (!f.src.endsWith(want)) { f.src = want; f.onload = () => { showStage(); applyRoom(); fit(); }; }
  else { showStage(); applyRoom(); fit(); }
  location.hash = slug;
}

const go = n => { i = Math.min(FLOW.length - 1, Math.max(0, n)); stageIdx = 0; paint(); };
document.getElementById('prev').onclick = () => go(i - 1);
document.getElementById('next').onclick = () => go(i + 1);
pick.onchange = e => go(Number(e.target.value));
roomsel.onchange = e => { room = e.target.value; paint(); };
document.getElementById('stagebtn').onclick = () => { stageIdx = stageIdx === 0 ? 1 : 0; paint(); };

/* notes */
const notes = document.getElementById('notes');
const toggleNotes = on => {
  notes.classList.toggle('open', on);
  document.getElementById('notesbtn').setAttribute('aria-expanded', String(on));
};
document.getElementById('notesbtn').onclick = () => toggleNotes(!notes.classList.contains('open'));
document.getElementById('notesclose').onclick = () => toggleNotes(false);

/* immersive */
const hint = document.getElementById('hint');
function setImmersive(on) {
  document.body.classList.toggle('immersive', on);
  if (on) {
    toggleNotes(false);
    hint.style.opacity = '1';
    setTimeout(() => { hint.style.opacity = '0'; }, 2200);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } else if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  requestAnimationFrame(fit);
}
document.getElementById('full').onclick = () => setImmersive(true);
document.getElementById('exit').onclick = e => { e.stopPropagation(); setImmersive(false); };
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && document.body.classList.contains('immersive')) setImmersive(false);
  else requestAnimationFrame(fit);
});
/* A tap on the screen itself leaves immersive — the mockups are pictures,
   not controls, so a tap has nothing else to mean. The catcher sits over the
   iframe because iframe clicks do not bubble out to this document; swipes
   still work, so it forwards those to the walk. */
const catcher = document.getElementById('tapcatch');
let moved = false;
catcher.addEventListener('click', () => { if (!moved) setImmersive(false); moved = false; });
catcher.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; moved = false; }, { passive: true });
catcher.addEventListener('touchend', e => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) { moved = true; go(i + (dx < 0 ? 1 : -1)); }
  x0 = null;
}, { passive: true });

addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') go(i + 1);
  if (e.key === 'ArrowLeft') go(i - 1);
  if (e.key === 'f') setImmersive(!document.body.classList.contains('immersive'));
  if (e.key === 'Escape') { toggleNotes(false); setImmersive(false); }
});
addEventListener('resize', fit);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fit);

/* Swipe, because this is meant to be read on a phone. */
let x0 = null, y0 = null;
const st = document.getElementById('stage');
st.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
st.addEventListener('touchend', e => {
  if (x0 === null) return;
  const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) go(i + (dx < 0 ? 1 : -1));
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
