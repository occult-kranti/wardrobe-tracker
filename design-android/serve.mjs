// The design-pack gallery: serves the Android mockups with a sidebar to
// switch screens, arrow-key navigation, and a live room-switcher that
// re-themes any mockup into any of the four rooms (the mockups all read
// their tokens from .phone[data-theme]).
//
// Usage: node design-android/serve.mjs [port]   (default 4200)
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const PORT = Number(process.argv[2] ?? 4200);
const ROOT = new URL('./mockups/', import.meta.url).pathname;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const VIEWER = `<!doctype html>
<meta charset="utf-8">
<title>Toile Android — design pack</title>
<style>
  * { margin: 0; box-sizing: border-box; }
  body { display: flex; height: 100vh; background: #14100C; color: #EDE6D8; font: 14px Georgia, serif; }
  aside { width: 250px; flex: none; border-right: 1px solid #3A322A; padding: 18px 0; overflow-y: auto; }
  aside h1 { font-size: 17px; letter-spacing: .18em; padding: 0 18px 4px; }
  aside p.sub { font: italic 12px Georgia, serif; color: #A79B88; padding: 0 18px 14px; border-bottom: 1px solid #3A322A; }
  aside h2 { font: 600 10px 'Courier New', monospace; letter-spacing: .16em; color: #A79B88; padding: 14px 18px 6px; text-transform: uppercase; }
  aside a { display: block; padding: 7px 18px; color: #EDE6D8; text-decoration: none; font-size: 13.5px; border-left: 2px solid transparent; }
  aside a:hover { background: #201A14; }
  aside a.on { border-left-color: #BE1231; background: #201A14; }
  main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .bar { flex: none; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #3A322A; }
  .bar .name { font-size: 13px; color: #A79B88; flex: 1; font-style: italic; }
  .bar button { font: 600 10px 'Courier New', monospace; letter-spacing: .12em; text-transform: uppercase;
    background: none; border: 1px solid #4A4036; color: #EDE6D8; padding: 7px 12px; border-radius: 2px; cursor: pointer; }
  .bar button.on { background: #EDE6D8; color: #14100C; }
  .bar .hint { font: italic 11px Georgia; color: #7A705F; }
  iframe { flex: 1; border: 0; width: 100%; background: #17130F; }
</style>
<body>
<aside id="nav"><h1>TOILE</h1><p class="sub">Android design pack — every screen, every room.</p></aside>
<main>
  <div class="bar">
    <span class="name" id="name"></span>
    <span class="hint">room override:</span>
    <button data-room="">as designed</button>
    <button data-room="mughal">Mughal</button>
    <button data-room="rajput">Rajput</button>
    <button data-room="gothic">Gothic</button>
    <button data-room="japanese">Japanese</button>
    <span class="hint">←/→ to change view</span>
  </div>
  <iframe id="frame"></iframe>
</main>
<script>
let files = [], current = 0, room = '';
const frame = document.getElementById('frame');

async function refresh() {
  const r = await fetch('/api/list');
  const next = await r.json();
  if (JSON.stringify(next) !== JSON.stringify(files)) { files = next; renderNav(); }
}
function renderNav() {
  const nav = document.getElementById('nav');
  nav.querySelectorAll('h2, a').forEach(el => el.remove());
  const groups = {};
  for (const f of files) {
    const theme = f.split('-')[0];
    (groups[theme] ??= []).push(f);
  }
  for (const [theme, list] of Object.entries(groups)) {
    const h = document.createElement('h2');
    h.textContent = theme;
    nav.appendChild(h);
    for (const f of list) {
      const a = document.createElement('a');
      a.textContent = f.replace(/^[a-z]+-/, '').replace('.html', '').replace(/-/g, ' ');
      a.href = '#' + f;
      a.dataset.file = f;
      a.onclick = e => { e.preventDefault(); show(files.indexOf(f)); };
      nav.appendChild(a);
    }
  }
  mark();
}
function mark() {
  document.querySelectorAll('#nav a').forEach(a =>
    a.classList.toggle('on', a.dataset.file === files[current]));
  document.getElementById('name').textContent = files[current] ?? '';
}
function applyRoom() {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('.phone').forEach(ph => {
      if (room) { ph.dataset.prev ??= ph.dataset.theme; ph.dataset.theme = room; }
      else if (ph.dataset.prev) { ph.dataset.theme = ph.dataset.prev; }
    });
  } catch { /* frame not ready */ }
}
function show(i) {
  if (!files.length) return;
  current = (i + files.length) % files.length;
  frame.src = '/' + files[current];
  frame.onload = applyRoom;
  location.hash = files[current];
  mark();
}
document.querySelectorAll('.bar button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.bar button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    room = b.dataset.room;
    applyRoom();
  };
});
document.querySelector('.bar button').classList.add('on');
addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') show(current + 1);
  if (e.key === 'ArrowLeft') show(current - 1);
});
refresh().then(() => {
  const want = location.hash.slice(1);
  show(Math.max(0, files.indexOf(want)));
});
setInterval(refresh, 4000);
</script>
</body>`;

createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(VIEWER);
    } else if (url === '/api/list') {
      const all = (await readdir(ROOT)).filter(f => f.endsWith('.html')).sort();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(all));
    } else {
      const file = join(ROOT, url.slice(1));
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    }
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(PORT, () => console.log(`design gallery at http://localhost:${PORT}/`));
