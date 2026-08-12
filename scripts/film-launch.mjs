// The product film, second edition — shot to the marketing plan (film-plan.md):
// a desktop movement (the record begins; three closets, three strengths; the
// theme montage) and a contiguous mobile movement (the ledger in one hand; the
// V2 glass cameo; the end card). Captions render CENTERED. Each context writes
// its own .webm; the assembly step pillarboxes mobile and lays the score under
// both.
//
// Usage: node scripts/film-launch.mjs <outDir>
//   needs the v1 preview on :4173 and the v2 preview on :4174
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';

const out = process.argv[2] ?? './film';
mkdirSync(out, { recursive: true });
const V1 = 'http://localhost:4173';
const V2 = 'http://localhost:4174';

const b = await chromium.launch();

/* ---------------- shared helpers ---------------- */

function helpers(p) {
  const wait = ms => p.waitForTimeout(ms);

  const caption = async (text, { fade = false } = {}) => {
    await p.evaluate(([t, f]) => {
      let el = document.getElementById('film-caption');
      if (!el) {
        el = document.createElement('div');
        el.id = 'film-caption';
        // Phone-sized canvases get smaller type and permission to wrap — a
        // caption clipped mid-word is the one thing worse than no caption.
        const narrow = window.innerWidth < 500;
        el.style.cssText = [
          'position:fixed', 'top:50%', 'left:50%', 'transform:translate(-50%,-50%)',
          narrow ? 'padding:10px 18px' : 'padding:13px 30px',
          'background:rgba(14,12,10,0.86)', 'color:#F6F1E7',
          narrow ? 'font:500 13px Georgia,serif' : 'font:500 19px Georgia,serif',
          narrow ? 'letter-spacing:0.1em' : 'letter-spacing:0.16em',
          'text-transform:uppercase',
          'border:1px solid rgba(211,154,133,0.6)', 'border-radius:2px',
          'z-index:2147483647', 'pointer-events:none', 'transition:opacity 350ms',
          narrow ? 'white-space:normal' : 'white-space:nowrap',
          'max-width:88vw', 'text-align:center', 'line-height:1.5',
        ].join(';');
        document.body.appendChild(el);
      }
      el.style.opacity = '0';
      setTimeout(() => {
        el.textContent = t;
        el.style.opacity = '1';
        if (f) setTimeout(() => { el.style.opacity = '0'; }, 3000);
      }, 350);
    }, [text, fade]);
    await wait(750);
  };

  const clearCaption = async () => {
    await p.evaluate(() => {
      const el = document.getElementById('film-caption');
      if (el) el.style.opacity = '0';
    });
  };

  const scene = async (name, fn) => {
    try {
      await fn();
    } catch (err) {
      console.warn(`scene skipped: ${name} — ${String(err).split('\n')[0]}`);
      await p.keyboard.press('Escape').catch(() => {});
      await wait(300);
      await p.keyboard.press('Escape').catch(() => {});
    }
  };

  const type = async (selector, text) => {
    await p.click(selector);
    await p.fill(selector, '');
    await p.type(selector, text, { delay: 55 });
  };

  const vis = (re) => p.getByRole('button', { name: re }).filter({ visible: true }).first();

  return { wait, caption, clearCaption, scene, type, vis };
}

/** Sample closets installed, then signed OUT — the chooser shows all three. */
async function prepOrigin(page, base, { matureVikramPlan = false } = {}) {
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const install = page.getByRole('button', { name: /sample wardrobes/i });
  if (await install.count()) {
    await install.click();
    await page.waitForTimeout(1000);
  }
  await page.evaluate(([mature]) => {
    if (mature) {
      // One of Vikram's plans matured to today: the question card's cue.
      const key = 'wardrobe-tracker:vikram';
      const st = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (st) {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (!st.wearLogs.some(l => l.date === today)) {
          const ids = st.items.slice(0, 3).map(i => i.id);
          st.wearLogs.push({ id: 'film-plan-1', date: today, itemIds: ids, planned: true });
          localStorage.setItem(key, JSON.stringify(st));
        }
      }
    }
    localStorage.removeItem('toile-session');
  }, [matureVikramPlan]);
}

