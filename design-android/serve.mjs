// The design gallery: serves every mockup collection with a sidebar to switch
// screens, arrow-key navigation, and a live room-switcher that re-dresses any
// mockup into any of its pack's rooms (the mockups read their tokens from
// .phone[data-theme] or .phone[data-room]).
//
// Usage: node design-android/serve.mjs [port]   (default 4200)
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PORT = Number(process.argv[2] ?? 4200);
const REPO = new URL('../', import.meta.url).pathname;

/** Each collection is one folder of .html mockups, served under its own path. */
const COLLECTIONS = [
  {
    slug: 'mobile',
    name: 'Mobile revamp',
    blurb: 'the atelier pack — engraved furniture, wax seal, tag chips',
    dir: join(REPO, 'design-mobile/mockups'),
    rooms: [['', 'as designed'], ['atelier', 'Atelier'], ['pattern', 'Pattern room'], ['gilding', 'Gilding'], ['dyehouse', 'Dye house']],
    attr: 'data-room',
  },
  {
    slug: 'android',
    name: 'Android pack',
    blurb: 'four rooms — Mughal, Rajput, Gothic, Japanese',
    dir: join(REPO, 'design-android/mockups'),
    rooms: [['', 'as designed'], ['mughal', 'Mughal'], ['rajput', 'Rajput'], ['gothic', 'Gothic'], ['japanese', 'Japanese']],
    attr: 'data-theme',
  },
];

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg',
};

