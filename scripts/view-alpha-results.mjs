/** Local review only: serves recorded synthetic results and screenshots, never the workspace. */
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { basename, dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] ?? 4176);
const scratch = mkdtempSync(join(tmpdir(), 'almari-review-art-'));
await build({ alias: sharedAliases(), entryPoints: [join(ROOT, 'src/components/art.tsx')], bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', outfile: join(scratch, 'art.mjs'), logLevel: 'error' });
const { GarmentPlate } = await import(pathToFileURL(join(scratch, 'art.mjs')));
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const wardrobe = {
  'synthetic-shirt': ['White Oxford shirt', 'tops', 'white'],
  'synthetic-trousers': ['Navy straight trousers', 'bottoms', 'navy'],
  'synthetic-shoes': ['Black lace-up shoes', 'shoes', 'black'],
  'synthetic-shell': ['Navy hooded rain shell', 'outerwear', 'navy'],
  'synthetic-knit': ['Grey crewneck sweater', 'layers', 'grey'],
  'synthetic-tee': ['White plain tee', 'tops', 'white'],
};
const sites = [
  ['Operator AI portal', 'portal/'],
  ['Published alpha', ''], ['Alpha tester guide', 'alpha.html'], ['Social showcase', 'showcase/'],
  ['V2 design', 'v2/'], ['Mobile design gallery', 'mobile_version_v1/'],
  ['Team tracker', 'company/tracker.html'], ['Build board', 'company/build.html'], ['Release status', 'company/ship.html'],
];

function roseGallery() {
  const report = JSON.parse(readFileSync(join(ROOT, 'shots/rose-atelier/report.json'), 'utf8'));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rose atelier and Outfits</title><style>body{font:16px/1.5 system-ui;margin:0;background:#F8E8E4;color:#34262C}main{max-width:1300px;margin:auto;padding:24px}h1{font:36px/1.15 Georgia,serif}a{color:#7E485F;text-underline-offset:3px}nav{display:flex;flex-wrap:wrap;gap:12px 24px}nav a{min-height:44px;display:inline-flex;align-items:center}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px}figure{margin:0;padding:14px;background:#FFF8F5;border:1px solid #B88378;border-bottom-color:#A5ADB5}img{display:block;width:100%;height:560px;object-fit:contain;object-position:top}figcaption{margin-top:12px}</style></head><body><main><h1>Rose atelier and Outfits</h1><p>The new warm pink theme, Outfits tab, Profile in More, and Calendar shortcut. These captures use a synthetic wardrobe.</p><nav><a href="http://127.0.0.1:4174/#/outfits">Open the updated app</a><a href="/screens/">All alpha screens</a><a href="/">Live AI comparison</a><a href="/rose/report.json">Test report</a></nav><p>${report.scenarios.filter(row => row.status === 'PASS').length} focused scenarios passed. Recorded ${escape(report.checkedAt)}.</p><section>${report.screenshots.map(screen => { const file = escape(basename(screen.path)); return `<figure><a href="/rose/${file}"><img src="/rose/${file}" alt="${escape(screen.name)}" loading="lazy"></a><figcaption>${escape(screen.name)} · ${screen.viewport.width} × ${screen.viewport.height}</figcaption></figure>`; }).join('')}</section></main></body></html>`;
}

function workbenchGallery() {
  const report = JSON.parse(readFileSync(join(ROOT, 'shots/portal-workbench-live/report.json'), 'utf8'));
  const latest = [...new Map(report.results.map(row => [`${row.feature}:${row.requestedModel}`, row])).values()];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Live model comparison</title><style>body{font:16px/1.5 system-ui;background:#f8e8e4;color:#34262c;margin:0}main{max-width:1100px;margin:auto;padding:24px}h1,h2{font-family:Georgia,serif}a{color:#7e485f}nav{display:flex;flex-wrap:wrap;gap:16px}nav a{min-height:44px;display:flex;align-items:center}img{width:100%;max-width:540px;border:1px solid #b88378}article{background:#fff8f5;padding:24px;border:1px solid #b88378;border-bottom-color:#a5adb5;margin:20px 0;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px}summary{cursor:pointer;min-height:44px;display:flex;align-items:center}</style></head><body><main><h1>Live model comparison</h1><p>Actual provider replies to a synthetic garment illustration and a synthetic event case. Prices are estimates from returned usage. These tests do not establish invoice charges or styling quality.</p><nav><a href="http://127.0.0.1:4177/">Open the local testing portal</a><a href="/rose/">Theme and Outfits</a><a href="/screens/">All alpha screens</a><a href="/workbench/report.json">Recorded responses and usage</a></nav><p>${escape(report.authScope)}</p><img src="/workbench/synthetic-input.png" alt="Synthetic test illustration: white tee, navy trousers and black shoes">${latest.map(row => `<article><h2>${escape(row.requestedModel)} · ${escape(row.feature)}</h2><p>${escape(row.analysis?.summary ?? row.error)}</p><p>${escape(row.cost?.label ?? 'Cost unavailable')}${row.latencyMs ? ` · ${row.latencyMs} ms` : ''}</p>${row.usage ? `<p>${escape(row.usage.inputTokens)} input tokens · ${escape(row.usage.outputTokens)} output tokens</p>` : ''}${row.analysis?.pieces?.length ? `<ul>${row.analysis.pieces.map(piece => `<li>${escape(piece.name)} — ${escape(piece.description)}</li>`).join('')}</ul>` : ''}${row.analysis?.suggestion ? `<p><strong>${escape(row.analysis.suggestion.name)}</strong></p><p>${escape(row.analysis.suggestion.rationale)}</p><p>${escape(row.analysis.suggestion.weatherNote)}</p>` : ''}${row.cost ? `<p><a href="${escape(row.cost.sourceUrl)}" target="_blank" rel="noreferrer">Price source</a> · checked ${escape(row.cost.verifiedAt)}</p>` : ''}<details><summary>Answer and validation</summary><pre>${escape(row.text ?? '')}\n${escape(JSON.stringify(row.analysis?.issues ?? [], null, 2))}</pre></details></article>`).join('')}<p>Recorded ${escape(report.checkedAt)}. The input is drawn test material, not a private wardrobe. The portal itself keeps new test material in memory until an explicit export.</p></main></body></html>`;
}

function resultCard(suggestion, label) {
  return `<article class="paper"><p class="eyebrow">${escape(label)}</p><h2>${escape(suggestion.name)}</h2><div class="pieces">${suggestion.itemIds.map(id => {
    const [name, categoryId, color] = wardrobe[id] ?? [id, 'tops', 'grey'];
    return `<figure><div class="garment">${renderToStaticMarkup(createElement(GarmentPlate, { name, categoryId, color }))}</div><figcaption>${escape(name)}</figcaption></figure>`;
  }).join('')}</div><p>${escape(suggestion.rationale)}</p><h3>For the event</h3><p>${escape(suggestion.eventNote)}</p><h3>For the weather</h3><p>${escape(suggestion.weatherNote)}</p>${suggestion.missing.length ? `<h3>Closet limitations</h3><ul>${suggestion.missing.map(gap => `<li>${escape(gap)}</li>`).join('')}</ul>` : ''}</article>`;
}

function home() {
  const result = JSON.parse(readFileSync(join(ROOT, 'shots/event-stylist-live.json'), 'utf8'));
  const styles = readdirSync(join(ROOT, 'dist/assets')).filter(file => file.endsWith('.css'));
  return `<!doctype html><html lang="en" data-theme="gilt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Almari — live event styling results</title>${styles.map(file => `<link rel="stylesheet" href="/assets/${escape(file)}">`).join('')}
<style>body{margin:0;background:var(--color-bg);color:var(--color-text);font-family:Switzer,system-ui,sans-serif;font-size:15px;line-height:1.55}main{max-width:1180px;margin:auto;padding:32px 24px 64px}.eyebrow{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--color-text-2);margin:0 0 8px}h1,h2{font-family:Fraunces,Georgia,serif;font-weight:500;line-height:1.15}h1{font-size:clamp(30px,5vw,48px);margin:8px 0 16px}h2{font-size:28px;margin:8px 0 20px}h3{font-size:15px;font-weight:600;margin:20px 0 6px}p{margin:0 0 12px}.intro{max-width:70ch}.actions{display:flex;flex-wrap:wrap;gap:12px;margin:22px 0}.action{min-height:44px;padding:10px 16px;display:inline-flex;align-items:center;border:1px solid var(--color-border);border-radius:2px;text-decoration:none;color:var(--color-text)}.primary{background:var(--color-ink-fill);color:var(--color-on-ink)}a{color:var(--color-accent);text-underline-offset:3px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.paper{padding:24px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:2px;min-width:0}.brief{margin:24px 0}.brief dl{display:grid;grid-template-columns:120px 1fr;gap:8px 16px}.brief dt{color:var(--color-text-2)}.brief dd{margin:0}.change{border-left:2px solid var(--color-accent);padding:12px 18px;margin:24px 0;background:var(--color-surface)}.pieces{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:20px}figure{margin:0;min-width:0}.garment{background:var(--color-mat);aspect-ratio:3/4;max-height:230px;border:1px solid var(--color-border);overflow:hidden}.garment>svg{width:100%;height:100%}figcaption{font-size:13px;margin-top:8px}li{margin:6px 0}.links{margin-top:32px}.links nav{display:flex;flex-wrap:wrap;gap:8px 20px}.links a{display:inline-flex;align-items:center;min-height:44px}footer{margin-top:32px;font-size:13px;color:var(--color-text-2)}@media(max-width:720px){main{padding:24px 16px 48px}.grid{grid-template-columns:1fr}.paper{padding:20px}.brief dl{grid-template-columns:1fr;gap:2px}.brief dd{margin-bottom:12px}.garment{max-height:210px}}</style></head><body><main>
<p class="eyebrow">Almari · Alpha review</p><h1>What should I wear?</h1><p class="intro">A real outfit suggestion and refinement from ${escape(result.model)}, using a sample closet and a live city forecast. The garment drawings illustrate the synthetic records used for this test.</p>
<div class="actions"><a class="action" href="/rose/">New rose theme and Outfits</a><a class="action" href="/workbench/">Live model and image comparison</a><a class="action primary" href="http://127.0.0.1:4174/#/events/style">Try the event stylist</a><a class="action" href="/screens/">Browse all 58 screen captures</a><a class="action" href="/live.json">Read the recorded result</a></div><p class="intro">The interactive app opens your current wardrobe, or offers sample wardrobes on its welcome screen. AI is contacted only after you agree and request an outfit.</p>
<section class="paper brief"><p class="eyebrow">The request</p><dl><dt>Event</dt><dd>${escape(result.brief.event)}</dd><dt>When</dt><dd>${escape(result.brief.date)} at ${escape(result.brief.time)} · ${escape(result.weather.timezone)}</dd><dt>Dress code</dt><dd>${escape(result.brief.dressCode)}</dd><dt>Preference</dt><dd>${escape(result.brief.preferences)}</dd><dt>Forecast</dt><dd>${escape(result.weather.summary)}</dd></dl></section>
<div class="change"><strong>Requested change</strong><p>${escape(result.refinement)}</p></div><div class="grid">${resultCard(result.suggestion, 'First suggestion')}${resultCard(result.updated, 'Updated outfit')}</div>
<section class="paper links"><h2>Hosted versions and boards</h2><p>The alpha release includes event styling with Fable 5.1 and the separate operator workbench. The deployment workflow records the current published build.</p><nav>${sites.map(([label, path]) => `<a href="https://occult-kranti.github.io/wardrobe-tracker/${path}" target="_blank" rel="noreferrer">${label}</a>`).join('')}</nav><p><a href="https://wvupsqfevlrmhqfjreyx.supabase.co/functions/v1/ai-proxy">AI relay endpoint</a> · an API that accepts POST requests, not a webpage.</p></section>
<footer>Live result recorded ${escape(result.checkedAt)}. The screenshot gallery uses mocked replies to test screen layouts. No personal wardrobe was used for either.</footer></main></body></html>`;
}

const types = { '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.html': 'text/html', '.json': 'application/json', '.txt': 'text/plain' };
createServer((req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${PORT}`).pathname);
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    if (pathname === '/') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(req.method === 'HEAD' ? '' : home()); return; }
    if (pathname === '/rose/' || pathname === '/rose') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(req.method === 'HEAD' ? '' : roseGallery()); return; }
    if (pathname === '/workbench/' || pathname === '/workbench') { res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(req.method === 'HEAD' ? '' : workbenchGallery()); return; }
    if (pathname === '/live.json') { res.setHeader('content-type', 'application/json'); res.end(req.method === 'HEAD' ? '' : readFileSync(join(ROOT, 'shots/event-stylist-live.json'))); return; }
    const routes = [['/workbench/', 'shots/portal-workbench-live'], ['/screens/', 'shots/alpha-review'], ['/rose/', 'shots/rose-atelier'], ['/assets/', 'dist/assets'], ['/fonts/', 'dist/fonts']];
    for (const [prefix, directory] of routes) {
      if (!pathname.startsWith(prefix)) continue;
      const file = pathname.slice(prefix.length) || 'index.html';
      const base = resolve(ROOT, directory);
      const full = resolve(base, file);
      if (file !== basename(file) || !full.startsWith(`${base}${sep}`) || !types[extname(file)] || !existsSync(full)) break;
      res.setHeader('content-type', types[extname(file)]);
      res.end(req.method === 'HEAD' ? '' : readFileSync(full)); return;
    }
    res.writeHead(404).end('Not found');
  } catch { res.writeHead(500).end('The recorded results are not ready. Run the live event stylist test first.'); }
}).listen(PORT, '127.0.0.1', () => console.log(`Live results: http://127.0.0.1:${PORT}/\nScreen gallery: http://127.0.0.1:${PORT}/screens/\nApp: http://127.0.0.1:4174/#/events/style`));

process.on('exit', () => {
  if (dirname(scratch) === resolve(tmpdir()) && basename(scratch).startsWith('almari-review-art-')) rmSync(scratch, { recursive: true, force: true });
});
