/* ============================================================================
   THE BOARD ENGINE.

   Shared by every board on this site. It owns state, storage, sync, rendering,
   the drawer, selection and the keyboard; it owns no content at all. A board is
   a data file loaded BEFORE this one, defining these globals:

     BOARD_KEY   a short slug; namespaces this board's localStorage keys
     BOARD_TITLE what the board calls itself, for the export filename
     SYNC        the shared-storage config (see README-SYNC.md)
     PEOPLE      the roster
     GROUPS      the phases
     TAGS        the allowed tag vocabulary
     SEED_TASKS  the work, in the compact authoring shape

   Two boards therefore differ only by their data file, and a fix to the engine
   is a fix to both.
   ========================================================================== */

/* ========================================================================== */
/* STATE                                                                      */
/* ========================================================================== */

const uid = () => 't' + Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();

/* The moment the board was AUTHORED, not the moment this tab opened.

   These two things were the same, and it silently broke sharing. Seed tasks
   were stamped with the clock at page load, so a visitor arriving with a
   pristine copy always looked newer than the team's real edits — the merge
   kept the seed, then pushed it back. Every new reader quietly reverted the
   board for everybody. Both boards said "Shared" the entire time.

   A fixed stamp also makes "has this row ever been touched" answerable, which
   is what mergeDocs needs to break ties honestly. */
const SEED_AT = '2026-01-01T00:00:00.000Z';

/* Bump this whenever the authored plan changes — tasks added, owners assigned,
   review notes attached.

   Fixing the merge created its mirror-image problem. Once a shared document
   exists, every row in it is either a real edit or was written by an older
   build, and both look newer than a seed row by construction. So a rewritten
   plan could never reach a board that had already been shared: the team would
   go on reading the plan as it stood the day sync was switched on, forever,
   with nothing anywhere saying so.

   A revision number is the author saying "this changed". People's work — notes,
   and any row somebody has genuinely edited — is carried across. */
const SEED_REV = 2;

function buildSeed() {
  const tasks = SEED_TASKS.map((s, i) => ({
    id: 'seed-' + i,
    title: s.t,
    group: s.g,
    status: s.status || 'next',
    current: !!s.current,
    assignees: s.a || [],
    tags: s.tags || [],
    due: s.due || '',
    est: s.est || '',
    why: s.why || '',
    check: s.check || '',
    dep: s.dep || '',
    /* Seeded notes. A review that lives in a document gets read once; a review
       that lives on the task gets read by whoever picks the task up, which is
       the person who can still act on it. `n: [{ by, text }]` in the data file
       becomes a note in the drawer, indistinguishable from one typed by hand. */
    comments: (s.n || []).map(c => ({ by: c.by, at: c.at || SEED_AT, text: c.text })),
    updatedAt: SEED_AT,
    order: i,
  }));
  return { version: 1, seedRev: SEED_REV, tasks, people: PEOPLE.slice(), updatedAt: SEED_AT };
}

let STATE = buildSeed();
let ME = null;
/* `group` filters to one phase; `groupBy` decides what the sections ARE. They
   are different questions and were previously the same one, which is why the
   board could only ever be read phase-first. */
let VIEW = { group: 'all', person: 'all', tag: 'all', status: 'all', q: '', mode: 'now', groupBy: 'phase', mine: false };
let SELECTED = new Set();
let OPEN_TASK = null;
let SYNCING = false;
let LAST_SYNC = null;

/* ------------------------------------------------------------- storage --- */

const LOCAL_KEY = `almari-${BOARD_KEY}-state`;
const ME_KEY = `almari-${BOARD_KEY}-me`;
const SHUT_KEY = `almari-${BOARD_KEY}-collapsed`;

/* A board that gets renamed changes BOARD_KEY, and BOARD_KEY namespaces every
   localStorage key here — so a rename silently orphans the team's edits unless
   the old keys are carried across. A data file declares its former name as
   BOARD_KEY_WAS and this runs once, before anything reads storage. It never
   overwrites: if the new key already holds something, that is the newer truth. */
(function migrateBoardKey() {
  if (typeof BOARD_KEY_WAS !== 'string' || !BOARD_KEY_WAS || BOARD_KEY_WAS === BOARD_KEY) return;
  try {
    for (const suffix of ['state', 'me', 'collapsed']) {
      const from = `almari-${BOARD_KEY_WAS}-${suffix}`;
      const to = `almari-${BOARD_KEY}-${suffix}`;
      const carried = localStorage.getItem(from);
      if (carried !== null && localStorage.getItem(to) === null) localStorage.setItem(to, carried);
    }
  } catch { /* private mode: nothing was saved, so nothing can be lost */ }
})();

/** Which sections are folded shut. Per device, like a desk left as you left it.
    Keys are `${groupBy}:${bucketId}` because bucket ids collide across
    groupings — "done" is a status and could as easily be a phase — and folding
    Done under one grouping must not fold something unrelated under another.
    Entries saved before grouping existed are bare phase ids; carry them over. */
const COLLAPSED = new Set(
  (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SHUT_KEY) || '[]');
      const keyed = raw.map(k => (String(k).includes(':') ? k : `phase:${k}`));
      // Write the re-keyed form straight back, so storage and memory agree
      // from the first paint rather than only after somebody folds something.
      if (keyed.some((k, i) => k !== raw[i])) localStorage.setItem(SHUT_KEY, JSON.stringify(keyed));
      return keyed;
    } catch { return []; }
  })()
);
const saveCollapsed = () => {
  try { localStorage.setItem(SHUT_KEY, JSON.stringify([...COLLAPSED])); } catch { /* private mode */ }
};
const shared = () => !!(SYNC.url && SYNC.key);

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tasks)) return parsed;
    }
  } catch { /* fall through to seed */ }
  return null;
}

function saveLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(STATE)); } catch { /* private mode */ }
}

/* Shared mode: one JSON row, merged per task on write so two people editing
   different tasks never clobber each other. Last write wins per task. */
async function pullShared() {
  const r = await fetch(`${SYNC.url}/rest/v1/${SYNC.table}?id=eq.${SYNC.row}&select=doc`, {
    headers: { apikey: SYNC.key, Authorization: `Bearer ${SYNC.key}` },
  });
  if (!r.ok) throw new Error('pull ' + r.status);
  const rows = await r.json();
  return rows && rows[0] && rows[0].doc ? rows[0].doc : null;
}

async function pushShared(doc) {
  const r = await fetch(`${SYNC.url}/rest/v1/${SYNC.table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SYNC.key, Authorization: `Bearer ${SYNC.key}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ id: SYNC.row, doc, updated_at: nowISO() }),
  });
  if (!r.ok) throw new Error('push ' + r.status);
}

