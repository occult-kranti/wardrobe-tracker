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
    comments: [],
    updatedAt: nowISO(),
    order: i,
  }));
  return { version: 1, tasks, people: PEOPLE.slice(), updatedAt: nowISO() };
}

let STATE = buildSeed();
let ME = null;
let VIEW = { group: 'all', person: 'all', tag: 'all', status: 'all', q: '', mode: 'board' };
let SELECTED = new Set();
let OPEN_TASK = null;
let SYNCING = false;
let LAST_SYNC = null;

/* ------------------------------------------------------------- storage --- */

const LOCAL_KEY = `almari-${BOARD_KEY}-state`;
const ME_KEY = `almari-${BOARD_KEY}-me`;
const SHUT_KEY = `almari-${BOARD_KEY}-collapsed`;

/** Which phases are folded shut. Per device, like a desk left as you left it. */
const COLLAPSED = new Set(
  (() => { try { return JSON.parse(localStorage.getItem(SHUT_KEY) || '[]'); } catch { return []; } })()
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
    if (!other || (t.updatedAt || '') >= (other.updatedAt || '')) byId.set(t.id, t);
  }
  const people = [...theirs.people];
  for (const p of mine.people) if (!people.some(x => x.id === p.id)) people.push(p);
  return { version: 1, tasks: [...byId.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), people, updatedAt: nowISO() };
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

function visibleTasks() {
  const q = VIEW.q.trim().toLowerCase();
  return STATE.tasks.filter(t => {
    if (VIEW.group !== 'all' && t.group !== VIEW.group) return false;
    // "Unassigned" is a predicate, not a person: testing it as a person id
    // matched nothing and silently emptied the board.
    if (VIEW.person === 'unassigned') {
      if ((t.assignees || []).length) return false;
    } else if (VIEW.person !== 'all' && !(t.assignees || []).includes(VIEW.person)) {
      return false;
    }
    if (VIEW.tag !== 'all' && !(t.tags || []).includes(VIEW.tag)) return false;
    if (VIEW.status !== 'all' && t.status !== VIEW.status) return false;
    if (q && !(`${t.title} ${t.why} ${t.check}`.toLowerCase().includes(q))) return false;
    return true;
  });
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
        <span class="st st-${t.status}">${t.status === 'ongoing' ? 'On now' : t.status === 'done' ? 'Done' : t.status === 'blocked' ? 'Blocked' : 'Next'}</span>
        ${t.current ? '<span class="pin">Current focus</span>' : ''}
        ${g && VIEW.group === 'all' ? `<span class="gtag">${esc(g.name)}</span>` : ''}
      </div>
      <h4>${esc(t.title)}</h4>
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
  const tasks = visibleTasks();
  const groups = VIEW.group === 'all' ? GROUPS : GROUPS.filter(g => g.id === VIEW.group);
  let html = '';
  for (const g of groups) {
    const mine = tasks.filter(t => t.group === g.id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!mine.length) continue;
    const done = mine.filter(t => t.status === 'done').length;
    const shut = COLLAPSED.has(g.id);
    html += `
    <section class="phase ${shut ? 'shut' : ''}">
      <header class="phase-head">
        <div>
          <button class="phase-toggle" data-phase="${g.id}" aria-expanded="${!shut}" aria-controls="tasks-${g.id}">
            <span class="chev" aria-hidden="true"></span><span class="ph-name">${esc(g.name)}</span>
          </button>
          <p class="phase-note">${esc(g.note)}</p>
        </div>
        <div class="phase-meta">
          <span class="win">${esc(g.window)}</span>
          <span class="count">${done}/${mine.length} done</span>
        </div>
      </header>
      <div class="tasks" id="tasks-${g.id}"${shut ? ' hidden' : ''}>${mine.map(taskRow).join('')}</div>
    </section>`;
  }
  return html || `<p class="empty">Nothing matches those filters.</p>`;
}

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
    const mine = STATE.tasks.filter(t => (t.assignees || []).includes(p.id));
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

function render() {
  const main = $('#main');
  main.innerHTML = VIEW.mode === 'timeline' ? renderTimeline()
    : VIEW.mode === 'people' ? renderPeople()
    : renderBoard();

  const total = STATE.tasks.length;
  const done = STATE.tasks.filter(t => t.status === 'done').length;
  const ongoing = STATE.tasks.filter(t => t.status === 'ongoing').length;
  const blocked = STATE.tasks.filter(t => t.status === 'blocked').length;
  $('#stats').innerHTML = `<b>${done}</b>/${total} done · <b>${ongoing}</b> on now${blocked ? ` · <b>${blocked}</b> blocked` : ''}`;

  $('#bulkbar').hidden = SELECTED.size === 0;
  $('#bulkcount').textContent = `${SELECTED.size} selected`;
  paintSyncState();
  viewToUrl();
  if (OPEN_TASK) paintDrawer();
}

/* ------------------------------------------------------------- drawer ---- */

