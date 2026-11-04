// Renders docs/chart-position/: node docs/chart-position/shoot.mjs <out dir> [port], with npm run dev serving this checkout.
// CHROME=<path to chrome> if playwright's own browser is not installed.
import { chromium } from 'playwright-core';
const [OUT, PORT = 10341] = process.argv.slice(2);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const D = { width: 1280, height: 900 }, P = { width: 390, height: 844 };
const ROW = '#chartList li[data-overlay="de-la-cosa"]';
async function open(vp) {
  const phone = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/#map=3.2/20.000/-20.000`); await p.waitForTimeout(3500);
  await p.click('#charts'); await p.waitForTimeout(800);
  await p.click(`${ROW} .name`); await p.waitForSelector('#chartList .pos:not([hidden])', { timeout: 60000 }); await p.waitForTimeout(6000);
  return p;
}
async function run(vp, name, { click } = {}) {
  const p = await open(vp), phone = vp.width < 600;
  if (click) { await p.click(`#sheetChips [data-label="${click}"]`); await p.waitForTimeout(3500); }
  await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), ROW);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  if (!phone) await p.locator(ROW).screenshot({ path: `${OUT}/${name}-row.png` });
  await p.context().close();
}
await run(D, 'row-desktop'); await run(P, 'row-phone'); await run(D, 'row-desktop-newworld', { click: 'New World' });
// the replay ring's glyph two ways, the real row twice, one above the other: the astrolabe and the compass
{
  const p = await open(D);
  await p.evaluate((s) => {
    const li = document.querySelector(s);
    const bar = (id, tag) => document.getElementById(id).querySelector('svg').outerHTML.replace(/(brass\w+)/g, `$1${tag}`).replace('aria-hidden="true"', 'aria-hidden="true" class="icon"');
    const cmp = document.createElement('div');
    cmp.id = 'cmp';
    cmp.style.cssText = 'position:fixed;left:20px;top:20px;z-index:99;background:#efe3c6;padding:14px;border:1px solid #b89a68;display:grid;gap:10px;width:420px;font:14px Georgia,serif;color:#3b2a1a';
    for (const [label, id] of [['A. The astrolabe (points of interest)', 'sights'], ['B. The compass (Go)', 'go']]) {
      const row = li.querySelector('.pos').cloneNode(true);
      row.querySelector('[data-notes=again]').innerHTML = bar(id, 'Cmp' + id);
      const h = document.createElement('div'); h.textContent = label; h.style.fontWeight = 'bold';
      cmp.append(h, row);
    }
    document.body.append(cmp);
  }, ROW);
  await p.waitForTimeout(300);
  await p.locator('#cmp').screenshot({ path: `${OUT}/replay-icon-choice.png` });
  await p.context().close();
}
await b.close();
