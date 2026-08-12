// Demo film v4 — the slow cut. The v3 shoot moved like a tour; this one moves
// like a demonstration: eight scenes instead of sixteen, one idea per scene,
// the product on screen from the second frame, every action landing into two
// full seconds of stillness before anything else happens. The doctrine is the
// launch-film canon: show the product immediately, demo the core loop at real
// speed, hold the result long enough to believe, end on plain facts.
//
// Usage: node scripts/film-v4.mjs <outDir> [wide|vertical|both]
//   needs the v1 preview on :4173 and the v2 preview on :4174
import { chromium } from 'playwright';
import { mkdirSync, renameSync, unlinkSync } from 'node:fs';

const out = process.argv[2] ?? './film4';
const which = process.argv[3] ?? 'both';
mkdirSync(out, { recursive: true });
const V1 = 'http://localhost:4173';
const V2 = 'http://localhost:4174';

const b = await chromium.launch();

function helpers(p, { vertical = false } = {}) {
  const wait = ms => p.waitForTimeout(ms);

  /** Freeze-caption, v4 tempo: the words get their reading time plus a
      breath, and the stillness continues a beat after they go. */
  const freeze = async text => {
    const words = text.split(/\s+/).length;
    const life = Math.min(2600, 1200 + 380 * words);
    await p.evaluate(([t, vert]) => {
      let el = document.getElementById('film-caption');
      if (!el) {
        el = document.createElement('div');
        el.id = 'film-caption';
        el.style.cssText = [
          'position:fixed', 'left:50%',
          vert ? 'top:24%' : 'top:50%',
          vert ? 'transform:translateX(-50%)' : 'transform:translate(-50%,-50%)',
          vert ? 'padding:11px 20px' : 'padding:14px 32px',
          'background:rgba(14,12,10,0.88)', 'color:#F6F1E7',
          vert ? 'font:500 25px Georgia,serif' : 'font:500 21px Georgia,serif',
          'letter-spacing:0.13em', 'text-transform:uppercase',
          'border:1px solid rgba(211,154,133,0.6)', 'border-radius:2px',
          'z-index:2147483647', 'pointer-events:none', 'transition:opacity 160ms',
          vert ? 'white-space:normal' : 'white-space:nowrap',
          'max-width:88vw', 'text-align:center', 'line-height:1.45',
        ].join(';');
        document.body.appendChild(el);
      }
      el.textContent = t;
      el.style.opacity = '1';
    }, [text, vertical]);
    await wait(life);
    await p.evaluate(() => {
      const el = document.getElementById('film-caption');
      if (el) el.style.opacity = '0';
    });
    await wait(700);
  };

  const scene = async (name, fn) => {
    try {
      await fn();
    } catch (err) {
      console.warn(`scene skipped: ${name} — ${String(err).split('\n')[0]}`);
      await p.keyboard.press('Escape').catch(() => {});
      await wait(250);
      await p.keyboard.press('Escape').catch(() => {});
    }
  };

  const vis = re => p.getByRole('button', { name: re }).filter({ visible: true }).first();

  /** The slow scroll: small ticks with real pauses — a reader's pace. */
  const drift = async (total, ticks = 8) => {
    for (let i = 0; i < ticks; i++) {
      await p.mouse.wheel(0, total / ticks);
      await wait(320);
    }
  };

  const sheenSweep = async (x0, y0, x1, y1, steps = 34, ms = 80) => {
    for (let i = 0; i <= steps; i++) {
      await p.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      await wait(ms);
    }
  };

  return { wait, freeze, scene, vis, drift, sheenSweep };
}

async function prep(page, base, { signOut = true, activeId = null } = {}) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const install = page.getByRole('button', { name: /sample wardrobes/i });
  if (await install.count()) {
    await install.click();
    await page.waitForTimeout(1100);
  }
  await page.evaluate(([wantSignOut, active]) => {
    const d = new Date();
    const day = n => {
      const x = new Date(d);
      x.setDate(x.getDate() + n);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    };
    const aKey = 'wardrobe-tracker:aarav';
    const a = JSON.parse(localStorage.getItem(aKey) ?? 'null');
    if (a && !a.wishlist.some(w => w.id === 'film-w1')) {
      a.wishlist.unshift(
        { id: 'film-w1', name: 'Raw selvedge jacket', category: 'outerwear', color: '#33415C', price: 240, priority: 'medium', dateAdded: day(-3), status: 'waiting', coolingOff: { endsAt: day(4), asked: false } },
        { id: 'film-w2', name: 'Camel wool coat', category: 'outerwear', color: '#B08B5E', price: 210, priority: 'medium', dateAdded: day(-16), status: 'let-go', releasedAt: day(-2) }
      );
      localStorage.setItem(aKey, JSON.stringify(a));
    }
    const vKey = 'wardrobe-tracker:vikram';
    const v = JSON.parse(localStorage.getItem(vKey) ?? 'null');
    if (v && !v.wearLogs.some(l => l.id === 'film-plan-1')) {
      v.wearLogs.push({ id: 'film-plan-1', date: day(0), itemIds: v.items.slice(0, 3).map(i => i.id), planned: true });
      localStorage.setItem(vKey, JSON.stringify(v));
    }
    if (wantSignOut) localStorage.removeItem('toile-session');
    else if (active) localStorage.setItem('toile-session', JSON.stringify({ activeId: active }));
  }, [signOut, activeId]);
}