const VIEWER = `<!doctype html>
<meta charset="utf-8">
<title>Toile — design gallery</title>
<style>
  * { margin: 0; box-sizing: border-box; }
  body { display: flex; height: 100vh; background: #14100C; color: #EDE6D8; font: 14px Georgia, serif; }
  aside { width: 258px; flex: none; border-right: 1px solid #3A322A; padding: 18px 0; overflow-y: auto; }
  aside h1 { font-size: 17px; letter-spacing: .18em; padding: 0 18px 4px; }
  aside p.sub { font: italic 12px Georgia, serif; color: #A79B88; padding: 0 18px 14px; border-bottom: 1px solid #3A322A; }
  aside .coll { font: 700 11px 'Courier New', monospace; letter-spacing: .16em; color: #C79B4A; padding: 16px 18px 2px; text-transform: uppercase; }
  aside .coll small { display: block; font: italic 11px Georgia, serif; color: #7A705F; letter-spacing: 0; text-transform: none; margin-top: 2px; }
  aside h2 { font: 600 10px 'Courier New', monospace; letter-spacing: .16em; color: #8A8071; padding: 10px 18px 4px; text-transform: uppercase; }
  aside a { display: block; padding: 6px 18px; color: #EDE6D8; text-decoration: none; font-size: 13.5px; border-left: 2px solid transparent; }
  aside a:hover { background: #201A14; }
  aside a.on { border-left-color: #BE1231; background: #201A14; }
  main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .bar { flex: none; display: flex; align-items: center; gap: 9px; padding: 10px 16px; border-bottom: 1px solid #3A322A; flex-wrap: wrap; }
  .bar .name { font-size: 13px; color: #A79B88; flex: 1; font-style: italic; min-width: 120px; }
  .bar button { font: 600 10px 'Courier New', monospace; letter-spacing: .12em; text-transform: uppercase;
    background: none; border: 1px solid #4A4036; color: #EDE6D8; padding: 7px 12px; border-radius: 2px; cursor: pointer; }
  .bar button.on { background: #EDE6D8; color: #14100C; }
  .bar .hint { font: italic 11px Georgia; color: #7A705F; }
  iframe { flex: 1; border: 0; width: 100%; background: #0B0A08; }
</style>
<body>
<aside id="nav"><h1>TOILE</h1><p class="sub">Design gallery — every screen, every room.</p></aside>
<main>
  <div class="bar">
    <span class="name" id="name"></span>
    <span class="hint">room:</span>
    <span id="rooms"></span>
    <span class="hint">←/→ to change view</span>
  </div>
  <iframe id="frame"></iframe>
</main>
<script>
let colls = [], flat = [], current = 0, room = '';
const frame = document.getElementById('frame');

async function refresh() {
  const next = await (await fetch('/api/list')).json();
  if (JSON.stringify(next) !== JSON.stringify(colls)) { colls = next; build(); }
}
function build() {
  flat = colls.flatMap(c => c.files.map(f => ({ coll: c, file: f })));
  const nav = document.getElementById('nav');
  nav.querySelectorAll('.coll, h2, a').forEach(el => el.remove());
  for (const c of colls) {
    const h = document.createElement('div');
    h.className = 'coll';
    h.innerHTML = c.name + '<small>' + c.blurb + '</small>';
    nav.appendChild(h);
    const groups = {};
    for (const f of c.files) {
      const key = c.slug === 'android' ? f.split('-')[0] : 'screens';
      (groups[key] ??= []).push(f);
    }
    for (const [g, list] of Object.entries(groups)) {
      if (Object.keys(groups).length > 1) {
        const h2 = document.createElement('h2'); h2.textContent = g; nav.appendChild(h2);
      }
      for (const f of list) {
        const a = document.createElement('a');
        a.textContent = (c.slug === 'android' ? f.replace(/^[a-z]+-/, '') : f).replace('.html', '').replace(/-/g, ' ');
        a.href = '#' + c.slug + '/' + f;
        a.dataset.key = c.slug + '/' + f;
        a.onclick = e => { e.preventDefault(); show(flat.findIndex(x => x.coll.slug === c.slug && x.file === f)); };
        nav.appendChild(a);
      }
    }
  }
  mark();
}
function mark() {
  const cur = flat[current];
  if (!cur) return;
  const key = cur.coll.slug + '/' + cur.file;
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.key === key));
  document.getElementById('name').textContent = key;
  // the room buttons belong to the current collection
  const box = document.getElementById('rooms');
  box.innerHTML = '';
  for (const [value, label] of cur.coll.rooms) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.room = value;
    if (value === room) b.classList.add('on');
    b.onclick = () => { room = value; mark(); applyRoom(); };
    box.appendChild(b);
  }
}
function applyRoom() {
  try {
    const doc = frame.contentDocument;
    const attr = flat[current].coll.attr;
    if (!doc) return;
    doc.querySelectorAll('.phone').forEach(ph => {
      if (room) { if (!ph.dataset.prev) ph.dataset.prev = ph.getAttribute(attr) || ''; ph.setAttribute(attr, room); }
      else if (ph.dataset.prev !== undefined) ph.setAttribute(attr, ph.dataset.prev);
    });
  } catch { /* frame not ready */ }
}
function show(i) {
  if (!flat.length) return;
  current = (i + flat.length) % flat.length;
  const cur = flat[current];
  // a room chosen in one pack has no meaning in the next
  if (!cur.coll.rooms.some(r => r[0] === room)) room = '';
  frame.src = '/' + cur.coll.slug + '/' + cur.file;
  frame.onload = applyRoom;
  location.hash = cur.coll.slug + '/' + cur.file;
  mark();
}
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') show(current + 1);
  if (e.key === 'ArrowLeft') show(current - 1);
});
refresh().then(() => {
  const want = location.hash.slice(1);
  const i = flat.findIndex(x => x.coll.slug + '/' + x.file === want);
  show(i < 0 ? 0 : i);
});
setInterval(refresh, 4000);
</script>
</body>`;

createServer(async (req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  try {
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(VIEWER);
      return;
    }
    if (url === '/api/list') {
      const out = [];
      for (const c of COLLECTIONS) {
        const files = (await readdir(c.dir).catch(() => [])).filter(f => f.endsWith('.html')).sort();
        if (files.length) out.push({ slug: c.slug, name: c.name, blurb: c.blurb, rooms: c.rooms, attr: c.attr, files });
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(out));
      return;
    }
    // /<collection-slug>/<file>, with assets resolved inside that collection
    const [, slug, ...rest] = url.split('/');
    const coll = COLLECTIONS.find(c => c.slug === slug);
    if (!coll) throw new Error('no collection');
    const file = join(coll.dir, rest.join('/'));
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(PORT, () => {
  console.log(`design gallery at http://localhost:${PORT}/`);
  for (const c of COLLECTIONS) console.log(`  /${c.slug}/ → ${c.dir}`);
});
