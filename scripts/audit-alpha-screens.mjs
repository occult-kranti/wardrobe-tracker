#!/usr/bin/env node
/**
 * A visual inventory of every route enabled in this alpha build, including
 * concrete detail routes and the main sheets that do not have their own URL.
 * All records are demo data; external requests are intercepted. The route
 * roster comes from the app, so new screens cannot silently leave the audit.
 * Usage: node scripts/audit-alpha-screens.mjs [origin] [output-directory]
 */
import { chromium } from 'playwright';
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sharedAliases } from '../packages/shared/aliases.mjs';

const ORIGIN = (process.argv[2] ?? 'http://localhost:4174').replace(/\/$/, '');
const OUTPUT = resolve(process.argv[3] ?? 'shots/alpha-review');
mkdirSync(OUTPUT, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'alpha-screen-audit-'));
await build({
  alias: sharedAliases(),
  entryPoints: {
    demo: fileURLToPath(new URL('../src/lib/demoData.ts', import.meta.url)),
    routes: fileURLToPath(new URL('../src/lib/routes.ts', import.meta.url)),
    guides: fileURLToPath(new URL('../src/lib/pageGuides.ts', import.meta.url)),
    dates: fileURLToPath(new URL('../packages/shared/dates.ts', import.meta.url)),
  },
  bundle: true, format: 'esm', outdir: scratch, outExtension: { '.js': '.mjs' }, logLevel: 'error',
});
const { buildDemoState } = await import(pathToFileURL(join(scratch, 'demo.mjs')).href);
const { ROUTES } = await import(pathToFileURL(join(scratch, 'routes.mjs')).href);
const { guidedPaths } = await import(pathToFileURL(join(scratch, 'guides.mjs')).href);
const { todayLocal, addDays } = await import(pathToFileURL(join(scratch, 'dates.mjs')).href);
const today = todayLocal();
const eventDate = addDays(today, 3);
const ACCOUNT = 'alpha-review';
const OTHER = 'alpha-neighbour';
const demo = buildDemoState();
demo.events = [{
  id: 'audit-event', name: 'Gallery opening', kind: 'celebration', startDate: eventDate,
  place: 'Boston', notes: 'An evening reception, with a short walk outside.',
  reservations: [{ id: 'audit-day', date: eventDate, label: 'Opening night', itemIds: [] }],
}];
const accounts = [
  { id: ACCOUNT, name: 'Sample wardrobe', handle: '@sample', monogram: 'SW', color: 'var(--color-accent)', createdAt: '2026-01-01', sync: 'device' },
  { id: OTHER, name: 'Sample neighbour', handle: '@neighbour', monogram: 'SN', color: 'var(--color-accent)', createdAt: '2026-01-01', sync: 'device' },
];
const look = {
  outfitId: demo.outfits[0].id, name: demo.outfits[0].name,
  pieces: demo.outfits[0].itemIds.map(id => demo.items.find(item => item.id === id)?.name).filter(Boolean),
};
const community = {
  posts: [{ id: 'audit-post', authorId: OTHER, date: today, caption: 'A sample look, shared on this device.', scope: { kind: 'everyone' }, look }],
  conversations: [{ id: 'audit-chat', memberIds: [ACCOUNT, OTHER], isGroup: false }],
  messages: [
    { id: 'audit-message-1', conversationId: 'audit-chat', authorId: OTHER, date: today, at: `${today}T09:00:00`, text: 'The wool layer would suit the evening.', look },
    { id: 'audit-message-2', conversationId: 'audit-chat', authorId: ACCOUNT, date: today, at: `${today}T09:01:00`, text: 'I will set it aside for the gallery.' },
  ],
  households: [], passes: [],
};
const concrete = {
  '/furniture/:id': `/furniture/${demo.furniture[0]?.id ?? 'missing-fixture'}`,
  '/chats/:id': '/chats/audit-chat',
  '/profile/:id': `/profile/${OTHER}`,
  '/rail/:id': `/rail/${demo.circle.profiles.find(profile => !profile.isMe)?.id ?? 'missing-fixture'}`,
  '/explore/:postId': '/explore/audit-post',
  '/story/:accountId': `/story/${OTHER}`,
};
const routeList = ROUTES.map(route => ({ ...route, actual: route.path.includes(':') ? concrete[route.path] : route.path }));
for (const route of routeList) {
  if (!route.actual) throw new Error(`The audit needs a concrete fixture for ${route.path}`);
}
const report = { generatedAt: new Date().toISOString(), origin: ORIGIN, viewports: [], routes: routeList, screens: [], failures: [], externalRequestsBlocked: [] };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