function mergeDocs(mine, theirs) {
  if (!theirs) return mine;
  const byId = new Map(theirs.tasks.map(t => [t.id, t]));
  for (const t of mine.tasks) {
    const other = byId.get(t.id);
    if (!other) { byId.set(t.id, t); continue; }
    // A row nobody here has touched must never overwrite one somebody there
    // has. This is the guard that was missing, and it is why the tie-break
    // below is a strict > rather than >=: equal timestamps mean equal content,
    // so there is nothing to win.
    if (t.updatedAt === SEED_AT) continue;
    if ((t.updatedAt || '') > (other.updatedAt || '')) byId.set(t.id, t);
  }
  const people = [...theirs.people];
  for (const p of mine.people) if (!people.some(x => x.id === p.id)) people.push(p);
  return { version: 1, seedRev: SEED_REV, tasks: [...byId.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), people, updatedAt: nowISO() };
}

/* The authored plan has changed under a document that already exists. Take the
   new plan as the base — that is the point — and carry across the things that
   belong to people rather than to the author. */
function adoptSeed(fresh, old) {
  if (!old || !Array.isArray(old.tasks)) return fresh;
  const oldById = new Map(old.tasks.map(t => [t.id, t]));
  // Only a document written by a build that HAD revisions can be trusted to
  // distinguish a real edit from a row an older bug merely re-stamped.
  const trustworthy = old.seedRev != null;
  for (const t of fresh.tasks) {
    const prev = oldById.get(t.id);
    if (!prev) continue;
    // Notes are always somebody's work, whoever wrote the plan.
    const seen = new Set((t.comments || []).map(c => c.at + c.text));
    t.comments = [...(t.comments || []), ...(prev.comments || []).filter(c => !seen.has(c.at + c.text))];
    if (trustworthy && (prev.updatedAt || '') > SEED_AT) {
      t.status = prev.status; t.current = prev.current;
      t.assignees = prev.assignees; t.due = prev.due;
      t.updatedAt = prev.updatedAt;
    }
  }
  // Rows somebody added by hand are not in any seed. Keep every one.
  for (const t of old.tasks) if (!fresh.tasks.some(x => x.id === t.id)) fresh.tasks.push(t);
  for (const p of (old.people || [])) if (!fresh.people.some(x => x.id === p.id)) fresh.people.push(p);
  fresh.updatedAt = nowISO();
  return fresh;
}

async function persist() {
  STATE.updatedAt = nowISO();
  saveLocal();
  if (!shared()) return;
  try {
    SYNCING = true; paintSyncState();
    const remote = await pullShared();
    STATE = mergeDocs(STATE, remote);
    await pushShared(STATE);
    LAST_SYNC = new Date();
    saveLocal();
  } catch (e) {
    console.warn('sync failed', e);
  } finally { SYNCING = false; paintSyncState(); render(); }
}

async function poll() {
  if (!shared() || SYNCING) return;
  try {
    const remote = await pullShared();
    if (!remote) return;
    if ((remote.updatedAt || '') > (STATE.updatedAt || '')) {
      STATE = mergeDocs(STATE, remote);
      saveLocal(); render();
    }
    LAST_SYNC = new Date(); paintSyncState();
  } catch { /* offline; the portal keeps working */ }
}

/* ========================================================================== */
/* HELPERS                                                                    */
/* ========================================================================== */

const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const personById = id => STATE.people.find(p => p.id === id);
const groupById = id => GROUPS.find(g => g.id === id);

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function daysUntil(d) {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt)) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((dt - today) / 86400000);
}

function touch(task) { task.updatedAt = nowISO(); }

/* ========================================================================== */
/* RENDER                                                                     */
/* ========================================================================== */

const archived = () => STATE.tasks.filter(t => t.archived);

function visibleTasks() {
  const q = VIEW.q.trim().toLowerCase();
  return STATE.tasks.filter(t => {
    // Set aside, not deleted. Nothing on this board is ever destroyed — the
    // reset is only worth having if it is safe to press.
    if (t.archived) return false;
    if (VIEW.group !== 'all' && t.group !== VIEW.group) return false;
    // "Unassigned" is a predicate, not a person: testing it as a person id
    // matched nothing and silently emptied the board.
    if (VIEW.person === 'unassigned') {
      if ((t.assignees || []).length) return false;
    } else if (VIEW.person !== 'all' && !(t.assignees || []).includes(VIEW.person)) {
      return false;
    }
    if (VIEW.mine && !(ME && (t.assignees || []).includes(ME))) return false;
    if (VIEW.tag !== 'all' && !(t.tags || []).includes(VIEW.tag)) return false;
    if (VIEW.status !== 'all' && t.status !== VIEW.status) return false;
    // Tags belong in the haystack: people search "sqlite" or "legal" far more
    // often than they remember which phase a thing was filed under.
    if (q && !(`${t.title} ${t.why} ${t.check} ${(t.tags || []).join(' ')}`.toLowerCase().includes(q))) return false;
    return true;
  });
}

/* ------------------------------------------------------------- grouping ---
   Sections were hardcoded to phases. A board is read differently depending on
   the question: "what is this phase" (planning), "what is Nimesh holding"
   (a stand-up), "what is blocked" (a rescue), "what lands in September" (a
   promise to somebody). Each of those is the same tasks under a different cut,
   so grouping is a function from tasks to buckets and nothing else changes. */

const MONTH_FMT = { month: 'long', year: 'numeric' };

const GROUPINGS = {
  phase: {
    label: 'Phase',
    buckets(tasks) {
      return GROUPS.map(g => ({
        id: g.id, name: g.name, note: g.note, meta: g.window,
        tasks: tasks.filter(t => t.group === g.id),
      }));
    },
  },
  person: {
    label: 'Person',
    buckets(tasks) {
      const out = STATE.people.map(p => ({
        id: p.id, name: p.name, note: p.role || '', meta: '',
        tasks: tasks.filter(t => (t.assignees || []).includes(p.id)),
      }));
      out.push({
        id: 'nobody', name: 'Nobody yet', note: 'Work with no owner is work nobody is doing.',
        meta: '', tasks: tasks.filter(t => !(t.assignees || []).length),
      });
      return out;
    },
  },
  status: {
    label: 'Status',
    buckets(tasks) {
      const order = [
        ['ongoing', 'On now', 'Being worked on right now.'],
        ['blocked', 'Blocked', 'Waiting on something or someone. Read these first.'],
        ['next', 'Next', 'Ready to be picked up.'],
        ['done', 'Done', ''],
      ];
      return order.map(([id, name, note]) => ({
        id, name, note, meta: '', tasks: tasks.filter(t => t.status === id),
      }));
    },
  },
  due: {
    label: 'Due month',
    buckets(tasks) {
      const months = [...new Set(tasks.filter(t => t.due).map(t => t.due.slice(0, 7)))].sort();
      const out = months.map(m => ({
        id: m,
        name: new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', MONTH_FMT),
        note: '', meta: '',
        tasks: tasks.filter(t => t.due && t.due.slice(0, 7) === m),
      }));
      out.push({
        id: 'undated', name: 'No date yet',
        note: 'Undated work is work that cannot slip, because it was never promised.',
        meta: '', tasks: tasks.filter(t => !t.due),
      });
      return out;
    },
  },
  tag: {
    label: 'Tag',
    buckets(tasks) {
      const out = TAGS.map(x => ({
        id: x, name: x, note: '', meta: '',
        tasks: tasks.filter(t => (t.tags || []).includes(x)),
      }));
      out.push({
        id: 'untagged', name: 'Untagged', note: '', meta: '',
        tasks: tasks.filter(t => !(t.tags || []).length),
      });
      return out;
    },
  },
  none: {
    label: 'Nothing — one list',
    buckets(tasks) {
      return [{ id: 'all', name: 'All work', note: '', meta: '', tasks }];
    },
  },
};