const openWardrobe = async (p, base, re) => {
  await p.goto(base + '/#/open', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  await p.getByRole('button', { name: re }).first().click();
  await p.waitForTimeout(1100);
};

/* ================= WIDESCREEN ================= */

if (which === 'both' || which === 'wide') {
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    recordVideo: { dir: out, size: { width: 1280, height: 720 } },
  });
  const pre = await ctx.newPage();
  await prep(pre, V2, { signOut: false, activeId: 'aarav' });
  const preVid = pre.video();
  await pre.close();

  const p = await ctx.newPage();
  const { wait, freeze, scene, vis, drift, sheenSweep } = helpers(p);

  // 1 — the product, immediately. Ten unhurried seconds of the glass.
  await scene('cold open', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(1600);
    await sheenSweep(260, 280, 1060, 470);
    await wait(900);
    await freeze('Your wardrobe, on record.');
    await wait(800);
  });

  // 2 — it begins empty; the first piece enters. One scene, one story.
  await scene('begin + first piece', async () => {
    await p.evaluate(() => localStorage.removeItem('toile-session'));
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await wait(1300);
    await vis(/^start a wardrobe$/i).click();
    await wait(800);
    await p.fill('#su-name', 'Sam Kade');
    await wait(500);
    await vis(/^start it$/i).click();
    await wait(1800);
    await freeze('It begins empty, on this device.');
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(1000);
    await vis(/add a piece|add the first piece/i).click();
    await wait(900);
    const dlg = p.getByRole('dialog');
    await p.fill('#add-item-name', 'Grey crewneck');
    const chip = dlg.getByRole('button', { name: /^tops$/i }).first();
    if (await chip.count()) await chip.click();
    await wait(400);
    await p.fill('#add-item-cost', '45');
    await wait(600);
    await dlg.getByRole('button', { name: /add to the closet/i }).click();
    await wait(2200);
    await freeze('The first piece enters the record.');
  });

  // 3 — the core loop, real speed, then stillness.
  await scene('two taps', async () => {
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await wait(1400);
    await vis(/log today's wear|log another/i).click();
    await wait(1000);
    const dialog = p.getByRole('dialog');
    const pick = dialog.getByRole('button', { name: /pick pieces instead/i }).first();
    if (await pick.count()) { await pick.click(); await wait(600); }
    await dialog.getByRole('button', { name: /grey crewneck/i }).first().click();
    await wait(500);
    await dialog.getByRole('button', { name: /^log (this|\d+ pieces)/i }).first().click();
    await wait(2600);
    await freeze('The day, answered in two taps.');
    await wait(600);
  });

  // 4 — a year-deep closet; the ledger, read slowly.
  await scene('ledger', async () => {
    await openWardrobe(p, V2, /aarav/i);
    await p.goto(V2 + '/#/ledger', { waitUntil: 'domcontentloaded' });
    await wait(2200);
    await drift(900, 9);
    await wait(1400);
    await freeze('Cost per wear, never paywalled.');
    await wait(600);
  });

  // 5 — the cooling-off; the money that stayed.
  await scene('wishlist', async () => {
    await p.goto(V2 + '/#/wishlist', { waitUntil: 'domcontentloaded' });
    await wait(2200);
    await drift(700, 7);
    await wait(1400);
    await freeze('Seven days of silence, then one question.');
    await wait(600);
  });

  // 6 — the honest calendar, then the question answered.
  await scene('honesty', async () => {
    await openWardrobe(p, V2, /vikram/i);
    await p.goto(V2 + '/#/calendar', { waitUntil: 'domcontentloaded' });
    await wait(2400);
    await freeze('Future days are plans, not wears.');
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await wait(1800);
    const wore = p.getByRole('button', { name: /^wore it$/i }).first();
    if (await wore.count()) { await wore.click(); await wait(2000); }
    await freeze('The record never assumes a wear.');
    await wait(600);
  });

  // 7 — two rooms, slowly; then home to the glass, looking only.
  await scene('rooms', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(600);
    let first = true;
    for (const room of ['gilt', 'light']) {
      await p.evaluate(([r]) => localStorage.setItem('toile-theme', JSON.stringify({ theme: r })), [room]);
      await p.reload({ waitUntil: 'domcontentloaded' });
      await wait(first ? 700 : 4200);
      if (first) { await freeze('Six rooms, one record.'); first = false; }
    }
    await p.evaluate(() => localStorage.setItem('toile-theme', JSON.stringify({ theme: 'obsidian' })));
    await p.reload({ waitUntil: 'domcontentloaded' });
    await wait(1100);
    await sheenSweep(1020, 260, 300, 480, 30, 85);
    await wait(1600);
  });

  // 8 — the end card; facts, then it stops.
  await scene('end card', async () => {
    await p.goto('about:blank');
    await p.evaluate(() => {
      document.body.style.cssText = 'margin:0;background:#0A0B0F;display:flex;align-items:center;justify-content:center;height:100vh;';
      document.body.innerHTML =
        '<div style="text-align:center;font-family:Georgia,serif;color:#F6F1E7;padding:46px 66px;' +
        'background:rgba(18,20,26,0.7);border:1px solid rgba(211,154,133,0.35);border-radius:2px">' +
        '<div style="font-size:46px;letter-spacing:0.22em;font-weight:700">TOILE</div>' +
        '<div style="width:130px;height:2px;background:#BE1231;margin:16px auto"></div>' +
        '<div style="font-size:15px;letter-spacing:0.12em;color:#D3B39E;margin-top:20px">occult-kranti.github.io/wardrobe-tracker/v2/</div>' +
        '<div style="font-size:12px;letter-spacing:0.12em;color:#A9ADBC;margin-top:8px">occult-kranti.github.io/wardrobe-tracker</div>' +
        '</div>';
    });
    await wait(900);
    await freeze('No account, no cloud, no subscription.');
    await wait(2600);
  });

  const vid = p.video();
  await ctx.close();
  renameSync(await vid.path(), `${out}/wide.webm`);
  try { unlinkSync(await preVid.path()); } catch { /* gone */ }
  console.log('widescreen recorded');
}