function paintDrawer() {
  const t = STATE.tasks.find(x => x.id === OPEN_TASK);
  const dr = $('#drawer');
  if (!t) { dr.hidden = true; OPEN_TASK = null; return; }
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
    <div class="dr-row"><label>Why this exists</label><textarea id="drWhy" rows="4" ${ME ? '' : 'disabled'}>${esc(t.why || '')}</textarea></div>
    <div class="dr-row"><label>Checklist / notes</label><textarea id="drCheck" rows="3" ${ME ? '' : 'disabled'}>${esc(t.check || '')}</textarea></div>
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
    const fold = e.target.closest('[data-phase]');
    if (fold) {
      const id = fold.dataset.phase;
      if (COLLAPSED.has(id)) COLLAPSED.delete(id); else COLLAPSED.add(id);
      saveCollapsed(); render(); return;
    }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const id = pick.dataset.pick;
      if (SELECTED.has(id)) SELECTED.delete(id); else SELECTED.add(id);
      render(); return;
    }
    const open = e.target.closest('[data-open]');
    if (open) { OPEN_TASK = open.dataset.open; paintDrawer(); }
  });

  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    const [k, v] = b.dataset.filter.split(':');
    VIEW[k] = v;
    $('#filters').querySelectorAll(`[data-filter^="${k}:"]`).forEach(x => x.classList.toggle('on', x === b));
    render();
  });

  $('#modeBoard').onclick = () => setMode('board');
  $('#modeTimeline').onclick = () => setMode('timeline');
  $('#modePeople').onclick = () => setMode('people');
  $('#search').oninput = e => { VIEW.q = e.target.value; render(); };
  $('#newTaskBtn').onclick = newTask;
  $('#exportBtn').onclick = exportJSON;
  $('#foldBtn').onclick = () => {
    // Fold everything, unless everything is already folded — then open it back up.
    const shown = GROUPS.filter(g => STATE.tasks.some(t => t.group === g.id));
    if (shown.every(g => COLLAPSED.has(g.id))) COLLAPSED.clear();
    else for (const g of shown) COLLAPSED.add(g.id);
    saveCollapsed(); render();
  };

  $('#bulkNext').onclick = () => bulk(t => t.status = 'next');
  $('#bulkOngoing').onclick = () => bulk(t => t.status = 'ongoing');
  $('#bulkDone').onclick = () => bulk(t => t.status = 'done');
  $('#bulkCurrent').onclick = () => bulk(t => t.current = true);
  $('#bulkMine').onclick = () => { if (ME) bulk(t => { if (!t.assignees.includes(ME)) t.assignees.push(ME); }); };
  $('#bulkClear').onclick = () => { SELECTED.clear(); render(); };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { $('#modal').hidden = true; if (OPEN_TASK) { OPEN_TASK = null; $('#drawer').hidden = true; } }
  });
}

function setMode(m) {
  VIEW.mode = m;
  ['Board', 'Timeline', 'People'].forEach(x => $('#mode' + x).classList.toggle('on', x.toLowerCase() === m));
  render();
}

/* ---------------------------------------------------------- shared views --
   A filtered board is the thing people actually want to send each other
   ("everything of Nimesh's that is blocked"). Keeping VIEW in the URL makes
   the address bar the sharing mechanism, and costs no storage and no server. */

function viewToUrl() {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(VIEW)) {
    if (v && v !== 'all' && !(k === 'mode' && v === 'board')) q.set(k, v);
  }
  const url = q.toString() ? `${location.pathname}?${q}` : location.pathname;
  history.replaceState(null, '', url);
}

function urlToView() {
  const q = new URLSearchParams(location.search);
  for (const k of ['group', 'person', 'tag', 'status', 'q', 'mode']) {
    const v = q.get(k);
    if (v) VIEW[k] = v;
  }
}

/** Reflect a restored VIEW back onto the filter chips and mode buttons. */
function paintViewControls() {
  for (const k of ['group', 'person', 'tag', 'status']) {
    const chips = $('#filters').querySelectorAll(`[data-filter^="${k}:"]`);
    chips.forEach(c => c.classList.toggle('on', c.dataset.filter === `${k}:${VIEW[k]}`));
  }
  $('#search').value = VIEW.q || '';
  ['Board', 'Timeline', 'People'].forEach(x => $('#mode' + x).classList.toggle('on', x.toLowerCase() === VIEW.mode));
}

function buildFilters() {
  const groupBtns = [`<button class="fchip on" data-filter="group:all">All phases</button>`]
    .concat(GROUPS.map(g => `<button class="fchip" data-filter="group:${g.id}">${esc(g.name)}</button>`)).join('');
  const peopleBtns = [`<button class="fchip on" data-filter="person:all">Everyone</button>`]
    .concat(STATE.people.map(p => `<button class="fchip" data-filter="person:${p.id}">${esc(p.name)}</button>`))
    .concat([`<button class="fchip" data-filter="person:unassigned">Unassigned</button>`]).join('');
  const statusBtns = ['all', 'next', 'ongoing', 'blocked', 'done']
    .map(s => `<button class="fchip ${s === 'all' ? 'on' : ''}" data-filter="status:${s}">${s === 'all' ? 'Any status' : s === 'ongoing' ? 'On now' : s[0].toUpperCase() + s.slice(1)}</button>`).join('');
  const tagBtns = [`<button class="fchip on" data-filter="tag:all">Any tag</button>`]
    .concat(TAGS.map(x => `<button class="fchip" data-filter="tag:${x}">${esc(x)}</button>`)).join('');
  $('#filters').innerHTML = `
    <div class="frow">${groupBtns}</div>
    <div class="frow">${peopleBtns}</div>
    <div class="frow">${statusBtns}${tagBtns}</div>`;
}

/* ------------------------------------------------------------------ boot -- */

async function boot() {
  const local = loadLocal();
  if (local) STATE = local;
  ME = localStorage.getItem(ME_KEY);

  if (shared()) {
    try {
      const remote = await pullShared();
      if (remote) STATE = mergeDocs(STATE, remote);
      else await pushShared(STATE);
      LAST_SYNC = new Date();
    } catch (e) { console.warn('initial sync failed', e); }
    setInterval(poll, SYNC.pollMs);
  }

  urlToView();
  buildFilters(); wire(); paintIdentity(); paintViewControls(); render();
}

document.addEventListener('DOMContentLoaded', boot);