/** Buckets for the current view, empty ones dropped, each sorted as authored. */
function buckets() {
  const g = GROUPINGS[VIEW.groupBy] || GROUPINGS.phase;
  return g.buckets(visibleTasks())
    .map(b => ({ ...b, tasks: b.tasks.slice().sort((a, z) => (a.order ?? 0) - (z.order ?? 0)) }))
    .filter(b => b.tasks.length);
}

function paintSyncState() {
  const el = $('#syncState'); if (!el) return;
  if (!shared()) {
    el.innerHTML = `<span class="dot local"></span>This device only · <a href="#setup" id="setupLink">make it shared</a>`;
  } else if (SYNCING) {
    el.innerHTML = `<span class="dot sync"></span>Saving to the team…`;
  } else {
    el.innerHTML = `<span class="dot ok"></span>Shared${LAST_SYNC ? ' · ' + LAST_SYNC.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''}`;
  }
}

function avatar(id, size) {
  const p = personById(id);
  if (!p) return '';
  return `<span class="av ${p.tint} ${size || ''}" title="${esc(p.name)}">${esc(p.initials)}</span>`;
}

function taskRow(t) {
  const g = groupById(t.group);
  const d = daysUntil(t.due);
  const overdue = d !== null && d < 0 && t.status !== 'done';
  const soon = d !== null && d >= 0 && d <= 7 && t.status !== 'done';
  return `
  <article class="task ${t.status} ${t.current ? 'is-current' : ''} ${SELECTED.has(t.id) ? 'is-sel' : ''}" data-id="${t.id}">
    <label class="pick"><input type="checkbox" ${SELECTED.has(t.id) ? 'checked' : ''} data-pick="${t.id}" aria-label="Select"></label>
    <div class="task-body" data-open="${t.id}">
      <div class="task-top">
        <span class="st st-${t.status}">${statusLabel(t.status)}</span>
        ${t.current ? '<span class="pin">Current focus</span>' : ''}
        ${g && VIEW.groupBy !== 'phase' && VIEW.group === 'all' ? `<span class="gtag">${esc(g.name)}</span>` : ''}
      </div>
      <h4><button class="task-open" data-open="${t.id}">${esc(t.title)}</button></h4>
      ${t.why ? `<p class="why">${esc(t.why)}</p>` : ''}
      <div class="task-meta">
        ${(t.assignees || []).length ? `<span class="avs">${t.assignees.map(a => avatar(a, 'sm')).join('')}</span>` : '<span class="unassigned">Unassigned</span>'}
        ${t.due ? `<span class="due ${overdue ? 'overdue' : soon ? 'soon' : ''}">${esc(fmtDate(t.due))}${d !== null && t.status !== 'done' ? ` · ${d < 0 ? `${-d}d late` : d === 0 ? 'today' : `in ${d}d`}` : ''}</span>` : ''}
        ${t.est ? `<span class="est">${esc(t.est)}</span>` : ''}
        ${(t.tags || []).map(x => `<span class="tg">${esc(x)}</span>`).join('')}
        ${(t.comments || []).length ? `<span class="cm">${t.comments.length} note${t.comments.length > 1 ? 's' : ''}</span>` : ''}
      </div>
    </div>
  </article>`;
}

function renderBoard() {
  const list = buckets();
  if (!list.length) return emptyState();
  let html = '';
  for (const b of list) {
    const done = b.tasks.filter(t => t.status === 'done').length;
    const key = `${VIEW.groupBy}:${b.id}`;
    const shut = COLLAPSED.has(key);
    const pct = Math.round((done / b.tasks.length) * 100);
    html += `
    <section class="phase ${shut ? 'shut' : ''}">
      <header class="phase-head">
        <div>
          <button class="phase-toggle" data-phase="${esc(key)}" aria-expanded="${!shut}" aria-controls="tasks-${esc(b.id)}">
            <span class="chev" aria-hidden="true"></span><span class="ph-name">${esc(b.name)}</span>
          </button>
          ${b.note ? `<p class="phase-note">${esc(b.note)}</p>` : ''}
        </div>
        <div class="phase-meta">
          ${b.meta ? `<span class="win">${esc(b.meta)}</span>` : ''}
          <span class="prog" title="${done} of ${b.tasks.length} done" aria-hidden="true"><i style="width:${pct}%"></i></span>
          <span class="count">${done}/${b.tasks.length} done</span>
        </div>
      </header>
      <div class="tasks-wrap"><div class="tasks" id="tasks-${esc(b.id)}">${b.tasks.map(taskRow).join('')}</div></div>
    </section>`;
  }
  return html;
}

/* Saying "nothing matches" is only half an answer; the other half is the way
   back out. */
function emptyState() {
  return `<div class="empty-box">
    <p>Nothing matches what you have asked for.</p>
    ${filtersActive().length ? `<p style="margin-top:16px"><button class="btn small" id="emptyClear">Clear the filters</button></p>` : ''}
  </div>`;
}

/* A table for scanning. The board answers "what is in this phase"; the list
   answers "where is that one task I half-remember". */
