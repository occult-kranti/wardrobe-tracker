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
    let body = await readFile(file);
    /* The boards now carry live Supabase credentials, and this suite signs in,
       marks tasks done and posts comments. Served as-is, every test run would
       push that straight into the team's real board. Blank the credentials on
       the way out so the suite exercises the local path, deterministically,
       against nobody's data but its own. Shared mode is verified separately,
       against the deployed site, by hand. */
    if (/(tracker|build)\.js$/.test(file)) {
      body = Buffer.from(String(body)
        .replace(/url: 'https:\/\/[^']*'/, "url: ''")
        .replace(/key: 'ey[^']*'/, "key: ''"));
    }
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

// --- the now view -------------------------------------------------------
// The board opens on "what is happening", not "what is the plan".
check('the board opens on Now', (await page.locator('#modeNow').getAttribute('class')).includes('on'));
const lanes = await page.locator('.lane').count();
check('now shows a lane per person with open work', lanes >= 2, `${lanes} lanes`);
check('now dates itself', (await page.locator('.now-date').count()) === 1);

await page.locator('#modeBoard').click();
await page.waitForTimeout(150);

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
await page.locator('#fPerson').selectOption('nimesh');
await page.waitForTimeout(150);
const nimeshTasks = await page.locator('.task').count();
check('filter by person narrows the board', nimeshTasks >= 1 && nimeshTasks < taskCount, `${nimeshTasks} shown`);

// A filtered board and an empty board look the same; the rail is the difference.
check('the active rail appears when a filter is on', await page.locator('#activeRail').isVisible());
check('the rail names the filter', (await page.locator('.act').first().innerText()).includes('Nimesh'));
// innerText returns the text as rendered, and this row is uppercased in CSS.
check('the rail counts what is hidden',
  (await page.locator('.shown-count').innerText()).toLowerCase().includes(`of ${taskCount}`));
await page.locator('.act[data-drop="person"]').click();
await page.waitForTimeout(150);
check('a rail chip is its own undo', (await page.locator('.task').count()) === taskCount);
check('the rail hides itself when nothing is filtered', !(await page.locator('#activeRail').isVisible()));

// --- grouping -----------------------------------------------------------
// The same tasks, cut a different way. Sections must change; totals must not.
await page.locator('#fGroupBy').selectOption('person');
await page.waitForTimeout(150);
const byPerson = await page.locator('.phase').count();
check('grouping by person re-sections the board', byPerson >= 2 && byPerson <= 5, `${byPerson} sections`);
await page.locator('#fGroupBy').selectOption('status');
await page.waitForTimeout(150);
const byStatus = await page.locator('.phase').count();
check('grouping by status re-sections the board', byStatus >= 2 && byStatus <= 4, `${byStatus} sections`);
check('regrouping never loses a task', (await page.locator('.task').count()) === taskCount);
await page.locator('#fGroupBy').selectOption('due');
await page.waitForTimeout(150);
check('grouping by due month works', (await page.locator('.phase').count()) >= 2);
await page.locator('#fGroupBy').selectOption('none');
await page.waitForTimeout(150);
check('grouping by nothing gives one section', (await page.locator('.phase').count()) === 1);
await page.locator('#fGroupBy').selectOption('phase');
await page.waitForTimeout(150);

await page.locator('#modeList').click();
await page.waitForTimeout(150);
check('the list view renders a row per task', (await page.locator('.list tbody tr').count()) === taskCount);
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

// --- folding ------------------------------------------------------------
const firstToggle = page.locator('.phase-toggle').first();
const firstPhase = page.locator('.phase').first();
await firstToggle.click();
// The fold animates now, and the folded rows only leave the tab order once the
// transition has finished, so give it longer than the 200ms it takes.
await page.waitForTimeout(350);
check('a phase folds shut', (await firstPhase.getAttribute('class')).includes('shut') &&
  !(await firstPhase.locator('.tasks').isVisible()));
check('the fold is announced to assistive tech', (await page.locator('.phase-toggle').first().getAttribute('aria-expanded')) === 'false');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(250);
check('the fold survives a reload', (await page.locator('.phase').first().getAttribute('class')).includes('shut'));
await page.locator('.phase-toggle').first().click();
await page.waitForTimeout(150);
check('a phase opens again', !(await page.locator('.phase').first().getAttribute('class')).includes('shut'));
await page.locator('#foldBtn').click();
await page.waitForTimeout(200);
check('fold all folds every phase', (await page.locator('.phase.shut').count()) === (await page.locator('.phase').count()));
await page.locator('#foldBtn').click();
await page.waitForTimeout(200);
check('fold all again opens them', (await page.locator('.phase.shut').count()) === 0);

// --- shareable views ----------------------------------------------------
await page.locator('#fStatus').selectOption('blocked');
await page.locator('#fTag').selectOption('legal');
await page.locator('#fGroupBy').selectOption('person');
await page.waitForTimeout(150);
check('the view is written into the URL',
  page.url().includes('status=blocked') && page.url().includes('tag=legal') && page.url().includes('groupBy=person'),
  page.url().split('?')[1] || '');
const sharedUrl = page.url();
await page.locator('#fStatus').selectOption('all');
await page.locator('#fTag').selectOption('all');
await page.locator('#fGroupBy').selectOption('phase');
await page.goto(sharedUrl, { waitUntil: 'networkidle' });
await page.waitForTimeout(250);
check('a shared URL restores the filters',
  (await page.locator('#fStatus').inputValue()) === 'blocked' &&
  (await page.locator('#fTag').inputValue()) === 'legal');
check('a shared URL restores the grouping', (await page.locator('#fGroupBy').inputValue()) === 'person');
check('a restored filter is marked as set', (await page.locator('#fStatus').getAttribute('class')).includes('set'));

// Clear-all must reach every filter, including the ones set from a link.
await page.locator('#clearFilters').click();
await page.waitForTimeout(150);
check('clear all clears every filter', !(await page.locator('#activeRail').isVisible()));

// A link naming a view that does not exist must land somewhere, not nowhere.
await page.goto(TRACKER + '?mode=nonsense&groupBy=nonsense', { waitUntil: 'networkidle' });
await page.waitForTimeout(200);
check('a nonsense view falls back instead of wedging',
  (await page.locator('#modeNow').getAttribute('class')).includes('on') &&
  (await page.locator('.lane').count()) > 0);

await page.goto(TRACKER, { waitUntil: 'networkidle' });
await page.waitForTimeout(200);

// --- persistence --------------------------------------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await page.locator('#modeBoard').click();
await page.waitForTimeout(200);
check('identity persists across reload', (await page.locator('#who').innerText()).includes('Kunjal'));
check('edits persist across reload', (await page.locator('.task.done').count()) >= 1);
check('comment persists across reload', (await page.locator('.cm').count()) >= 1);
check('sync state says device-only', (await page.locator('#syncState').innerText()).toLowerCase().includes('device'));

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

// --- the merge rule -----------------------------------------------------
// Shared mode shipped broken and said "Shared" the whole time: seed rows were
// stamped with the clock at page load, so a visitor's untouched copy always
// looked newer than the team's edits, won the merge, and got pushed back.
// Every new reader silently reverted the board. These four cases are that bug
// and its neighbours, run against the real function.
const merge = await page.evaluate(() => {
  const seedRow = id => ({ id, title: 'seed', updatedAt: SEED_AT, order: 0 });
  const editedRow = (id, title, at) => ({ id, title, updatedAt: at, order: 0 });
  const doc = tasks => ({ version: 1, tasks, people: [] });
  const older = '2026-06-01T00:00:00.000Z';
  const newer = '2026-07-01T00:00:00.000Z';
  const pick = (mineTasks, theirTasks) =>
    mergeDocs(doc(mineTasks), doc(theirTasks)).tasks.find(t => t.id === 'a').title;
  return {
    // A pristine local seed must NOT clobber somebody else's real edit.
    pristineLoses: pick([seedRow('a')], [editedRow('a', 'theirs', older)]),
    // A real local edit must still win over an untouched remote seed.
    editWins: pick([editedRow('a', 'mine', older)], [seedRow('a')]),
    // Between two real edits, the newer one wins.
    newestWins: pick([editedRow('a', 'mine', older)], [editedRow('a', 'theirs', newer)]),
    // A task only one side has must survive the merge.
    keepsNew: mergeDocs(doc([seedRow('a'), seedRow('b')]), doc([seedRow('a')])).tasks.length,
    seedStamp: SEED_AT,
  };
});
check('a pristine copy never overwrites a real edit', merge.pristineLoses === 'theirs', merge.pristineLoses);
check('a real edit still beats an untouched seed', merge.editWins === 'mine', merge.editWins);
check('between two edits the newer wins', merge.newestWins === 'theirs', merge.newestWins);
check('a task only one side has survives', merge.keepsNew === 2, String(merge.keepsNew));
check('the seed stamp is fixed, not the clock', merge.seedStamp === '2026-01-01T00:00:00.000Z', merge.seedStamp);

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

// --- the unassigned filter (was matching nothing) -----------------------
const u = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await u.goto(TRACKER, { waitUntil: 'networkidle' });
await u.locator('#modeBoard').click();
await u.locator('#fPerson').selectOption('unassigned');
await u.waitForTimeout(200);
const unassignedShown = await u.locator('.task').count();
const unassignedReal = await u.evaluate(() => SEED_TASKS.filter(t => !(t.a || []).length).length);
check('the unassigned filter finds unassigned work', unassignedShown > 0 && unassignedShown === unassignedReal,
  `${unassignedShown} shown, ${unassignedReal} in the seed`);

// --- the second board ---------------------------------------------------
const b = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const buildErrors = [];
b.on('pageerror', e => buildErrors.push(String(e)));
await b.goto('http://127.0.0.1:4180/company/build.html', { waitUntil: 'networkidle' });
check('the workbench is named the workbench', (await b.title()).includes('Tech Workbench'));
await b.locator('#modeBoard').click();
await b.waitForTimeout(150);
check('the workbench renders its tasks', (await b.locator('.task').count()) > 30, `${await b.locator('.task').count()} tasks`);
check('the workbench renders every phase', (await b.locator('.phase').count()) === (await b.evaluate(() => GROUPS.length)));
check('the workbench throws nothing', buildErrors.length === 0, buildErrors.slice(0, 2).join(' | '));
check('the two boards do not share storage', await b.evaluate(() => BOARD_KEY) !== await u.evaluate(() => BOARD_KEY));

// The rename changed BOARD_KEY, which namespaces localStorage. Without the
// carry-over, every edit made before 13 Aug 2026 would have vanished in
// silence — the board would simply have looked new.
const mig = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await mig.goto('http://127.0.0.1:4180/company/build.html', { waitUntil: 'networkidle' });
await mig.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('almari-cuttingroom-me', 'kunjal');
  localStorage.setItem('almari-cuttingroom-collapsed', JSON.stringify(['sec']));
});
await mig.reload({ waitUntil: 'networkidle' });
await mig.waitForTimeout(250);
check('a renamed board carries its old storage across',
  (await mig.evaluate(() => localStorage.getItem('almari-workbench-me'))) === 'kunjal');
