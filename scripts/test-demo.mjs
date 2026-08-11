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
const today = new Date().toISOString().slice(0,10);
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
];
let fail=0;
for(const [n,ok,d] of checks){console.log(ok?'PASS':'FAIL','-',n, d!==''&&d!==undefined?`(${d})`:'');if(!ok)fail++;}
const cost = active.reduce((a,i)=>a+(i.cost||0),0);
const wears = active.reduce((a,i)=>a+i.wearCount,0);
console.log(`\nWardrobe: ${active.length} active pieces, $${cost} invested, ${wears} wears recorded, avg $${(cost/wears).toFixed(2)}/wear`);
console.log(fail===0?'ALL DEMO CHECKS PASSED':`${fail} FAILED`);
process.exit(fail?1:0);