async function prepare(viewport, signedIn = true) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 700, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  const errors = [];
  page.on('pageerror', error => errors.push(String(error).split('\n')[0]));
  await context.addInitScript(({ record, accounts: registry, shared, paths, account, signedIn: enter }) => {
    if (!localStorage.getItem('alpha-audit-seeded')) {
      localStorage.setItem('toile-accounts', JSON.stringify(registry));
      localStorage.setItem('toile-session', JSON.stringify({ activeId: enter ? account : null }));
      for (const wardrobe of registry) localStorage.setItem(`wardrobe-tracker:${wardrobe.id}`, JSON.stringify(record));
      localStorage.setItem('toile-community', JSON.stringify(shared));
      localStorage.setItem('alpha-audit-seeded', 'yes');
    }
    localStorage.setItem('toile-tour', 'done');
    localStorage.setItem('toile-guides', JSON.stringify(paths));
    localStorage.setItem('almari-usage-consent', JSON.stringify({ state: 'declined', installId: null, decidedAt: new Date().toISOString(), version: 1 }));
  }, { record: demo, accounts, shared: community, paths: guidedPaths(), account: ACCOUNT, signedIn });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(ORIGIN).origin || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
    if (url.pathname.endsWith('/functions/v1/ai-proxy')) {
      const request = route.request().postDataJSON();
      const prompt = request.messages.find(message => message.role === 'user').content;
      const itemIds = JSON.parse(prompt).closet.slice(0, 3).map(item => item.id);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
        name: 'Gallery evening', itemIds, rationale: 'Pieces from this wardrobe, selected for the stated reception.',
        eventNote: 'The shapes suit a relaxed gallery opening.', weatherNote: 'A layer would help for the cool walk outside.', missing: [],
      }) }] }) });
    }
    report.externalRequestsBlocked.push(url.toString());
    return route.abort();
  });
  return { context, page, errors };
}

async function settle(page) {
  await page.locator('main, [role="main"], #root').first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
const slug = route => route === '/' ? 'today' : route.replace(/^\//, '').replace(/[^a-z\d-]+/gi, '-');
async function capture(session, name, size, expectedPath) {
  const { page, errors } = session;
  await settle(page);
  const survey = await page.evaluate(() => {
    const root = document.documentElement;
    const controls = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"]')];
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const label = element => element.getAttribute('aria-label') || element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 90) || element.id || element.tagName;
    return {
      hash: location.hash,
      headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map(element => element.textContent.trim()),
      excerpt: document.body.innerText.trim().replace(/\s+/g, ' ').slice(0, 240),
      contentHeight: root.scrollHeight,
      overflowPixels: Math.max(0, root.scrollWidth - root.clientWidth),
      overflowElements: [...document.querySelectorAll('main *, [role="dialog"] *')].filter(visible).filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.right > root.clientWidth + 1 || rect.left < -1;
      }).slice(0, 12).map(element => ({ element: element.tagName, label: label(element) })),
      shortTouchControls: controls.filter(visible).filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.height < 44 || rect.width < 44;
      }).slice(0, 30).map(element => ({ label: label(element), width: Math.round(element.getBoundingClientRect().width), height: Math.round(element.getBoundingClientRect().height) })),
      dialogs: document.querySelectorAll('[role="dialog"]').length,
    };
  });
  const base = `${name}-${size}`;
  await page.screenshot({ path: join(OUTPUT, `${base}.png`), animations: 'disabled' });
  if (survey.contentHeight > (size === 'mobile' ? 844 : 1000) + 30) {
    await page.screenshot({ path: join(OUTPUT, `${base}-full.png`), fullPage: true, animations: 'disabled' });
  }
  const entry = { name, viewport: size, expectedPath, ...survey, errors: errors.splice(0), screenshot: `${base}.png`, fullScreenshot: survey.contentHeight > (size === 'mobile' ? 844 : 1000) + 30 ? `${base}-full.png` : null };
  report.screens.push(entry);
  if (entry.overflowPixels > 1 || entry.errors.length || entry.excerpt.length < 12) report.failures.push({ name, viewport: size, overflowPixels: entry.overflowPixels, errors: entry.errors, empty: entry.excerpt.length < 12 });
  console.log(`${entry.overflowPixels > 1 || entry.errors.length ? 'FAIL' : 'PASS'} - ${base} (${entry.overflowPixels}px overflow, ${entry.errors.length} page errors)`);
}
async function extra(session, name, size, route, interaction) {
  try {
    await session.page.goto(`${ORIGIN}/#${route}`, { waitUntil: 'domcontentloaded' });
    await settle(session.page);
    await interaction(session.page);
    await capture(session, name, size, route);
  } catch (error) {
    report.failures.push({ name, viewport: size, error: error.message });
    console.log(`FAIL - ${name}-${size} (${error.message})`);
  } finally {
    // These sheets are deliberate screenshot states. Closing them is part of
    // this interaction: navigating to the same hash does not remount Events,
    // so an unclosed composer would cover the next day's controls.
    try {
      for (let remaining = 3; remaining > 0 && await session.page.getByRole('dialog').count(); remaining--) {
        const dialog = session.page.getByRole('dialog').last();
        await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
      }
      if (await session.page.getByRole('dialog').count()) throw new Error('A captured dialog did not close');
    } catch (error) {
      report.failures.push({ name: `${name}-close`, viewport: size, error: error.message });
      console.log(`FAIL - ${name}-close-${size} (${error.message})`);
    }
  }
}