const setTheme = (page, theme) =>
  page.evaluate(([t]) => localStorage.setItem('toile-theme', JSON.stringify({ theme: t })), [theme]);

/* ================= DESKTOP MOVEMENT (1280×800) ================= */

const ONLY = process.env.SEGMENT; // 'desktop' | 'mobile' | unset for both

if (!ONLY || ONLY === 'desktop') {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir: out, size: { width: 1280, height: 800 } } });
  const prep = await ctx.newPage();
  await prepOrigin(prep, V1, { matureVikramPlan: true });
  const prepVideo = prep.video();
  await prep.close();

  const p = await ctx.newPage();
  const { wait, caption, clearCaption, scene, type, vis } = helpers(p);

  // 1 — cold open: the chooser.
  await scene('cold open', async () => {
    await p.goto(V1 + '/', { waitUntil: 'domcontentloaded' });
    await wait(800);
    await caption('Your wardrobe, on record.');
    await wait(3600);
  });

  // 2 — start a wardrobe.
  await scene('start a wardrobe', async () => {
    await caption('It begins empty, on this device.');
    await vis(/^start a wardrobe$/i).click();
    await wait(700);
    await type('#su-name', 'Sam Kade');
    await type('#su-city', 'Lisbon');
    await wait(400);
    await vis(/^start it$/i).click();
    await wait(2200);
  });

  // 3 — the first piece, drawn flat.
  await scene('first piece', async () => {
    await p.goto(V1 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await caption('The first piece enters the record.');
    await wait(800);
    await vis(/add a piece/i).click();
    await wait(700);
    const dlg = p.getByRole('dialog');
    await type('#add-item-name', 'Grey crewneck');
    const chip = dlg.getByRole('button', { name: /^tops$/i }).first();
    if (await chip.count()) await chip.click();
    await p.fill('#add-item-cost', '45');
    await wait(400);
    await dlg.getByRole('button', { name: /add to the closet/i }).click();
    await wait(2200);
  });

  // 4 — the two-tap log, real time, never compressed.
  await scene('two taps', async () => {
    await p.goto(V1 + '/#/', { waitUntil: 'domcontentloaded' });
    await caption('The day, answered in two taps.');
    await wait(900);
    await vis(/log today's wear|log another/i).click();
    await wait(800);
    const dialog = p.getByRole('dialog');
    const pickInstead = dialog.getByRole('button', { name: /pick pieces instead/i }).first();
    if (await pickInstead.count()) { await pickInstead.click(); await wait(500); }
    await dialog.getByRole('button', { name: /grey crewneck/i }).first().click();
    await wait(400);
    await dialog.getByRole('button', { name: /^log (this|\d+ pieces)/i }).first().click();
    await wait(2400);
  });

  // 5 — the three sample closets.
  await scene('the samples', async () => {
    await p.goto(V1 + '/#/open', { waitUntil: 'domcontentloaded' });
    await caption('Three sample closets, each a year deep.');
    await wait(2200);
    await p.getByRole('button', { name: /aarav/i }).first().click();
    await wait(1800);
  });

  // 6 — Aarav's closet: photographs and flats side by side.
  await scene('aarav closet', async () => {
    await p.goto(V1 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await caption('Where photos are missing, drawings stand in.');
    await wait(1600);
    await p.mouse.wheel(0, 700);
    await wait(1600);
    await p.mouse.wheel(0, 500);
    await wait(1200);
  });

  // 7 — the ledger: cost per wear, unpaywalled.
  await scene('aarav ledger', async () => {
    await p.goto(V1 + '/#/ledger', { waitUntil: 'domcontentloaded' });
    await caption('Cost per wear, never paywalled.');
    await wait(2400);
    await p.mouse.wheel(0, 900);
    await wait(2400);
    await p.mouse.wheel(0, 900);
    await wait(2400);
  });

  // 8 — before you buy: facts, then silence.
  await scene('before you buy', async () => {
    await p.goto(V1 + '/#/compare', { waitUntil: 'domcontentloaded' });
    await caption('Before you buy, see what you own.');
    await wait(1200);
    const navy = p.locator('[aria-label*="Colour"]').first();
    if (await navy.count()) { await navy.click(); await wait(600); }
    const what = p.locator('#compare-name, input[placeholder*="wool coat"]').first();
    if (await what.count()) { await what.click(); await what.type('Navy overshirt', { delay: 45 }); }
    await wait(1400);
    await p.mouse.wheel(0, 500);
    await wait(2200);
  });

  // 9 — the wishlist's cooling-off.
  await scene('wishlist', async () => {
    await p.goto(V1 + '/#/wishlist', { waitUntil: 'domcontentloaded' });
    await caption('Seven days of silence, then one question.');
    await wait(2400);
    await p.mouse.wheel(0, 700);
    await wait(2600);
  });

  // 10 — Vikram's calendar: plans are plans.
  await scene('vikram calendar', async () => {
    await p.goto(V1 + '/#/open', { waitUntil: 'domcontentloaded' });
    await wait(700);
    await p.getByRole('button', { name: /vikram/i }).first().click();
    await wait(1200);
    await p.goto(V1 + '/#/calendar', { waitUntil: 'domcontentloaded' });
    await caption('Future days are plans, not wears.');
    await wait(3000);
    await p.mouse.wheel(0, 400);
    await wait(2600);
  });

  // 11 — the record never assumes.
  await scene('matured plan', async () => {
    await p.goto(V1 + '/#/', { waitUntil: 'domcontentloaded' });
    await caption('The record never assumes a wear.');
    await wait(2000);
    const woreIt = p.getByRole('button', { name: /^wore it$/i }).first();
    if (await woreIt.count()) {
      await woreIt.click();
      await wait(2200);
    } else {
      await wait(1600);
    }
  });

  // 12 — events: a look held per function.
  await scene('events', async () => {
    await p.goto(V1 + '/#/events', { waitUntil: 'domcontentloaded' });
    await caption('Three functions, a look held for each.');
    await wait(2400);
    await p.mouse.wheel(0, 600);
    await wait(2800);
  });

  // 13 — the generator deals only clean pieces.
  await scene('draw a set', async () => {
    await p.goto(V1 + '/#/outfits', { waitUntil: 'domcontentloaded' });
    await caption('The generator deals only clean pieces.');
    await wait(1200);
    await vis(/draw a set/i).click();
    await wait(3000);
  });

  // 14 — the theme montage: pure looking; caption fades after the first cut.
  await scene('montage', async () => {
    await p.goto(V1 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await wait(600);
    await caption('Six rooms, one record.', { fade: true });
    for (const room of ['salon', 'gilt', 'dyehouse', 'obsidian']) {
      await setTheme(p, room);
      await p.reload({ waitUntil: 'domcontentloaded' });
      await wait(3400);
    }
  });

  const video = p.video();
  await ctx.close();
  renameSync(await video.path(), `${out}/desktop.webm`);
  try { const pv = await prepVideo.path(); const { unlinkSync } = await import('node:fs'); unlinkSync(pv); } catch { /* already gone */ }
  console.log('desktop movement recorded');
}

/* ================= MOBILE MOVEMENT (390×844) ================= */

if (!ONLY || ONLY === 'mobile') {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: out, size: { width: 390, height: 844 } } });

  // Prep both origins off camera: samples on v1, samples + obsidian on v2.
  const prep = await ctx.newPage();
  await prepOrigin(prep, V1);
  await prep.evaluate(() => localStorage.setItem('toile-session', JSON.stringify({ activeId: 'meher' })));
  await prepOrigin(prep, V2);
  await prep.goto(V2 + '/', { waitUntil: 'domcontentloaded' });
  await prep.evaluate(() => {
    localStorage.setItem('toile-theme', JSON.stringify({ theme: 'obsidian' }));
    localStorage.setItem('toile-session', JSON.stringify({ activeId: 'meher' }));
  });
  const prepVideo = prep.video();
  await prep.close();

  const p = await ctx.newPage();
  const { wait, caption, clearCaption, scene } = helpers(p);

  // 15 — the same two taps, phone-sized.
  await scene('mobile log', async () => {
    await p.goto(V1 + '/#/', { waitUntil: 'domcontentloaded' });
    await caption('The same ledger, pocket-sized.');
    await wait(1400);
    const log = p.getByRole('button', { name: /log today's wear|log another/i }).filter({ visible: true }).first();
    await log.click();
    await wait(900);
    const dialog = p.getByRole('dialog');
    const firstChoice = dialog.getByRole('button').first();
    if (await firstChoice.count()) { await firstChoice.click(); await wait(1800); }
  });

  // 16 — a third calendar.
  await scene('meher calendar', async () => {
    await p.goto(V1 + '/#/calendar', { waitUntil: 'domcontentloaded' });
    await caption('A different closet, a different week.');
    await wait(3600);
  });

  // 17 — the closet in one hand.
  await scene('mobile closet', async () => {
    await p.goto(V1 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await caption('A closet held in one hand.');
    await wait(1200);
    await p.mouse.wheel(0, 600);
    await wait(1400);
    await p.mouse.wheel(0, 500);
    await wait(1000);
  });

  // 18 — the feed with nothing for sale.
  await scene('feed', async () => {
    await p.goto(V1 + '/#/feed', { waitUntil: 'domcontentloaded' });
    await caption('A feed with nothing for sale.');
    await wait(1400);
    await p.mouse.wheel(0, 700);
    await wait(2200);
  });

  // 19 — households.
  await scene('households', async () => {
    await p.goto(V1 + '/#/profile', { waitUntil: 'domcontentloaded' });
    await caption('Households share pieces, not accounts.');
    await wait(1600);
    await p.mouse.wheel(0, 800);
    await wait(3400);
  });

  // 20 — the V2 cameo, with a lower-third URL.
  await scene('v2 cameo', async () => {
    await p.goto(V2 + '/#/closet', { waitUntil: 'domcontentloaded' });
    await caption('The same record, dressed in glass.');
    await p.evaluate(() => {
      const el = document.createElement('div');
      el.style.cssText = [
        'position:fixed', 'bottom:18px', 'left:50%', 'transform:translateX(-50%)',
        'padding:6px 14px', 'background:rgba(14,12,10,0.8)', 'color:#D3B39E',
        'font:500 11px Georgia,serif', 'letter-spacing:0.1em',
        'border:1px solid rgba(211,154,133,0.4)', 'border-radius:2px',
        'z-index:2147483647', 'pointer-events:none', 'white-space:nowrap',
      ].join(';');
      el.textContent = 'occult-kranti.github.io/wardrobe-tracker/v2/';
      document.body.appendChild(el);
    });
    await wait(1600);
    await p.mouse.wheel(0, 500);
    await wait(2800);
  });

  // 21 — the end card.
  await scene('end card', async () => {
    await p.goto('about:blank');
    await p.evaluate(() => {
      document.body.style.cssText = 'margin:0;background:#0A0B0F;display:flex;align-items:center;justify-content:center;height:100vh;';
      document.body.innerHTML =
        '<div style="text-align:center;font-family:Georgia,serif;color:#F6F1E7">' +
        '<div style="font-size:44px;letter-spacing:0.22em;font-weight:700">TOILE</div>' +
        '<div style="width:120px;height:2px;background:#BE1231;margin:14px auto"></div>' +
        '<div style="font-size:13px;letter-spacing:0.12em;color:#A9ADBC;margin-top:18px">occult-kranti.github.io/wardrobe-tracker</div>' +
        '</div>';
    });
    await wait(600);
    const { caption: cap } = helpers(p);
    await cap('No account, no cloud, no subscription.');
    await wait(4200);
    await clearCaption();
    await wait(800);
  });

  const video = p.video();
  await ctx.close();
  renameSync(await video.path(), `${out}/mobile.webm`);
  try { const pv = await prepVideo.path(); const { unlinkSync } = await import('node:fs'); unlinkSync(pv); } catch { /* already gone */ }
  console.log('mobile movement recorded');
}

await b.close();
console.log('takes complete:', `${out}/desktop.webm`, `${out}/mobile.webm`);
