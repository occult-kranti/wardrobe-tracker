// Demo film v3 — shot on the V2 glass build, to the psychologist's and
// marketing lead's briefs: the picture FREEZES under every caption (the words
// never chase the motion), captions live 1.0s + 0.35s/word capped at 2s,
// no voice-over, obsidian is home, three-room montage, one V1 provenance
// cameo, and a separately-recorded native 9:16 vertical cut.
//
// Usage: node scripts/film-v3.mjs <outDir> [wide|vertical|both]
//   needs the v1 preview on :4173 and the v2 preview on :4174
import { chromium } from 'playwright';
import { mkdirSync, renameSync, unlinkSync } from 'node:fs';

const out = process.argv[2] ?? './film3';
const which = process.argv[3] ?? 'both';
mkdirSync(out, { recursive: true });
const V1 = 'http://localhost:4173';
const V2 = 'http://localhost:4174';

const b = await chromium.launch();

function helpers(p, { vertical = false } = {}) {
  const wait = ms => p.waitForTimeout(ms);

  /** The freeze-caption: the action stops, the words press in like type,
      live just long enough to read, and are gone BEFORE motion resumes. */
  const freeze = async text => {
    const words = text.split(/\s+/).length;
    const life = Math.min(2000, 1000 + 350 * words);
    await p.evaluate(([t, vert]) => {
      let el = document.getElementById('film-caption');
      if (!el) {
        el = document.createElement('div');
        el.id = 'film-caption';
        el.style.cssText = [
          'position:fixed', 'left:50%',
          vert ? 'top:24%' : 'top:50%',
          vert ? 'transform:translateX(-50%)' : 'transform:translate(-50%,-50%)',
          vert ? 'padding:11px 20px' : 'padding:13px 30px',
          'background:rgba(14,12,10,0.88)', 'color:#F6F1E7',
          vert ? 'font:500 25px Georgia,serif' : 'font:500 20px Georgia,serif',
          'letter-spacing:0.13em', 'text-transform:uppercase',
          'border:1px solid rgba(211,154,133,0.6)', 'border-radius:2px',
          'z-index:2147483647', 'pointer-events:none', 'transition:opacity 120ms',
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
    await wait(280);
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

  /** A slow pointer glide so the specular sheen visibly crosses the glass. */
  const sheenSweep = async (x0, y0, x1, y1, steps = 24, ms = 55) => {
    for (let i = 0; i <= steps; i++) {
      await p.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      await wait(ms);
    }
  };

  return { wait, freeze, scene, vis, sheenSweep };
}

/** Samples installed on an origin; Aarav's wishlist gets its wait and its
    "$210 stayed yours" release; one of Vikram's plans matures to today. */
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
    if (a) {
      if (!a.wishlist.some(w => w.id === 'film-w1')) {
        a.wishlist.unshift(
          { id: 'film-w1', name: 'Raw selvedge jacket', category: 'outerwear', color: '#33415C', price: 240, priority: 'medium', dateAdded: day(-3), status: 'waiting', coolingOff: { endsAt: day(4), asked: false } },
          { id: 'film-w2', name: 'Camel wool coat', category: 'outerwear', color: '#B08B5E', price: 210, priority: 'medium', dateAdded: day(-16), status: 'let-go', releasedAt: day(-2) }
        );
        localStorage.setItem(aKey, JSON.stringify(a));
      }
    }
    const vKey = 'wardrobe-tracker:vikram';
    const v = JSON.parse(localStorage.getItem(vKey) ?? 'null');
    if (v) {
      const today = day(0);
      if (!v.wearLogs.some(l => l.id === 'film-plan-1')) {
        v.wearLogs.push({ id: 'film-plan-1', date: today, itemIds: v.items.slice(0, 3).map(i => i.id), planned: true });
        localStorage.setItem(vKey, JSON.stringify(v));
      }
    }
    if (wantSignOut) localStorage.removeItem('toile-session');
    else if (active) localStorage.setItem('toile-session', JSON.stringify({ activeId: active }));
  }, [signOut, activeId]);
}

const openWardrobe = async (p, base, re) => {
  await p.goto(base + '/#/open', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(600);
  await p.getByRole('button', { name: re }).first().click();
  await p.waitForTimeout(900);
};

/* ================= WIDESCREEN — 1280×720 css, 1920×1080 delivered ================= */

if (which === 'both' || which === 'wide') {
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    recordVideo: { dir: out, size: { width: 1280, height: 720 } },
  });
  const pre = await ctx.newPage();
  await prep(pre, V2, { signOut: false, activeId: 'aarav' });
  await prep(pre, V1, { signOut: false, activeId: 'meher' });
  const preVid = pre.video();
  await pre.close();

  const p = await ctx.newPage();
  const { wait, freeze, scene, vis, sheenSweep } = helpers(p);

  // 1 — cold open on the glass.
  await scene('cold open', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(1100);
    await sheenSweep(280, 300, 1050, 480);
    await p.mouse.move(640, 420);
    await wait(500);
    await freeze('Your wardrobe, on record.');
  });

  // 2 — it begins empty.
  await scene('begins empty', async () => {
    await p.evaluate(() => localStorage.removeItem('toile-session'));
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await wait(900);
    await vis(/^start a wardrobe$/i).click();
    await wait(500);
    await p.fill('#su-name', 'Sam Kade');
    await wait(300);
    await vis(/^start it$/i).click();
    await wait(1300);
    await freeze('It begins empty, on this device.');
  });

  // 3 — the first piece.
  await scene('first piece', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(700);
    await vis(/add a piece|add the first piece/i).click();
    await wait(700);
    const dlg = p.getByRole('dialog');
    await p.fill('#add-item-name', 'Grey crewneck');
    const chip = dlg.getByRole('button', { name: /^tops$/i }).first();
    if (await chip.count()) await chip.click();
    await p.fill('#add-item-cost', '45');
    await wait(350);
    await dlg.getByRole('button', { name: /add to the closet/i }).click();
    await wait(1100);
    await freeze('The first piece enters the record.');
  });

  // 4 — two taps, real time; the freeze lands only after the entry.
  await scene('two taps', async () => {
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await wait(900);
    await vis(/log today's wear|log another/i).click();
    await wait(800);
    const dialog = p.getByRole('dialog');
    const pick = dialog.getByRole('button', { name: /pick pieces instead/i }).first();
    if (await pick.count()) { await pick.click(); await wait(450); }
    await dialog.getByRole('button', { name: /grey crewneck/i }).first().click();
    await wait(350);
    await dialog.getByRole('button', { name: /^log (this|\d+ pieces)/i }).first().click();
    await wait(1200);
    await freeze('The day, answered in two taps.');
  });

  // 5 — the samples.
  await scene('samples', async () => {
    await p.goto(V2 + '/#/open', { waitUntil: 'domcontentloaded' });
    await wait(900);
    await freeze('Three sample closets, each a year deep.');
    await p.getByRole('button', { name: /aarav/i }).first().click();
    await wait(900);
  });

  // 6 — photographs and drawings under one glass.
  await scene('flats', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(900);
    await p.mouse.wheel(0, 650);
    await wait(900);
    await p.mouse.move(640, 400);
    await wait(700);
    await freeze('Where photos are missing, drawings stand in.');
  });

  // 7 — the ledger.
  await scene('ledger', async () => {
    await p.goto(V2 + '/#/ledger', { waitUntil: 'domcontentloaded' });
    await wait(1300);
    await p.mouse.wheel(0, 850);
    await wait(1500);
    await freeze('Cost per wear, never paywalled.');
  });

  // 8 — before you buy.
  await scene('compare', async () => {
    await p.goto(V2 + '/#/compare', { waitUntil: 'domcontentloaded' });
    await wait(900);
    const navy = p.locator('[aria-label*="Colour"]').nth(15);
    if (await navy.count()) { await navy.click(); await wait(500); }
    const what = p.locator('input[placeholder*="wool coat"]').first();
    if (await what.count()) { await what.fill('Navy overshirt'); await wait(900); }
    await p.mouse.wheel(0, 480);
    await wait(1100);
    await freeze('Before you buy, see what you own.');
  });

  // 9 — the cooling-off and the money that stayed.
  await scene('wishlist', async () => {
    await p.goto(V2 + '/#/wishlist', { waitUntil: 'domcontentloaded' });
    await wait(1300);
    await p.mouse.wheel(0, 750);
    await wait(1300);
    await freeze('Seven days of silence, then one question.');
  });

  // 10 — Vikram's week.
  await scene('calendar', async () => {
    await openWardrobe(p, V2, /vikram/i);
    await p.goto(V2 + '/#/calendar', { waitUntil: 'domcontentloaded' });
    await wait(1600);
    await p.mouse.wheel(0, 350);
    await wait(900);
    await freeze('Future days are plans, not wears.');
  });

  // 11 — the record never assumes.
  await scene('honesty', async () => {
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await wait(1400);
    const wore = p.getByRole('button', { name: /^wore it$/i }).first();
    if (await wore.count()) { await wore.click(); await wait(1100); }
    await freeze('The record never assumes a wear.');
  });

  // 12 — the feed.
  await scene('feed', async () => {
    await openWardrobe(p, V2, /meher/i);
    await p.goto(V2 + '/#/feed', { waitUntil: 'domcontentloaded' });
    await wait(900);
    await p.mouse.wheel(0, 600);
    await wait(900);
    await freeze('A feed with nothing for sale.');
  });

  // 13 — the montage: gilt → dye house → pattern room.
  await scene('montage', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(400);
    let first = true;
    for (const room of ['gilt', 'dyehouse', 'light']) {
      await p.evaluate(([r]) => localStorage.setItem('toile-theme', JSON.stringify({ theme: r })), [room]);
      await p.reload({ waitUntil: 'domcontentloaded' });
      await wait(first ? 500 : 2900);
      if (first) { await freeze('The glass reads every room.'); first = false; }
    }
  });

  // 14 — home to obsidian; pure looking, no caption; the music crests here.
  await scene('return', async () => {
    await p.evaluate(() => localStorage.setItem('toile-theme', JSON.stringify({ theme: 'obsidian' })));
    await p.reload({ waitUntil: 'domcontentloaded' });
    await wait(900);
    await sheenSweep(1000, 250, 300, 500, 28, 60);
    await wait(1300);
  });

  // 15 — the provenance cameo: V1, the toile of V2.
  await scene('provenance', async () => {
    await p.goto(V1 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await p.evaluate(() => {
      localStorage.setItem('toile-theme', JSON.stringify({ theme: 'light' }));
      const el = document.createElement('div');
      el.style.cssText =
        'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:6px 14px;' +
        'background:rgba(14,12,10,0.8);color:#D3B39E;font:500 12px Georgia,serif;' +
        'letter-spacing:0.1em;border:1px solid rgba(211,154,133,0.4);border-radius:2px;' +
        'z-index:2147483647;pointer-events:none;white-space:nowrap';
      el.textContent = 'occult-kranti.github.io/wardrobe-tracker';
      document.body.appendChild(el);
    });
    await p.reload({ waitUntil: 'domcontentloaded' });
    await wait(600);
    await p.mouse.wheel(0, 260);
    await wait(700);
    await freeze('It began on paper. It remains.');
  });

  // 16 — end card on glass.
  await scene('end card', async () => {
    await p.goto('about:blank');
    await p.evaluate(() => {
      document.body.style.cssText = 'margin:0;background:#0A0B0F;display:flex;align-items:center;justify-content:center;height:100vh;';
      document.body.innerHTML =
        '<div style="text-align:center;font-family:Georgia,serif;color:#F6F1E7;padding:44px 64px;' +
        'background:rgba(18,20,26,0.7);border:1px solid rgba(211,154,133,0.35);border-radius:2px">' +
        '<div style="font-size:46px;letter-spacing:0.22em;font-weight:700">TOILE</div>' +
        '<div style="width:130px;height:2px;background:#BE1231;margin:16px auto"></div>' +
        '<div style="font-size:15px;letter-spacing:0.12em;color:#D3B39E;margin-top:20px">occult-kranti.github.io/wardrobe-tracker/v2/</div>' +
        '<div style="font-size:12px;letter-spacing:0.12em;color:#A9ADBC;margin-top:8px">occult-kranti.github.io/wardrobe-tracker</div>' +
        '</div>';
    });
    await wait(500);
    await freeze('No account, no cloud, no subscription.');
    await wait(1600);
  });

  const vid = p.video();
  await ctx.close();
  renameSync(await vid.path(), `${out}/wide.webm`);
  try { unlinkSync(await preVid.path()); } catch { /* gone */ }
  console.log('widescreen recorded');
}