function renderList() {
  const rows = buckets().flatMap(b => b.tasks.map(t => ({ t, b })));
  if (!rows.length) return emptyState();
  return `<div class="list table-rail"><table>
    <thead><tr>
      <th>Task</th><th>${esc((GROUPINGS[VIEW.groupBy] || GROUPINGS.phase).label)}</th>
      <th>Status</th><th>Who</th><th>Due</th>
    </tr></thead>
    <tbody>${rows.map(({ t, b }) => {
      const d = daysUntil(t.due);
      const late = d !== null && d < 0 && t.status !== 'done';
      return `<tr class="${t.status}" data-open="${t.id}">
        <td class="lt">${t.current ? '<span class="pin">Now</span> ' : ''}${esc(t.title)}</td>
        <td class="lg">${esc(b.name)}</td>
        <td><span class="st st-${t.status}">${statusLabel(t.status)}</span></td>
        <td><span class="lp">${(t.assignees || []).map(a => avatar(a, 'sm')).join('') || '<span class="unassigned">—</span>'}</span></td>
        <td class="lg ${late ? 'due overdue' : ''}">${t.due ? esc(fmtDate(t.due)) : '—'}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

const statusLabel = s => (s === 'ongoing' ? 'On now' : s === 'done' ? 'Done' : s === 'blocked' ? 'Blocked' : 'Next');

function renderTimeline() {
  const dated = visibleTasks().filter(t => t.due).sort((a, b) => a.due.localeCompare(b.due));
  const undated = visibleTasks().filter(t => !t.due);
  const byMonth = new Map();
  for (const t of dated) {
    const k = t.due.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(t);
  }
  let html = '<div class="timeline">';
  for (const [month, list] of byMonth) {
    const label = new Date(month + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    html += `<section class="tl-month"><h3>${esc(label)}</h3>`;
    for (const t of list) {
      const d = daysUntil(t.due);
      html += `
      <div class="tl-row ${t.status} ${t.current ? 'is-current' : ''}" data-open="${t.id}">
        <span class="tl-date">${esc(fmtDate(t.due))}</span>
        <span class="tl-bar"></span>
        <span class="tl-title">${esc(t.title)}</span>
        <span class="tl-people">${(t.assignees || []).map(a => avatar(a, 'sm')).join('')}</span>
        ${d !== null && t.status !== 'done' ? `<span class="tl-when ${d < 0 ? 'overdue' : d <= 7 ? 'soon' : ''}">${d < 0 ? `${-d}d late` : d === 0 ? 'today' : `in ${d}d`}</span>` : ''}
      </div>`;
    }
    html += `</section>`;
  }
  if (undated.length) {
    html += `<section class="tl-month"><h3>No date yet</h3>
      ${undated.map(t => `<div class="tl-row ${t.status}" data-open="${t.id}"><span class="tl-date">—</span><span class="tl-bar"></span><span class="tl-title">${esc(t.title)}</span><span class="tl-people">${(t.assignees || []).map(a => avatar(a, 'sm')).join('')}</span></div>`).join('')}
    </section>`;
  }
  return html + '</div>';
}

function renderPeople() {
  const html = STATE.people.map(p => {
    const mine = STATE.tasks.filter(t => !t.archived && (t.assignees || []).includes(p.id));
    const open = mine.filter(t => t.status !== 'done');
    const now = mine.filter(t => t.status === 'ongoing' || t.current);
    return `
    <section class="plate person-card">
      <div class="person-head">${avatar(p.id, 'lg')}<div><h3>${esc(p.name)}</h3><p class="phase-note">${esc(p.role || '')}</p></div></div>
      <p class="person-nums"><b>${open.length}</b> open · <b>${now.length}</b> on now · <b>${mine.length - open.length}</b> done</p>
      <div class="tasks compact">${mine.length ? mine.slice(0, 40).map(taskRow).join('') : '<p class="empty">Nothing assigned yet.</p>'}</div>
    </section>`;
  }).join('');
  return html;
}

const RENDERERS = {
  now: () => renderNow(),
  board: () => renderBoard(),
  list: () => renderList(),
  timeline: () => renderTimeline(),
  people: () => renderPeople(),
};

function render() {
  const main = $('#main');
  // Replacing innerHTML resets the document height for a frame, and the browser
  // clamps the scroll position to the shorter page. Without this, ticking a
  // checkbox near the bottom of a 97-task board threw you back up it.
  const y = window.scrollY;
  main.innerHTML = (RENDERERS[VIEW.mode] || RENDERERS.board)();
  // 'instant' matters: the stylesheet sets scroll-behavior: smooth for anchor
  // links, which would otherwise animate this correction and read as drift.
  if (window.scrollY !== y) window.scrollTo({ top: y, behavior: 'instant' });

  const live = STATE.tasks.filter(t => !t.archived);
  const done = live.filter(t => t.status === 'done').length;
  const ongoing = live.filter(t => t.status === 'ongoing').length;
  const blocked = live.filter(t => t.status === 'blocked').length;
  const aside = archived().length;
  $('#stats').innerHTML = `<b>${done}</b>/${live.length} done · <b>${ongoing}</b> on now`
    + (blocked ? ` · <b>${blocked}</b> blocked` : '')
    + (aside ? ` · <b>${aside}</b> set aside` : '');

  // The way back is a button, not a memory. It exists only while there is
  // something to undo, and it says how much.
  const undo = $('#undoBtn');
  if (undo) { undo.hidden = !aside; undo.textContent = `Undo reset (${aside})`; }
  const reset = $('#resetBtn');
  if (reset) reset.disabled = !ME;

  paintBulk();
  paintSyncState();
  paintActiveRail();
  viewToUrl();
  if (OPEN_TASK) paintDrawer();
}

/* ---------------------------------------------------------------- now -----
   Every other view answers "what is the plan". This one answers "what is
   happening", which is the only question a stand-up actually asks. The lanes
   are the point: four people working in parallel should be four columns you
   can read at once, not one list you have to filter four times. */

function renderNow() {
  const all = visibleTasks();
  const pinned = all.filter(t => t.current && t.status !== 'done');
  const blocked = all.filter(t => t.status === 'blocked');
  const soon = all.filter(t => {
    const d = daysUntil(t.due);
    return d !== null && d >= 0 && d <= 14 && t.status !== 'done';
  }).sort((a, b) => a.due.localeCompare(b.due));
  const late = all.filter(t => {
    const d = daysUntil(t.due);
    return d !== null && d < 0 && t.status !== 'done';
  }).sort((a, b) => a.due.localeCompare(b.due));

  const lanes = [...STATE.people.map(p => ({
    id: p.id, name: p.name, role: p.role || '', av: avatar(p.id, 'sm'),
    tasks: all.filter(t => (t.assignees || []).includes(p.id) && t.status !== 'done'),
  })), {
    id: 'nobody', name: 'Nobody yet', role: 'Unclaimed work', av: '',
    tasks: all.filter(t => !(t.assignees || []).length && t.status !== 'done'),
  }].filter(l => l.tasks.length);

  /* Every block here folds, using the same machinery and the same storage as a
     phase on the board — so a desk left folded stays folded, and there is only
     one fold to maintain. Keys are namespaced `now:` so they cannot collide
     with a phase id. */
  const section = (id, title, note, count, body, cls) => {
    const key = `now:${id}`;
    const shut = COLLAPSED.has(key);
    return `
    <section class="phase now-block ${cls || ''} ${shut ? 'shut' : ''}">
      <header class="phase-head">
        <div>
          <button class="phase-toggle" data-phase="${key}" aria-expanded="${!shut}" aria-controls="now-${id}">
            <span class="chev" aria-hidden="true"></span><span class="ph-name">${esc(title)}</span>
          </button>
          ${note ? `<p class="phase-note">${esc(note)}</p>` : ''}
        </div>
        <div class="phase-meta"><span class="count">${esc(count)}</span></div>
      </header>
      <div class="tasks-wrap"><div class="now-body" id="now-${id}">${body}</div></div>
    </section>`;
  };

  const strip = (id, title, note, list, cls) => (list.length
    ? section(id, title, note, `${list.length}`, `<div class="tasks">${list.map(taskRow).join('')}</div>`, cls)
    : '');

  const laneCard = t => {
    const d = daysUntil(t.due);
    return `<div class="lane-task ${t.status} ${t.current ? 'is-current' : ''}" data-open="${t.id}">
      <span class="lane-dot st-${t.status}" aria-hidden="true"></span>
      <span class="lane-t">${esc(t.title)}</span>
      ${d !== null ? `<span class="lane-when ${d < 0 ? 'overdue' : d <= 7 ? 'soon' : ''}">${d < 0 ? `${-d}d late` : d === 0 ? 'today' : `${d}d`}</span>` : ''}
    </div>`;
  };

  /* Every section inside a lane is capped. Uncapped, one person holding fifty
     unclaimed tasks made their column ten times the height of everybody else's,
     and the grid row stretched to match — which is the opposite of a view whose
     whole purpose is comparing columns side by side. The true totals stay in
     the lane header, so capping hides nothing. */
  const capped = (list, n, label) => {
    if (!list.length) return '';
    return `<p class="lane-label">${label}</p>${list.slice(0, n).map(laneCard).join('')}` +
      (list.length > n ? `<p class="lane-more">and ${list.length - n} more</p>` : '');
  };

  const laneHtml = lanes.map(l => {
    const on = l.tasks.filter(t => t.status === 'ongoing' || t.current);
    const nxt = l.tasks.filter(t => t.status === 'next' && !t.current);
    const blk = l.tasks.filter(t => t.status === 'blocked');
    return `<section class="lane">
      <header class="lane-head">${l.av}<div><b>${esc(l.name)}</b><small>${esc(l.role)}</small></div></header>
      <p class="lane-count"><b>${l.tasks.length}</b> open${blk.length ? ` · <span class="lane-blk">${blk.length} blocked</span>` : ''}</p>
      ${capped(on, 5, 'On now')}
      ${capped(blk, 5, 'Blocked')}
      ${capped(nxt, 4, 'Next up')}
    </section>`;
  }).join('');

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (!all.length) return emptyState();

  /* Parallel first. The question a team actually opens this with is "who is on
     what", not "what did we agree to care about" — and the lanes answer it in
     one screen. Everything else is a list you consult, so it sits underneath. */
  return `
  <div class="now">
    <p class="now-date">${esc(today)}</p>
    ${lanes.length ? section('lanes', 'Running in parallel',
      'One column per person, everything not yet done. Read across to see where the team is thin and where it is doubled up.',
      `${lanes.length} lanes`, `<div class="lanes">${laneHtml}</div>`) : ''}
    ${strip('pinned', 'Pinned as current focus', 'What the team agreed matters most right now.', pinned)}
    ${strip('late', 'Late', 'Promised for a date that has passed. Either move the date or move the work — leaving it is the one option that costs something.', late, 'is-late')}
    ${strip('blocked', 'Blocked', 'Each of these is waiting on a person or a decision. They do not unblock themselves.', blocked)}
    ${strip('soon', 'Landing in the next fortnight', '', soon)}
  </div>`;
}

/* ------------------------------------------------------------- drawer ---- */

/* Steps are authored as one middle-dot-separated line, which is convenient to
   write and miserable to read — the longest is nine clauses. Split it back out
   so the person doing the work sees a list of steps rather than a paragraph. */
function steps(check) {
  const parts = String(check || '').split('·').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return '<p class="empty small">No steps written yet.</p>';
  return `<ul class="steps">${parts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`;
}

function paintDrawer() {
  const t = STATE.tasks.find(x => x.id === OPEN_TASK);
  const dr = $('#drawer');
  if (!t) { dr.hidden = true; OPEN_TASK = null; return; }
  /* Rebuilding the drawer replaces the textarea somebody is typing into. In
     shared mode the five-second poll calls render(), and render() repaints the
     drawer — so a half-written note used to disappear mid-sentence, blamed on
     the network. If the focus is in here, the person is mid-thought: leave it. */
  if (!dr.hidden && dr.contains(document.activeElement)) return;
  dr.hidden = false;
  const g = groupById(t.group);
  dr.innerHTML = `
    <div class="dr-head">
      <span class="kicker">${esc(g ? g.name : '')} · ${esc(g ? g.window : '')}</span>
      <button class="x" id="drClose" aria-label="Close">✕</button>
    </div>
    <input class="dr-title" id="drTitle" value="${esc(t.title)}" ${ME ? '' : 'disabled'}>
    <div class="dr-row">
      <label>Status</label>
      <div class="segs" id="drStatus">
        ${['next', 'ongoing', 'blocked', 'done'].map(s => `<button class="seg ${t.status === s ? 'on' : ''}" data-status="${s}" ${ME ? '' : 'disabled'}>${s === 'ongoing' ? 'On now' : s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
      </div>
    </div>
    <div class="dr-row">
      <label>Current focus</label>
      <button class="toggle ${t.current ? 'on' : ''}" id="drCurrent" ${ME ? '' : 'disabled'}>${t.current ? 'Pinned as current' : 'Pin as current'}</button>
    </div>
    <div class="dr-row">
      <label>Assigned to</label>
      <div class="chips" id="drPeople">
        ${STATE.people.map(p => `<button class="chip ${(t.assignees || []).includes(p.id) ? 'on' : ''}" data-person="${p.id}" ${ME ? '' : 'disabled'}>${avatar(p.id, 'sm')} ${esc(p.name)}</button>`).join('')}
      </div>
    </div>
    <div class="dr-row">
      <label>Tags</label>
      <div class="chips" id="drTags">
        ${TAGS.map(x => `<button class="chip ${(t.tags || []).includes(x) ? 'on' : ''}" data-tag="${x}" ${ME ? '' : 'disabled'}>${esc(x)}</button>`).join('')}
      </div>
    </div>
    <div class="dr-row two">
      <div><label>Due</label><input type="date" id="drDue" value="${esc(t.due || '')}" ${ME ? '' : 'disabled'}></div>
      <div><label>Estimate</label><input id="drEst" value="${esc(t.est || '')}" placeholder="e.g. 3 days" ${ME ? '' : 'disabled'}></div>
    </div>
    <div class="dr-row"><label>Why this needs to be done</label><textarea id="drWhy" rows="4" ${ME ? '' : 'disabled'}>${esc(t.why || '')}</textarea></div>
    <div class="dr-row">
      <label>The steps — what done looks like</label>
      ${steps(t.check)}
      ${ME ? `<textarea id="drCheck" rows="4" placeholder="Separate each step with ·">${esc(t.check || '')}</textarea>` : ''}
    </div>
    ${t.dep ? `<p class="dep">Waits on: ${esc(t.dep)}</p>` : ''}
    <div class="dr-row">
      <label>Notes from the team</label>
      <div class="comments">
        ${(t.comments || []).length ? t.comments.map(c => `
          <div class="comment">${avatar(c.by, 'sm')}<div><b>${esc(personById(c.by)?.name || c.by)}</b> <span class="ts">${new Date(c.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><p>${esc(c.text)}</p></div></div>`).join('')
          : '<p class="empty small">No notes yet.</p>'}
      </div>
      ${ME ? `<div class="add-comment"><textarea id="drComment" rows="2" placeholder="Add a note as ${esc(personById(ME)?.name)}…"></textarea><button class="btn" id="drAddComment">Add note</button></div>`
        : '<p class="empty small">Sign in to add a note.</p>'}
    </div>
    <p class="dr-foot">Last change ${new Date(t.updatedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
  `;
  wireDrawer(t);
}

function wireDrawer(t) {
  const save = () => { touch(t); persist(); render(); };
  $('#drClose').onclick = () => { OPEN_TASK = null; $('#drawer').hidden = true; };
  if (!ME) return;
  $('#drTitle').onchange = e => { t.title = e.target.value.trim() || t.title; save(); };
  $('#drDue').onchange = e => { t.due = e.target.value; save(); };
  $('#drEst').onchange = e => { t.est = e.target.value; save(); };
  $('#drWhy').onchange = e => { t.why = e.target.value; save(); };
  $('#drCheck').onchange = e => { t.check = e.target.value; save(); };
  $('#drCurrent').onclick = () => { t.current = !t.current; save(); };
  $('#drStatus').onclick = e => {
    const b = e.target.closest('[data-status]'); if (!b) return;
    t.status = b.dataset.status; save();
  };
  $('#drPeople').onclick = e => {
    const b = e.target.closest('[data-person]'); if (!b) return;
    const id = b.dataset.person;
    t.assignees = (t.assignees || []).includes(id) ? t.assignees.filter(x => x !== id) : [...(t.assignees || []), id];
    save();
  };
  $('#drTags').onclick = e => {
    const b = e.target.closest('[data-tag]'); if (!b) return;
    const x = b.dataset.tag;
    t.tags = (t.tags || []).includes(x) ? t.tags.filter(y => y !== x) : [...(t.tags || []), x];
    save();
  };
  const add = $('#drAddComment');
  if (add) add.onclick = () => {
    const box = $('#drComment');
    const text = box.value.trim(); if (!text) return;
    t.comments = [...(t.comments || []), { by: ME, at: nowISO(), text }];
    box.value = ''; save();
  };
}

/* ========================================================================== */
/* IDENTITY                                                                   */
/* ========================================================================== */

function paintIdentity() {
  const el = $('#who');
  if (ME) {
    const p = personById(ME);
    el.innerHTML = `${avatar(ME, 'sm')} <span>${esc(p ? p.name : ME)}</span> <button class="link" id="signOut">not you?</button>`;
    $('#signOut').onclick = () => { ME = null; localStorage.removeItem(ME_KEY); paintIdentity(); render(); };
  } else {
    el.innerHTML = `<button class="btn small" id="signIn">Sign in</button>`;
    $('#signIn').onclick = openSignIn;
  }
  $('#newTaskBtn').disabled = !ME;
}

function openSignIn() {
  const m = $('#modal');
  m.hidden = false;
  m.innerHTML = `
    <div class="sheet">
      <h3>Who is working?</h3>
      <p class="phase-note">This is a name badge, not a password. Anyone with the link can pick any name — it labels your edits and notes so the team knows who did what.</p>
      <div class="who-list">
        ${STATE.people.map(p => `<button class="who-btn" data-who="${p.id}">${avatar(p.id, 'lg')}<span><b>${esc(p.name)}</b><small>${esc(p.role || '')}</small></span></button>`).join('')}
      </div>
      <div class="add-person">
        <input id="newPersonName" placeholder="Someone else — their name">
        <button class="btn" id="addPersonBtn">Add them</button>
      </div>
      <button class="link" id="closeModal">Cancel</button>
    </div>`;
  m.querySelectorAll('[data-who]').forEach(b => b.onclick = () => {
    ME = b.dataset.who; localStorage.setItem(ME_KEY, ME);
    m.hidden = true; paintIdentity(); render();
  });
  $('#closeModal').onclick = () => { m.hidden = true; };
  $('#addPersonBtn').onclick = () => {
    const name = $('#newPersonName').value.trim(); if (!name) return;
    const tints = ['ink', 'blue', 'green', 'gold', 'plum'];
    const p = {
      id: 'p' + Math.random().toString(36).slice(2, 7),
      name,
      initials: name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(),
      role: 'Added ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      tint: tints[STATE.people.length % tints.length],
    };
    STATE.people.push(p); ME = p.id; localStorage.setItem(ME_KEY, ME);
    persist(); m.hidden = true; paintIdentity(); render();
  };
}

/* ========================================================================== */
/* WIRING                                                                     */
/* ========================================================================== */

function newTask() {
  if (!ME) return;
  const t = {
    id: uid(), title: 'New task', group: VIEW.group === 'all' ? 'now' : VIEW.group,
    status: 'next', current: false, assignees: [], tags: [], due: '', est: '',
    why: '', check: '', dep: '', comments: [], updatedAt: nowISO(),
    order: STATE.tasks.length + 1,
  };
  STATE.tasks.push(t); persist(); OPEN_TASK = t.id; render(); paintDrawer();
}

/* ------------------------------------------------------------- the reset --
   Clear the board down to the meetings, so a planning session starts from the
   dates everyone has agreed to rather than from four hundred rows of plan.

   It sets tasks aside; it never deletes them. That distinction is the whole
   feature: a destructive button on a board shared with three other people is a
   button nobody dares press, and an undo that only works in your own tab is not
   an undo at all — this one travels through the same sync as everything else,
   so whoever pressed it can put it back for everybody. */

function resetToMeetings() {
  if (!ME) return;
  const doomed = STATE.tasks.filter(t => !t.archived && !(t.tags || []).includes('meeting'));
  const kept = STATE.tasks.filter(t => !t.archived && (t.tags || []).includes('meeting'));
  if (!doomed.length) return;
  confirmSheet({
    title: 'Clear everything except the meetings?',
    body: `${doomed.length} tasks go quiet and ${kept.length} meeting${kept.length === 1 ? '' : 's'} stay. `
      + `Nothing is deleted — they keep their notes, owners and dates, and Undo brings all of them back. `
      + `This is a shared board, so the rest of the team sees it too.`,
    confirm: `Set aside ${doomed.length}`,
    onConfirm: () => {
      for (const t of doomed) { t.archived = true; touch(t); }
      persist(); render();
    },
  });
}

function undoReset() {
  const back = archived();
  if (!back.length) return;
  for (const t of back) { t.archived = false; touch(t); }
  persist(); render();
}

/** One sheet, for anything worth asking about first. */
function confirmSheet({ title, body, confirm, onConfirm }) {
  const m = $('#modal');
  m.hidden = false;
  m.innerHTML = `
    <div class="sheet">
      <h3>${esc(title)}</h3>
      <p class="phase-note" style="margin-top:12px">${esc(body)}</p>
      <div class="sheet-actions">
        <button class="btn small" id="sheetYes">${esc(confirm)}</button>
        <button class="link" id="sheetNo">Cancel</button>
      </div>
    </div>`;
  const close = () => { m.hidden = true; };
  $('#sheetYes').onclick = () => { close(); onConfirm(); };
  $('#sheetNo').onclick = close;
  $('#sheetYes').focus();
}

function bulk(fn) {
  for (const id of SELECTED) {
    const t = STATE.tasks.find(x => x.id === id);
    if (t) { fn(t); touch(t); }
  }
  SELECTED.clear(); persist(); render();
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `almari-${BOARD_KEY}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}

function wire() {
  $('#main').addEventListener('click', e => {
    /* Folding and selecting both used to call render(), which rebuilds every
       task on the page. Two costs: the fold could never animate, because the
       element it was animating stopped existing mid-transition; and ticking a
       checkbox rebuilt ninety-seven cards to change one border. Both now touch
       only the element they are about. */
    const fold = e.target.closest('[data-phase]');
    if (fold) {
      const key = fold.dataset.phase;
      const shut = !COLLAPSED.has(key);
      if (shut) COLLAPSED.add(key); else COLLAPSED.delete(key);
      fold.closest('.phase').classList.toggle('shut', shut);
      fold.setAttribute('aria-expanded', String(!shut));
      saveCollapsed();
      return;
    }
    if (e.target.closest('#emptyClear')) { clearFilters(); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const id = pick.dataset.pick;
      if (SELECTED.has(id)) SELECTED.delete(id); else SELECTED.add(id);
      const card = pick.closest('.task');
      if (card) card.classList.toggle('is-sel', SELECTED.has(id));
      paintBulk();
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) { OPEN_TASK = open.dataset.open; paintDrawer(); }
  });

  const MENUS = { fPhase: 'group', fPerson: 'person', fStatus: 'status', fTag: 'tag', fGroupBy: 'groupBy' };
  $('#filters').addEventListener('change', e => {
    const k = MENUS[e.target.id]; if (!k) return;
    VIEW[k] = e.target.value;
    paintViewControls(); render();
  });
  $('#filters').addEventListener('click', e => {
    if (e.target.closest('#fMine')) { VIEW.mine = !VIEW.mine; paintViewControls(); render(); return; }
    if (e.target.closest('#clearFilters')) { clearFilters(); return; }
    const drop = e.target.closest('[data-drop]');
    if (drop) {
      const k = drop.dataset.drop;
      if (k === 'mine') VIEW.mine = false;
      else if (k === 'q') { VIEW.q = ''; $('#search').value = ''; }
      else VIEW[k] = 'all';
      paintViewControls(); render();
    }
  });

  MODES.forEach(x => { const b = $('#mode' + x); if (b) b.onclick = () => setMode(x.toLowerCase()); });

  /* Search ran a full rebuild of every task on every keystroke, and each
     rebuild also wrote the address bar. Waiting for a pause in typing turns
     one render per character into one render per word. */
  let searchTimer = null;
  $('#search').oninput = e => {
    const v = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { VIEW.q = v; render(); }, 140);
  };
  $('#newTaskBtn').onclick = newTask;
  $('#exportBtn').onclick = exportJSON;
  $('#keysBtn').onclick = openKeys;
  $('#resetBtn').onclick = resetToMeetings;
  $('#undoBtn').onclick = undoReset;
  $('#foldBtn').onclick = () => {
    // Fold everything ON SCREEN, unless it already is — then open it back up.
    // "On screen" depends on the view: the Now blocks and the board's sections
    // are different sets, and folding the ones you cannot see is a button that
    // appears to do nothing.
    const keys = VIEW.mode === 'now'
      ? [...document.querySelectorAll('#main [data-phase]')].map(b => b.dataset.phase)
      : buckets().map(b => `${VIEW.groupBy}:${b.id}`);
    if (keys.length && keys.every(k => COLLAPSED.has(k))) keys.forEach(k => COLLAPSED.delete(k));
    else keys.forEach(k => COLLAPSED.add(k));
    saveCollapsed(); render();
  };

  $('#bulkNext').onclick = () => bulk(t => t.status = 'next');
  $('#bulkOngoing').onclick = () => bulk(t => t.status = 'ongoing');
  $('#bulkDone').onclick = () => bulk(t => t.status = 'done');
  $('#bulkCurrent').onclick = () => bulk(t => t.current = true);
  $('#bulkMine').onclick = () => { if (ME) bulk(t => { if (!t.assignees.includes(ME)) t.assignees.push(ME); }); };
  $('#bulkClear').onclick = () => { SELECTED.clear(); render(); };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $('#modal').hidden = true;
      if (OPEN_TASK) { OPEN_TASK = null; $('#drawer').hidden = true; }
      return;
    }
    // Everything below is a bare keystroke, so never while somebody is typing.
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); $('#search').focus(); $('#search').select(); }
    else if (e.key === '?') { e.preventDefault(); openKeys(); }
    else if (e.key === 'f') { e.preventDefault(); $('#foldBtn').click(); }
    else if (e.key === 'c') { e.preventDefault(); clearFilters(); }
    else if (e.key >= '1' && e.key <= String(MODES.length)) {
      e.preventDefault(); setMode(MODES[Number(e.key) - 1].toLowerCase());
    }
  });
}

