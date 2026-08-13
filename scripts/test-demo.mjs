import { build } from 'esbuild';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
const out = join(mkdtempSync(join(tmpdir(),'demo-')),'d.mjs');
await build({ entryPoints:[new URL('../src/lib/demoData.ts', import.meta.url).pathname], bundle:true, format:'esm', outfile:out, logLevel:'error' });
const { buildDemoState, DEMO_SUMMARY } = await import(out);
const s = buildDemoState();
const active = s.items.filter(i=>!i.retired);
const jew = active.filter(i=>i.category==='jewellery');
const withJew = s.outfits.filter(o=>o.itemIds.some(id=>jew.some(j=>j.id===id)));
// Local date, never toISOString(): west of UTC in the evening that returns
// tomorrow, which silently reclassifies the D(+1) planned row as past and drops
// 'planned future days' from 2 to 1. Same bug class the app itself already fixed.
const d0 = new Date();
const today = `${d0.getFullYear()}-${String(d0.getMonth()+1).padStart(2,'0')}-${String(d0.getDate()).padStart(2,'0')}`;
const planned = s.wearLogs.filter(l=>l.date>today);
const ids = new Set(s.items.map(i=>i.id));
const dangling = s.outfits.flatMap(o=>o.itemIds.filter(id=>!ids.has(id))).concat(s.wearLogs.flatMap(l=>l.itemIds.filter(id=>!ids.has(id))));
const checks = [
 ['items seeded', s.items.length>=30, s.items.length],
 ['jewellery pieces', jew.length>=5, jew.length],
 ['dresses/one-pieces', active.filter(i=>i.category==='dresses').length>=4, active.filter(i=>i.category==='dresses').length],
 ['outfits saved', s.outfits.length>=6, s.outfits.length],
 ['outfits WITH jewellery', withJew.length===s.outfits.length, `${withJew.length}/${s.outfits.length}`],
 ['wear logs', s.wearLogs.length>=25, s.wearLogs.length],
 ['planned future days', planned.length>=2, planned.length],
 ['no dangling item refs', dangling.length===0, dangling.join(',')],
 ['retired pieces present', s.items.filter(i=>i.retired).length>=2, s.items.filter(i=>i.retired).length],
 ['benched pieces present', active.filter(i=>['needs-repair','at-tailor'].includes(i.laundryStatus)).length>=2, active.filter(i=>['needs-repair','at-tailor'].includes(i.laundryStatus)).length],
 ['self-made pieces', active.filter(i=>i.source==='self-made').length>=3, active.filter(i=>i.source==='self-made').length],
 ['no-photo pieces (drawn stand-in)', active.filter(i=>!i.imageUrl).length>=2, active.filter(i=>!i.imageUrl).length],
 ['never-worn pieces', active.filter(i=>i.wearCount===0).length>=2, active.filter(i=>i.wearCount===0).length],
 ['wishlist waiting+expired', s.wishlist.filter(w=>w.status==='waiting').length>=2, s.wishlist.filter(w=>w.status==='waiting').length],
 ['wishlist let-go ledger', s.wishlist.filter(w=>w.status==='let-go').length>=2, s.wishlist.filter(w=>w.status==='let-go').length],
 ['all sources represented', new Set(active.map(i=>i.source).filter(Boolean)).size>=6, [...new Set(active.map(i=>i.source).filter(Boolean))].join('/')],
 ['brands present', new Set(active.map(i=>i.brand).filter(Boolean)).size>=8, new Set(active.map(i=>i.brand).filter(Boolean)).size],
 ['fitsLike coverage', active.filter(i=>i.fitsLike).length>=15, active.filter(i=>i.fitsLike).length],
 ['no emoji anywhere', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(JSON.stringify(s)), ''],
 ['no remote urls (offline-first)', !/https?:\/\//.test(JSON.stringify(s)), ''],
 ['theme dark by default', s.settings.theme==='dark', s.settings.theme],
 ['jewellery in taxonomy', s.settings.categories.some(c=>c.id==='jewellery'), ''],
 ...consistency(),
];

/**
 * The demo used to assert 639 wears while its own logs implied 133 — a 4.8x
 * contradiction that made every per-month number disagree with the headline.
 * logWear() maintains one invariant: a non-future log increments wearCount by
 * one per credited piece and moves lastWorn forward. These check the fixture
 * obeys the same rule the app does.
 */
function consistency() {
  const past = s.wearLogs.filter(l => l.date <= today);
  const wears = new Map(), last = new Map();
  for (const l of past) for (const id of l.itemIds) {
    wears.set(id, (wears.get(id) ?? 0) + 1);
    if (!last.has(id) || l.date > last.get(id)) last.set(id, l.date);
  }
  const byId = new Map(s.items.map(i => [i.id, i]));

  const badCount = s.items.filter(i => i.wearCount !== (wears.get(i.id) ?? 0));
  const badLast = s.items.filter(i => (i.lastWorn ?? null) !== (last.get(i.id) ?? null));
  const badOutfit = s.outfits.filter(o =>
    o.wearCount !== past.filter(l => l.outfitId === o.id).length);
  const beforeAdded = past.filter(l => l.itemIds.some(id => {
    const i = byId.get(id); return i && l.date < i.dateAdded.slice(0,10);
  }));
  const afterRetired = past.filter(l => l.itemIds.some(id => {
    const i = byId.get(id); return i && i.retired && l.date >= i.retired.date;
  }));
  const retiredWears = s.items.filter(i => i.retired).reduce((a,i) => a + i.wearCount, 0);

  const monthsSet = [...new Set(past.map(l => l.date.slice(0,7)))].sort();
  // No hole inside the charted window: an empty month renders as a bar clamped
  // to 3% height, which reads as a rendering fault rather than a quiet month.
  const charted = monthsSet.slice(-12);
  let holes = 0;
  for (let i = 1; i < charted.length; i++) {
    const [py, pm] = charted[i-1].split('-').map(Number);
    const expect = new Date(py, pm, 1);
    const key = `${expect.getFullYear()}-${String(expect.getMonth()+1).padStart(2,'0')}`;
    if (key !== charted[i]) holes++;
  }
  // Seasonal swing must be real: the busiest month should outrun the quietest
  // whole month by a clear margin, or the chart is a flat line.
  const wholeMonths = monthsSet.slice(-13, -1);
  const perMonth = wholeMonths.map(m =>
    past.filter(l => l.date.slice(0,7) === m).reduce((a,l) => a + l.itemIds.length, 0));
  const swing = perMonth.length ? Math.max(...perMonth) / Math.max(1, Math.min(...perMonth)) : 0;

  return [
    ['wearCount matches the log', badCount.length === 0, badCount.map(i=>i.name).slice(0,3).join(',')],
    ['lastWorn matches the log', badLast.length === 0, badLast.map(i=>i.name).slice(0,3).join(',')],
    ['outfit wearCount matches the log', badOutfit.length === 0, badOutfit.map(o=>o.name).slice(0,3).join(',')],
    ['no wear before a piece was added', beforeAdded.length === 0, beforeAdded.length],
    ['no wear on or after retirement', afterRetired.length === 0, afterRetired.length],
    ['retired pieces keep their wears', retiredWears > 0, retiredWears],
    ['at least 12 months of history', monthsSet.length >= 12, monthsSet.length],
    ['no empty month in the charted window', holes === 0, holes],
    ['seasonal swing is visible', swing >= 1.5, swing.toFixed(2)+'x'],
    ...railChecks(),
  ];
}

/** The Shared Rail demo: 3 profiles, 1 group, every request state, sound refs. */
function railChecks() {
  const c = s.circle;
  const profileIds = new Set(c.profiles.map(p => p.id));
  const itemIds = new Set(s.items.map(i => i.id));
  const outfitIds = new Set(s.outfits.map(o => o.id));
  const statuses = new Set(c.messages.filter(m => m.request).map(m => m.request.status));
  const me = c.profiles.filter(p => p.isMe);
  const badMembers = c.groups.flatMap(g => g.memberIds.filter(id => !profileIds.has(id)));
  const badAuthors = c.messages.filter(m => !profileIds.has(m.authorId));
  const badLoans = c.loans.filter(l => !profileIds.has(l.withId) || (l.itemId && !itemIds.has(l.itemId)));
  const badLendable = c.profiles.flatMap(p => p.lendable.filter(l => l.itemId && !itemIds.has(l.itemId)));
  const badShowcase = c.profiles.flatMap(p => p.showcase.filter(id => !outfitIds.has(id)));
  return [
    ['rail: three profiles', c.profiles.length === 3, c.profiles.length],
    ['rail: exactly one is me', me.length === 1, me.length],
    ['rail: one group, members resolve', c.groups.length === 1 && badMembers.length === 0, badMembers.join(',')],
    ['rail: all four request states shown', ['asked','lent','declined','returned'].every(x => statuses.has(x)), [...statuses].join('/')],
    ['rail: message authors resolve', badAuthors.length === 0, badAuthors.length],
    ['rail: loans reference real people and pieces', badLoans.length === 0, badLoans.length],
    ['rail: lendable item refs resolve', badLendable.length === 0, badLendable.length],
    ['rail: showcase outfits resolve', badShowcase.length === 0, badShowcase.join(',')],
    ['rail: an active loan is out', c.loans.some(l => !l.returned), ''],
    ['rail: festival and wedding occasions seeded', ['festival','wedding','ceremony'].every(o => s.settings.occasions.includes(o)), ''],
    ['rail: custom drapes category in taxonomy', s.settings.categories.some(cat => cat.id === 'drapes'), ''],
    ['rail: no gendered address in circle copy', !/\b(ladies|girls?|women|men|his & hers)\b/i.test(JSON.stringify(c)), ''],
  ];
}
let fail=0;
for(const [n,ok,d] of checks){console.log(ok?'PASS':'FAIL','-',n, d!==''&&d!==undefined?`(${d})`:'');if(!ok)fail++;}
const cost = active.reduce((a,i)=>a+(i.cost||0),0);
const wears = active.reduce((a,i)=>a+i.wearCount,0);
console.log(`\nWardrobe: ${active.length} active pieces, $${cost} invested, ${wears} wears recorded, avg $${(cost/wears).toFixed(2)}/wear`);
console.log(fail===0?'ALL DEMO CHECKS PASSED':`${fail} FAILED`);

/* ---------- the three persona wardrobes ----------
   They ship as seeds rather than as state, so they get their own pass: the same
   log-consistency invariant, no gendered address anywhere in what reaches a
   screen, and no measurement taxonomy in the data at all. */
const pw = join(mkdtempSync(join(tmpdir(),'pw-')),'p.mjs');
await build({ entryPoints:[new URL('../src/lib/personaWardrobe.ts', import.meta.url).pathname], bundle:true, format:'esm', outfile:pw, logLevel:'error' });
const { PERSONAS, buildPersonaState } = await import(pw);

let pfail = 0;
console.log('');
for (const persona of PERSONAS) {
  const st = buildPersonaState(persona);
  const past = st.wearLogs.filter(l => l.date <= today);
  const wears = new Map(), last = new Map();
  for (const l of past) for (const id of l.itemIds) {
    wears.set(id, (wears.get(id) ?? 0) + 1);
    if (!last.has(id) || l.date > last.get(id)) last.set(id, l.date);
  }
  const badCount = st.items.filter(i => i.wearCount !== (wears.get(i.id) ?? 0)).length;
  const badLast = st.items.filter(i => (i.lastWorn ?? null) !== (last.get(i.id) ?? null)).length;
  const ids = new Set(st.items.map(i => i.id));
  const dangling = st.outfits.flatMap(o => o.itemIds.filter(x => !ids.has(x)))
    .concat(st.wearLogs.flatMap(l => l.itemIds.filter(x => !ids.has(x))))
    .concat(st.events.flatMap(e => e.reservations.flatMap(r => r.itemIds.filter(x => !ids.has(x)))));
  const outfitIds = new Set(st.outfits.map(o => o.id));
  const badRes = st.events.flatMap(e => e.reservations.filter(r => r.outfitId && !outfitIds.has(r.outfitId)));
  const planned = st.wearLogs.filter(l => l.date > today).length;
  const withPhoto = st.outfits.filter(o => o.imageUrl).length;
  // Photographs are files, not data-URIs: paths only, and no remote origin.
  const remote = /https?:\/\//.test(JSON.stringify(st));
  const seedBlob = JSON.stringify(persona);
  const checks = [
    [`${persona.id}: wearCount matches the log`, badCount === 0, badCount],
    [`${persona.id}: lastWorn matches the log`, badLast === 0, badLast],
    [`${persona.id}: no dangling item refs`, dangling.length === 0, dangling.length],
    [`${persona.id}: event reservations resolve`, badRes.length === 0, badRes.length],
    [`${persona.id}: three events seeded`, st.events.length === 3, st.events.length],
    [`${persona.id}: calendar leaves planned days`, planned >= 1, planned],
    [`${persona.id}: every outfit photographed`, withPhoto === st.outfits.length, `${withPhoto}/${st.outfits.length}`],
    [`${persona.id}: offline-safe image paths`, !remote, ''],
    [`${persona.id}: no measurements in the seed`, !('body' in persona), ''],
    [`${persona.id}: palette carries no verdict`, !/\b(wash(es)? \w+ out|drains?|flatter)/i.test(JSON.stringify(persona.palette)), ''],
    // Not "has a custom category" — Aarav's closet legitimately uses only the
    // defaults. What must hold is that no piece references a category the
    // wardrobe's own taxonomy does not define, which is what would orphan it.
    // Most tiles should be a photograph of the actual garment — but not every
    // tile: where no honest photo exists (heels, juttis, polos, swim), the
    // rule now returns the drawn flat on purpose, because a wrong-category or
    // wrong-register photo reads as a filing error while the flat reads as a
    // choice. So the check is a floor, not a total: photographs stay the
    // strong majority, and a rule that silently loses its sources still trips
    // it. (A stray escape once turned /\btie\b/ into a regex containing a
    // literal backspace, which could never match anything — that class of bug
    // still lands well below the floor.)
    [`${persona.id}: photographs are the strong majority`, st.items.filter(i => i.imageUrl).length >= st.items.length * 0.75, `${st.items.filter(i => i.imageUrl).length}/${st.items.length}`],
    [`${persona.id}: photographs resolve to files`, st.items.every(i => !i.imageUrl || /^wardrobe\//.test(i.imageUrl)), ''],
    [`${persona.id}: every piece has a category`, st.items.every(i => st.settings.categories.some(c => c.id === i.category)), st.settings.categories.length],
    // The bench states are lived-in: a closet where every piece reads "Ready"
    // and every other chip reads 0 is a showroom. Each state has at least one
    // member, clean stays the strong majority, and nothing "needs wash" that
    // the log says was never worn.
    [`${persona.id}: every bench state inhabited`,
      ['worn', 'washing', 'needs-repair', 'at-tailor'].every(x => st.items.some(i => i.laundryStatus === x)),
      ['worn', 'washing', 'needs-repair', 'at-tailor'].map(x => st.items.filter(i => i.laundryStatus === x).length).join('/')],
    [`${persona.id}: the closet is still mostly ready`,
      st.items.filter(i => i.laundryStatus === 'clean').length >= st.items.length * 0.6,
      st.items.filter(i => i.laundryStatus === 'clean').length],
    [`${persona.id}: nothing unworn queues for the wash`,
      st.items.filter(i => ['worn', 'washing'].includes(i.laundryStatus)).every(i => i.wearCount > 0), ''],
    // The honest ledger: an intention carries its stored flag, a wear never
    // does. Derived-from-date let every plan silently read as a wear the
    // morning its day arrived.
    [`${persona.id}: plans carry the stored flag`,
      st.wearLogs.filter(l => l.date > today).every(l => l.planned === true),
      st.wearLogs.filter(l => l.date > today && l.planned !== true).length],
    [`${persona.id}: wears never carry the flag`,
      st.wearLogs.filter(l => l.date <= today).every(l => l.planned !== true), ''],

    // THE FURNISHED SAMPLE. A demo wardrobe arrives with places in it, because
    // the feature is invisible until somebody draws one and a first-time
    // visitor would never learn it exists. Every rule the panel would hold us
    // to is asserted here rather than trusted.
    [`${persona.id}: the room is furnished`, st.furniture.length >= 3, `${st.furniture.length} places`],
    [`${persona.id}: no place stands empty`,
      st.furniture.every(f => st.items.some(i => i.place?.furnitureId === f.id)),
      st.furniture.filter(f => !st.items.some(i => i.place?.furnitureId === f.id)).map(f => f.name).join(', ')],
    // Not everything is filed, and that is the point: a demo where every
    // garment has an address is a demo of a filing cabinet.
    [`${persona.id}: about half is filed, never all of it`, (() => {
      const share = st.items.filter(i => i.place).length / st.items.length;
      return share > 0.25 && share < 0.7;
    })(), `${Math.round(st.items.filter(i => i.place).length / st.items.length * 100)}%`],
    [`${persona.id}: every filing resolves to a real compartment`, (() => {
      const slots = new Set(st.furniture.flatMap(f => f.slots.map(x => x.id)));
      return st.items.filter(i => i.place).every(i => slots.has(i.place.slotId));
    })(), ''],
    // The clothes are in the RIGHT compartments — shoes on the shoe tier,
    // jewellery in the tray. A kaftan in a jewellery tray is the app being
    // wrong about somebody's own wardrobe.
    [`${persona.id}: nothing is filed where it does not belong`, (() => {
      const kind = c => /shoe|boot|sneaker|sandal/i.test(c) ? 'shoes'
        : /jewel|bangle/i.test(c) ? 'jewellery'
        : /access|bag|belt|scarf/i.test(c) ? 'bags' : 'clothes';
      const wants = l => /shoe|tier/i.test(l) ? 'shoes'
        : /jewel|tray|bangle/i.test(l) ? 'jewellery'
        : /bag|peg/i.test(l) ? 'bags' : 'any';
      const slots = new Map(st.furniture.flatMap(f => f.slots.map(x => [x.id, x.label])));
      return st.items.filter(i => i.place).every(i => {
        const w = wants(slots.get(i.place.slotId) ?? '');
        return w === 'any' || w === kind(i.category);
      });
    })(), ''],
    // And one compartment is packed away, so the seasonal case is visible.
    [`${persona.id}: something is packed away for the season`,
      st.furniture.some(f => f.slots.some(x => x.packed === true)), ''],
    [`${persona.id}: the same closet every time`, (() => {
      const again = buildPersonaState(persona);
      return JSON.stringify(again.furniture) === JSON.stringify(st.furniture);
    })(), ''],
  ];
  for (const [n, ok, d] of checks) { console.log(ok ? 'PASS' : 'FAIL', '-', n, d !== '' ? `(${d})` : ''); if (!ok) pfail++; }
}
console.log(pfail === 0 ? 'ALL PERSONA CHECKS PASSED' : `${pfail} PERSONA CHECKS FAILED`);
process.exit(fail || pfail ? 1 : 0);