/* ================= VERTICAL ================= */

if (which === 'both' || which === 'vertical') {
  const ctx = await b.newContext({
    viewport: { width: 405, height: 720 },
    deviceScaleFactor: 3,
    recordVideo: { dir: out, size: { width: 405, height: 720 } },
  });
  const pre = await ctx.newPage();
  await prep(pre, V2, { signOut: false, activeId: 'meher' });
  const preVid = pre.video();
  await pre.close();

  const p = await ctx.newPage();
  const { wait, freeze, scene, drift } = helpers(p, { vertical: true });

  await scene('v-open', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(1300);
    await drift(400, 5);
    await wait(900);
    await freeze('Your wardrobe, on record.');
  });

  await scene('v-log', async () => {
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await wait(1400);
    const log = p.getByRole('button', { name: /log today's wear|log another/i }).filter({ visible: true }).first();
    await log.click();
    await wait(900);
    const dialog = p.getByRole('dialog');
    await dialog.getByRole('button').first().click();
    await wait(2000);
    await freeze('The day, answered in two taps.');
  });

  await scene('v-honesty', async () => {
    await openWardrobe(p, V2, /vikram/i);
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await wait(1600);
    const wore = p.getByRole('button', { name: /^wore it$/i }).first();
    if (await wore.count()) { await wore.click(); await wait(1600); }
    await freeze('The record never assumes a wear.');
  });

  await scene('v-ledger', async () => {
    await openWardrobe(p, V2, /aarav/i);
    await p.goto(V2 + '/#/ledger', { waitUntil: 'domcontentloaded' });
    await wait(1600);
    await drift(500, 6);
    await wait(1100);
    await freeze('Cost per wear, never paywalled.');
  });

  await scene('v-wishlist', async () => {
    await p.goto(V2 + '/#/wishlist', { waitUntil: 'domcontentloaded' });
    await wait(1500);
    await drift(600, 6);
    await wait(1100);
    await freeze('Seven days of silence, then one question.');
  });

  await scene('v-rooms', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    let first = true;
    for (const room of ['gilt', 'light']) {
      await p.evaluate(([r]) => localStorage.setItem('toile-theme', JSON.stringify({ theme: r })), [room]);
      await p.reload({ waitUntil: 'domcontentloaded' });
      await wait(first ? 600 : 2600);
      if (first) { await freeze('Six rooms, one record.'); first = false; }
    }
    await p.evaluate(() => localStorage.setItem('toile-theme', JSON.stringify({ theme: 'obsidian' })));
  });

  await scene('v-end', async () => {
    await p.goto('about:blank');
    await p.evaluate(() => {
      document.body.style.cssText = 'margin:0;background:#0A0B0F;display:flex;align-items:center;justify-content:center;height:100vh;';
      document.body.innerHTML =
        '<div style="text-align:center;font-family:Georgia,serif;color:#F6F1E7;padding:38px 30px;' +
        'background:rgba(18,20,26,0.7);border:1px solid rgba(211,154,133,0.35);border-radius:2px">' +
        '<div style="font-size:38px;letter-spacing:0.2em;font-weight:700">TOILE</div>' +
        '<div style="width:110px;height:2px;background:#BE1231;margin:14px auto"></div>' +
        '<div style="font-size:12.5px;letter-spacing:0.1em;color:#D3B39E;margin-top:16px">occult-kranti.github.io/wardrobe-tracker/v2/</div>' +
        '</div>';
    });
    await wait(700);
    await freeze('No account, no cloud, no subscription.');
    await wait(2200);
  });

  const vid = p.video();
  await ctx.close();
  renameSync(await vid.path(), `${out}/vertical.webm`);
  try { unlinkSync(await preVid.path()); } catch { /* gone */ }
  console.log('vertical recorded');
}

await b.close();
console.log('v4 takes complete in', out);