function openKeys() {
  const m = $('#modal');
  m.hidden = false;
  const rows = [
    ['/', 'Jump to search'],
    ['1 – 5', 'Now, Board, List, Timeline, People'],
    ['f', 'Fold or unfold every section'],
    ['c', 'Clear all filters'],
    ['Esc', 'Close this, or the task drawer'],
    ['?', 'This card'],
  ];
  m.innerHTML = `<div class="sheet">
    <h3>Keyboard</h3>
    <div class="keys">${rows.map(([k, v]) => `<div class="keyrow"><kbd>${esc(k)}</kbd><span>${esc(v)}</span></div>`).join('')}</div>
    <button class="btn small" id="closeKeys">Close</button>
  </div>`;
  $('#closeKeys').onclick = () => { m.hidden = true; };
}

function paintBulk() {
  $('#bulkbar').hidden = SELECTED.size === 0;
  $('#bulkcount').textContent = `${SELECTED.size} selected`;
}

function setMode(m) {
  VIEW.mode = m;
  MODES.forEach(x => {
    const b = $('#mode' + x);
    if (b) b.classList.toggle('on', x.toLowerCase() === m);
  });
  render();
}

/* ---------------------------------------------------------- shared views --
   A filtered board is the thing people actually want to send each other
   ("everything of Nimesh's that is blocked"). Keeping VIEW in the URL makes
   the address bar the sharing mechanism, and costs no storage and no server. */