check('and carries the folds across too, re-keyed',
  JSON.parse(await mig.evaluate(() => localStorage.getItem('almari-workbench-collapsed'))).includes('phase:sec'));
check('the carried identity is actually used', (await mig.locator('#who').innerText()).includes('Kunjal'));
const bSeed = await b.evaluate(() => {
  const groups = new Set(GROUPS.map(g => g.id)); const people = new Set(PEOPLE.map(p => p.id)); const tags = new Set(TAGS);
  const titles = SEED_TASKS.map(t => t.t);
  return {
    badGroup: SEED_TASKS.filter(t => !groups.has(t.g)).map(t => t.t),
    badPerson: SEED_TASKS.flatMap(t => (t.a || []).filter(a => !people.has(a))),
    badTag: SEED_TASKS.flatMap(t => (t.tags || []).filter(x => !tags.has(x))),
    dupes: titles.filter((t, i) => titles.indexOf(t) !== i),
    noWhy: SEED_TASKS.filter(t => !t.why).map(t => t.t),
    // This check existed for the Workroom and not for this board, which is
    // exactly how a dep pointing at a task that does not exist reached the
    // live site. A dependency on nothing is worse than no dependency: it reads
    // as considered.
    orphanDep: SEED_TASKS.filter(t => t.dep && !titles.some(x => x.includes(t.dep))).map(t => `${t.t} -> ${t.dep}`),
    badDate: SEED_TASKS.filter(t => t.due && !/^\d{4}-\d{2}-\d{2}$/.test(t.due)).map(t => t.t),
  };
});
check('workbench: every task sits in a real phase', bSeed.badGroup.length === 0, bSeed.badGroup.join(', '));
check('workbench: every assignee is on the roster', bSeed.badPerson.length === 0, bSeed.badPerson.join(', '));
check('workbench: every tag is declared', bSeed.badTag.length === 0, bSeed.badTag.join(', '));
check('workbench: no duplicate titles', bSeed.dupes.length === 0, bSeed.dupes.join(', '));
check('workbench: every task says why', bSeed.noWhy.length === 0, bSeed.noWhy.join(', '));
check('workbench: every dependency names a real task', bSeed.orphanDep.length === 0, bSeed.orphanDep.join(' | '));
check('workbench: every due date is well formed', bSeed.badDate.length === 0, bSeed.badDate.join(', '));

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
