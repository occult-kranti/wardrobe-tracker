#!/usr/bin/env node
/**
 * The company surfaces: the plan page and the workroom.
 *
 * Serves company/ and the app's self-hosted fonts straight from the source
 * tree, so this suite needs no build and no separately-started server — the
 * two pages are hand-written static files with no build step of their own.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
};
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0]);
  // /company/* comes from the source folder; /fonts/* from public/.
  const file = path.startsWith('/fonts/')
    ? join(ROOT, 'public', path)
    : join(ROOT, path.replace(/^\/+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(4180, '127.0.0.1', r));

const TRACKER = 'http://127.0.0.1:4180/company/tracker.html';
let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log('PASS -', name, detail); }
  else { fail++; console.log('FAIL -', name, detail); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(TRACKER, { waitUntil: 'networkidle' });

// --- render -------------------------------------------------------------
const taskCount = await page.locator('.task').count();
check('tasks render', taskCount > 50, `${taskCount} tasks`);
const phases = await page.locator('.phase').count();
const declared = await page.evaluate(() => GROUPS.length);
check('every declared phase renders', phases === declared, `${phases} of ${declared}`);
check('modal is hidden at rest', !(await page.locator('#modal').isVisible()));
check('bulkbar hidden at rest', !(await page.locator('#bulkbar').isVisible()));
check('the two meetings are present',
  (await page.getByText('Meet Kunjal').count()) === 2 &&
  (await page.getByText('Meet Kunjal, Nimesh and Raksha').count()) === 1);
check('current focus is pinned', (await page.locator('.pin').count()) >= 2);
check('new task disabled when signed out', await page.locator('#newTaskBtn').isDisabled());

// --- seed integrity -----------------------------------------------------
// A task filed under a phase that does not exist renders nowhere at all, and a
// tag or assignee that is not in the roster silently cannot be filtered for.
const seed = await page.evaluate(() => {
  const groups = new Set(GROUPS.map(g => g.id));
  const people = new Set(PEOPLE.map(p => p.id));
  const tags = new Set(TAGS);
  const titles = SEED_TASKS.map(t => t.t);
  return {
    badGroup: SEED_TASKS.filter(t => !groups.has(t.g)).map(t => t.t),
    badPerson: SEED_TASKS.flatMap(t => (t.a || []).filter(a => !people.has(a))),
    badTag: SEED_TASKS.flatMap(t => (t.tags || []).filter(x => !tags.has(x))),
    dupes: titles.filter((t, i) => titles.indexOf(t) !== i),
    noWhy: SEED_TASKS.filter(t => !t.why).map(t => t.t),
    badDate: SEED_TASKS.filter(t => t.due && !/^\d{4}-\d{2}-\d{2}$/.test(t.due)).map(t => t.t),
    orphanDep: SEED_TASKS.filter(t => t.dep && !titles.some(x => x.includes(t.dep))).map(t => t.t),
  };
});
check('every task sits in a real phase', seed.badGroup.length === 0, seed.badGroup.join(', '));
check('every assignee is on the roster', seed.badPerson.length === 0, seed.badPerson.join(', '));
check('every tag is a declared tag', seed.badTag.length === 0, seed.badTag.join(', '));
check('no duplicate task titles', seed.dupes.length === 0, seed.dupes.join(', '));
check('every task says why it exists', seed.noWhy.length === 0, seed.noWhy.join(', '));
check('every due date is well formed', seed.badDate.length === 0, seed.badDate.join(', '));
check('every dependency names a real task', seed.orphanDep.length === 0, seed.orphanDep.join(', '));

// --- sign in ------------------------------------------------------------
await page.locator('#signIn').click();
check('sign-in sheet opens', await page.locator('#modal').isVisible());
await page.locator('[data-who="kunjal"]').click();
check('signed in as Kunjal', (await page.locator('#who').innerText()).includes('Kunjal'));
check('new task enabled after sign-in', !(await page.locator('#newTaskBtn').isDisabled()));

// --- open a task and edit ----------------------------------------------
await page.locator('.task-body').first().click();
check('drawer opens', await page.locator('#drawer').isVisible());
await page.locator('#drStatus [data-status="ongoing"]').click();
await page.waitForTimeout(150);
check('status set to ongoing', (await page.locator('.task').first().getAttribute('class')).includes('ongoing'));

await page.locator('.task-body').first().click();
await page.locator('#drPeople [data-person="nimesh"]').click();
await page.waitForTimeout(150);
await page.locator('.task-body').first().click();
check('assignee added', await page.locator('#drPeople [data-person="nimesh"].on').count() === 1);

await page.locator('#drTags [data-tag="design"]').click();
await page.waitForTimeout(150);
await page.locator('.task-body').first().click();
check('tag toggled', await page.locator('#drTags [data-tag="design"].on').count() === 1);

await page.locator('#drComment').fill('Agenda: roles, equity, the four name collisions.');
await page.locator('#drAddComment').click();
await page.waitForTimeout(200);
await page.locator('.task-body').first().click();
check('comment saved and attributed', (await page.locator('.comment').first().innerText()).includes('Kunjal'));

await page.locator('#drDue').fill('2026-08-16');
await page.locator('#drDue').dispatchEvent('change');
await page.waitForTimeout(150);
check('due date edited', (await page.locator('.task').first().innerText()).includes('16 Aug'));
await page.locator('#drClose').click();
check('drawer closes', !(await page.locator('#drawer').isVisible()));

// --- filters, modes, select --------------------------------------------
await page.locator('[data-filter="person:nimesh"]').click();
await page.waitForTimeout(150);
const nimeshTasks = await page.locator('.task').count();
check('filter by person narrows the board', nimeshTasks >= 1 && nimeshTasks < taskCount, `${nimeshTasks} shown`);
await page.locator('[data-filter="person:all"]').click();

await page.locator('#modeTimeline').click();
await page.waitForTimeout(150);
check('timeline renders dated rows', (await page.locator('.tl-row').count()) > 5);
await page.locator('#modePeople').click();
await page.waitForTimeout(150);
check('people view renders a card per person', (await page.locator('.person-card').count()) === 4);
await page.locator('#modeBoard').click();
await page.waitForTimeout(150);

await page.locator('[data-pick]').first().check();
await page.waitForTimeout(150);
check('bulk bar appears on selection', await page.locator('#bulkbar').isVisible());
await page.locator('#bulkDone').click();
await page.waitForTimeout(200);
check('bulk status applied', (await page.locator('.task.done').count()) >= 1);

await page.locator('#search').fill('trademark');
await page.waitForTimeout(200);
const searched = await page.locator('.task').count();
check('search narrows the board', searched >= 1 && searched < taskCount, `${searched} shown`);
await page.locator('#search').fill('');
await page.waitForTimeout(150);

// --- shareable views ----------------------------------------------------
await page.locator('[data-filter="status:blocked"]').click();
await page.locator('[data-filter="tag:legal"]').click();
await page.waitForTimeout(150);
check('the view is written into the URL', page.url().includes('status=blocked') && page.url().includes('tag=legal'), page.url().split('?')[1] || '');
const sharedUrl = page.url();
await page.locator('[data-filter="status:all"]').click();
await page.locator('[data-filter="tag:all"]').click();
await page.goto(sharedUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(250);
check('a shared URL restores the filters', (await page.locator('[data-filter="status:blocked"]').getAttribute('class')).includes('on') &&
  (await page.locator('[data-filter="tag:legal"]').getAttribute('class')).includes('on'));
await page.goto(TRACKER, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);

// --- persistence --------------------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
check('identity persists across reload', (await page.locator('#who').innerText()).includes('Kunjal'));
check('edits persist across reload', (await page.locator('.task.done').count()) >= 1);
check('comment persists across reload', (await page.locator('.cm').count()) >= 1);
check('sync state says device-only', (await page.locator('#syncState').innerText()).toLowerCase().includes('device'));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

// --- mobile -------------------------------------------------------------
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(TRACKER, { waitUntil: 'networkidle' });
const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('no horizontal overflow at 390px', overflow <= 1, `${overflow}px`);

// --- the plan page ------------------------------------------------------
const PLAN = 'http://127.0.0.1:4180/company/index.html';
const d = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const planErrors = [];
d.on('pageerror', e => planErrors.push(String(e)));
await d.goto(PLAN, { waitUntil: 'networkidle' });

check('plan page has exactly one h1', (await d.locator('h1').count()) === 1);
check('the wordmark is set in caps', (await d.locator('.wordmark').evaluate(el => getComputedStyle(el).textTransform)) === 'uppercase');
check('exactly one primary button', (await d.locator('.masthead-links .btn').count()) === 1);
check('the workroom is linked from the plan', (await d.locator('a[href="tracker.html"]').count()) >= 1);
check('no exclamation points in the copy', !(await d.locator('body').innerText()).includes('!'));
check('carmine is not spent on the veto list',
  (await d.locator('.veto-list li').first().evaluate(el => getComputedStyle(el, '::before').color)) !== 'rgb(190, 18, 49)');
check('plan page throws nothing', planErrors.length === 0, planErrors.slice(0, 2).join(' | '));

const pm = await browser.newPage({ viewport: { width: 390, height: 844 } });
await pm.goto(PLAN, { waitUntil: 'networkidle' });
const planOverflow = await pm.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check('plan page has no horizontal overflow at 390px', planOverflow <= 1, `${planOverflow}px`);
const revenueVisible = await pm.evaluate(() => {
  const cell = document.querySelector('table tbody tr td:last-child');
  if (!cell) return false;
  const r = cell.getBoundingClientRect();
  return r.right <= window.innerWidth + 1 && r.width > 0;
});
check('the annual-revenue column is readable at 390px', revenueVisible);

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