const VIEW_DEFAULTS = { group: 'all', person: 'all', tag: 'all', status: 'all', q: '', mode: 'now', groupBy: 'phase', mine: false };

function viewToUrl() {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(VIEW)) {
    if (v !== VIEW_DEFAULTS[k] && v !== '' && v !== false) q.set(k, String(v));
  }
  const url = q.toString() ? `${location.pathname}?${q}` : location.pathname;
  if (url === location.pathname + location.search) return;
  /* Safari caps replaceState at 100 calls in 30 seconds and throws past it.
     Typing used to call this once per keystroke; it is now once per settled
     view, but a board left open all day should still never throw here. */
  try { history.replaceState(null, '', url); } catch { /* the board matters more than the address bar */ }
}

function urlToView() {
  const q = new URLSearchParams(location.search);
  for (const k of ['group', 'person', 'tag', 'status', 'q']) {
    const v = q.get(k);
    if (v) VIEW[k] = v;
  }
  // A hand-edited or stale link must not be able to wedge the board on a view
  // that does not exist, so anything unrecognised falls back to the default.
  const mode = q.get('mode');
  if (mode && MODES.some(m => m.toLowerCase() === mode)) VIEW.mode = mode;
  const gb = q.get('groupBy');
  if (gb && GROUPINGS[gb]) VIEW.groupBy = gb;
  VIEW.mine = q.get('mine') === 'true';
}