try {
  for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 1000 }]) {
    report.viewports.push(viewport);
    const session = await prepare({ width: viewport.width, height: viewport.height });
    for (const route of routeList) {
      await extra(session, slug(route.actual), viewport.name, route.actual, async () => {});
    }
    await extra(session, 'closet-piece-detail', viewport.name, '/closet', async page => {
      await page.getByRole('button', { name: /^Open / }).first().click();
      await page.getByRole('dialog').waitFor();
    });
    await extra(session, 'events-new', viewport.name, '/events', async page => {
      await page.getByRole('button', { name: /^Add$|^Add an event$/ }).first().click();
      await page.getByRole('dialog').waitFor();
    });
    await extra(session, 'events-day-detail', viewport.name, '/events', async page => {
      await page.getByRole('button', { name: /Complete the look|Dress this day|Change the pieces/ }).first().click();
      await page.getByRole('dialog').waitFor();
    });
    await extra(session, 'events-hold-outfit', viewport.name, '/events', async page => {
      await page.getByRole('button', { name: 'Hold an outfit', exact: true }).first().click();
      await page.getByRole('dialog').waitFor();
    });
    await extra(session, 'events-style-result', viewport.name, `/events/style?event=audit-event&date=${eventDate}`, async page => {
      await page.getByLabel('Manual weather', { exact: true }).fill('Cool and dry, around 14 degrees C');
      await page.getByRole('checkbox', { name: /Send these details to AI/i }).check();
      await page.getByRole('button', { name: 'Suggest an outfit', exact: true }).click();
      await page.getByRole('heading', { name: 'Gallery evening', exact: true }).waitFor();
    });
    await session.context.close();

    const door = await prepare({ width: viewport.width, height: viewport.height }, false);
    await extra(door, 'arrival', viewport.name, '/open', async () => {});
    await extra(door, 'arrival-account', viewport.name, '/open', async page => {
      await page.getByRole('button', { name: /sign in, or make an account/i }).click();
    });
    await extra(door, 'arrival-wardrobes', viewport.name, '/open', async page => {
      await page.getByRole('button', { name: /Continue without an account/i }).click();
    });
    await door.context.close();
  }
} finally {
  await browser.close();
  report.externalRequestsBlocked = [...new Set(report.externalRequestsBlocked)];
  writeFileSync(join(OUTPUT, 'report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(OUTPUT, 'report.txt'), [
    `${report.screens.length} screens captured across ${routeList.length} enabled routes at mobile and desktop sizes.`,
    `${report.failures.length} failures; ${report.externalRequestsBlocked.length} external URLs blocked.`,
    ...report.failures.map(failure => JSON.stringify(failure)),
    '', 'Screens with controls under 44px (review findings, not automatic failures):',
    ...report.screens.filter(screen => screen.viewport === 'mobile' && screen.shortTouchControls.length).map(screen => `${screen.name}: ${screen.shortTouchControls.map(control => `${control.label} (${control.width}x${control.height})`).join('; ')}`),
  ].join('\n'));
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  writeFileSync(join(OUTPUT, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Alpha screen review</title><style>body{font:16px system-ui;background:#eee;margin:24px;color:#222}h1{font-size:24px}section{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px}figure{margin:0;padding:12px;background:white}img{width:100%;height:480px;object-fit:contain;object-position:top;background:#ddd}figcaption{margin-top:10px}a{color:#174e91}</style><h1>Alpha screen review</h1><p>${report.screens.length} screens. <a href="report.json">Detailed report</a>. ${report.failures.length} failures.</p>${['mobile', 'desktop'].map(size => `<h2>${size}</h2><section>${report.screens.filter(screen => screen.viewport === size).map(screen => `<figure><a href="${escape(screen.screenshot)}"><img loading="lazy" alt="${escape(screen.name)}" src="${escape(screen.screenshot)}"></a><figcaption>${escape(screen.name)} &middot; ${screen.overflowPixels}px overflow${screen.fullScreenshot ? ` &middot; <a href="${escape(screen.fullScreenshot)}">Full page</a>` : ''}</figcaption></figure>`).join('')}</section>`).join('')}</html>`);
}
console.log(`\nAudit written to ${OUTPUT}`);
process.exitCode = report.failures.length ? 1 : 0;