/* ================= VERTICAL — 405×720 css, 1080×1920 delivered ================= */

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
  const { wait, freeze, scene, sheenSweep } = helpers(p, { vertical: true });

  await scene('v-open', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(800);
    await p.mouse.wheel(0, 300);
    await wait(600);
    await freeze('Your wardrobe, on record.');
  });

  await scene('v-log', async () => {
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await wait(900);
    const log = p.getByRole('button', { name: /log today's wear|log another/i }).filter({ visible: true }).first();
    await log.click();
    await wait(700);
    const dialog = p.getByRole('dialog');
    await dialog.getByRole('button').first().click();
    await wait(1100);
    await freeze('The day, answered in two taps.');
  });

  await scene('v-honesty', async () => {
    await openWardrobe(p, V2, /vikram/i);
    await p.goto(V2 + '/#/', { waitUntil: 'domcontentloaded' });
    await wait(1100);
    const wore = p.getByRole('button', { name: /^wore it$/i }).first();
    if (await wore.count()) { await wore.click(); await wait(900); }
    await freeze('The record never assumes a wear.');
  });

  await scene('v-ledger', async () => {
    await openWardrobe(p, V2, /aarav/i);
    await p.goto(V2 + '/#/ledger', { waitUntil: 'domcontentloaded' });
    await wait(1100);
    await p.mouse.wheel(0, 500);
    await wait(800);
    await freeze('Cost per wear, never paywalled.');
  });

  await scene('v-compare', async () => {
    await p.goto(V2 + '/#/compare', { waitUntil: 'domcontentloaded' });
    await wait(900);
    await p.mouse.wheel(0, 420);
    await wait(1000);
    await freeze('Before you buy, see what you own.');
  });

  await scene('v-wishlist', async () => {
    await p.goto(V2 + '/#/wishlist', { waitUntil: 'domcontentloaded' });
    await wait(1000);
    await p.mouse.wheel(0, 650);
    await wait(900);
    await freeze('Seven days of silence, then one question.');
  });

  await scene('v-calendar', async () => {
    await openWardrobe(p, V2, /vikram/i);
    await p.goto(V2 + '/#/calendar', { waitUntil: 'domcontentloaded' });
    await wait(1200);
    await freeze('Future days are plans, not wears.');
  });

  await scene('v-feed', async () => {
    await openWardrobe(p, V2, /meher/i);
    await p.goto(V2 + '/#/feed', { waitUntil: 'domcontentloaded' });
    await wait(700);
    await p.mouse.wheel(0, 550);
    await wait(800);
    await freeze('A feed with nothing for sale.');
  });

  await scene('v-montage', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    let first = true;
    for (const room of ['gilt', 'light']) {
      await p.evaluate(([r]) => localStorage.setItem('toile-theme', JSON.stringify({ theme: r })), [room]);
      await p.reload({ waitUntil: 'domcontentloaded' });
      await wait(first ? 400 : 1900);
      if (first) { await freeze('The glass reads every room.'); first = false; }
    }
    await p.evaluate(() => localStorage.setItem('toile-theme', JSON.stringify({ theme: 'obsidian' })));
  });

  await scene('v-end', async () => {
    await p.goto('about:blank');
    await p.evaluate(() => {
      document.body.style.cssText = 'margin:0;background:#0A0B0F;display:flex;align-items:center;justify-content:center;height:100vh;';
      document.body.innerHTML =
        '<div style="text-align:center;font-family:Georgia,serif;color:#F6F1E7;padding:36px 30px;' +
        'background:rgba(18,20,26,0.7);border:1px solid rgba(211,154,133,0.35);border-radius:2px">' +
        '<div style="font-size:38px;letter-spacing:0.2em;font-weight:700">TOILE</div>' +
        '<div style="width:110px;height:2px;background:#BE1231;margin:14px auto"></div>' +
        '<div style="font-size:12.5px;letter-spacing:0.1em;color:#D3B39E;margin-top:16px">occult-kranti.github.io/wardrobe-tracker/v2/</div>' +
        '</div>';
    });
    await wait(400);
    await freeze('No account, no cloud, no subscription.');
    await wait(1500);
  });

  const vid = p.video();
  await ctx.close();
  renameSync(await vid.path(), `${out}/vertical.webm`);
  try { unlinkSync(await preVid.path()); } catch { /* gone */ }
  console.log('vertical recorded');
}

await b.close();
console.log('v3 takes complete in', out);