const MODES = ['Now', 'Board', 'List', 'Timeline', 'People'];

/** Reflect a restored VIEW back onto the menus and the mode buttons. */
function paintViewControls() {
  const pairs = [['fPhase', 'group'], ['fPerson', 'person'], ['fStatus', 'status'], ['fTag', 'tag']];
  for (const [id, k] of pairs) {
    const el = $('#' + id); if (!el) continue;
    el.value = VIEW[k];
    el.classList.toggle('set', VIEW[k] !== 'all');
  }
  const gb = $('#fGroupBy');
  if (gb) { gb.value = VIEW.groupBy; gb.classList.toggle('set', VIEW.groupBy !== 'phase'); }
  const mine = $('#fMine');
  if (mine) {
    mine.classList.toggle('on', VIEW.mine);
    mine.setAttribute('aria-pressed', String(VIEW.mine));
    // Filtering to "mine" is meaningless before you have said who you are.
    mine.disabled = !ME;
    mine.title = ME ? '' : 'Sign in first';
  }
  $('#search').value = VIEW.q || '';
  MODES.forEach(x => {
    const b = $('#mode' + x);
    if (b) b.classList.toggle('on', x.toLowerCase() === VIEW.mode);
  });
}

/* --------------------------------------------------------------- controls --
   This was every phase, person, status and tag rendered as a flat pill: about
   forty of them, four wrapped rows, sitting above the work and dwarfing it.
   Menus hold the same choices in one row, and native <select> is deliberate —
   it brings its own keyboard handling, its own screen-reader semantics and the
   platform's own picker on a phone, none of which a hand-rolled popover would
   get right for free. */

function buildControls() {
  const opt = (v, label, on) => `<option value="${esc(v)}"${on ? ' selected' : ''}>${esc(label)}</option>`;
  const menu = (id, label, options) =>
    `<span class="selw"><select class="sel" id="${id}" aria-label="${esc(label)}">${options}</select></span>`;

  const groupBy = menu('fGroupBy', 'Group the board by',
    Object.entries(GROUPINGS).map(([k, g]) => opt(k, g.label, VIEW.groupBy === k)).join(''));

  const phase = menu('fPhase', 'Filter by phase',
    opt('all', 'All phases', VIEW.group === 'all') +
    GROUPS.map(g => opt(g.id, g.name, VIEW.group === g.id)).join(''));

  const person = menu('fPerson', 'Filter by person',
    opt('all', 'Everyone', VIEW.person === 'all') +
    STATE.people.map(p => opt(p.id, p.name, VIEW.person === p.id)).join('') +
    opt('unassigned', 'Unassigned', VIEW.person === 'unassigned'));

  const status = menu('fStatus', 'Filter by status',
    opt('all', 'Any status', VIEW.status === 'all') +
    ['ongoing', 'next', 'blocked', 'done'].map(s => opt(s, statusLabel(s), VIEW.status === s)).join(''));

  const tag = menu('fTag', 'Filter by tag',
    opt('all', 'Any tag', VIEW.tag === 'all') +
    TAGS.map(x => opt(x, x, VIEW.tag === x)).join(''));

  $('#filters').innerHTML = `
    <div class="rail">
      <span class="rail-label">Group by</span>${groupBy}
      <span class="rail-sep" aria-hidden="true"></span>
      <span class="rail-label">Show</span>${phase}${person}${status}${tag}
      <button class="mine-btn" id="fMine" aria-pressed="false">Only mine</button>
    </div>
    <div class="rail active-rail" id="activeRail" hidden></div>`;
}

/** Every filter currently narrowing the board, in the order they read. */
function filtersActive() {
  const out = [];
  if (VIEW.group !== 'all') {
    const g = groupById(VIEW.group);
    out.push({ k: 'group', key: 'Phase', text: g ? g.name : VIEW.group });
  }
  if (VIEW.person !== 'all') {
    const p = personById(VIEW.person);
    out.push({ k: 'person', key: 'Person', text: VIEW.person === 'unassigned' ? 'Unassigned' : (p ? p.name : VIEW.person) });
  }
  if (VIEW.mine) out.push({ k: 'mine', key: 'Only', text: 'Mine' });
  if (VIEW.status !== 'all') out.push({ k: 'status', key: 'Status', text: statusLabel(VIEW.status) });
  if (VIEW.tag !== 'all') out.push({ k: 'tag', key: 'Tag', text: VIEW.tag });
  if (VIEW.q.trim()) out.push({ k: 'q', key: 'Search', text: VIEW.q.trim() });
  return out;
}

/* A filtered board and an empty board look identical, and one of them is a bug
   report. This row says which is which, and every chip is its own undo. */
function paintActiveRail() {
  const rail = $('#activeRail'); if (!rail) return;
  const on = filtersActive();
  if (!on.length) { rail.hidden = true; rail.innerHTML = ''; return; }
  rail.hidden = false;
  const shown = visibleTasks().length;
  rail.innerHTML =
    `<span class="shown-count">${shown} of ${STATE.tasks.length} shown</span>` +
    on.map(f => `<button class="act" data-drop="${f.k}"><span class="k">${esc(f.key)}</span>${esc(f.text)}<span class="x2" aria-hidden="true">✕</span></button>`).join('') +
    `<button class="link" id="clearFilters">Clear all</button>`;
}

/** Put every filter back to "everything". */
function clearFilters() {
  VIEW.group = VIEW.person = VIEW.tag = VIEW.status = 'all';
  VIEW.mine = false; VIEW.q = '';
  $('#search').value = '';
  paintViewControls(); render();
}

/* ------------------------------------------------------------------ boot -- */

async function boot() {
  const local = loadLocal();
  // A device holding an older revision of the plan gets the new one, keeping
  // whatever was done on it. Without this, "I already opened this board once"
  // is enough to never see an update again.
  if (local) STATE = local.seedRev === SEED_REV ? local : adoptSeed(buildSeed(), local);
  ME = localStorage.getItem(ME_KEY);

  if (shared()) {
    try {
      const remote = await pullShared();
      if (!remote) {
        await pushShared(STATE);
      } else if (remote.seedRev === SEED_REV) {
        STATE = mergeDocs(STATE, remote);
      } else {
        // The shared copy predates this revision of the plan. Rebuild from the
        // new plan, carry people's work across, and publish it once so the rest
        // of the team stops reading the old one too.
        STATE = adoptSeed(buildSeed(), remote);
        await pushShared(STATE);
      }
      LAST_SYNC = new Date();
    } catch (e) { console.warn('initial sync failed', e); }
    setInterval(poll, SYNC.pollMs);
  }

  urlToView();
  // A link that says "only mine" is meaningless to someone who has not said
  // who they are; honouring it would show them an empty board.
  if (VIEW.mine && !ME) VIEW.mine = false;

  buildControls(); wire(); paintIdentity(); paintViewControls(); render();
}

document.addEventListener('DOMContentLoaded', boot);

