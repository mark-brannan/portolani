// Renders docs/mockups/chart-position/: node docs/mockups/chart-position/shoot.mjs <out dir> [port], with npm run dev serving
import { chromium } from 'playwright-core';
const [OUT, PORT = 10398] = process.argv.slice(2);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const D = { width: 1280, height: 900 }, P = { width: 390, height: 844 };
const ROW = '#chartList li[data-overlay="de-la-cosa"]';
async function run(mock, vp, name, { click } = {}) {
  const phone = vp.width < 600;
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: phone ? 2 : 1, hasTouch: phone, isMobile: phone });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/${mock ? '?mock=row' : ''}#map=3.2/20.000/-20.000`); await p.waitForTimeout(3500);
  await p.click('#charts'); await p.waitForTimeout(800);
  await p.click(`${ROW} .name`); await p.waitForTimeout(5000);
  if (click) { await p.click(`#sheetChips [data-label="${click}"]`); await p.waitForTimeout(3500); }
  await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), ROW);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  if (mock && !phone) await p.locator(ROW).screenshot({ path: `${OUT}/${name}-row.png` });
  await ctx.close();
}
await run(false, D, 'today-desktop'); await run(false, P, 'today-phone');
await run(true, D, 'row-desktop'); await run(true, P, 'row-phone');
await run(true, D, 'row-desktop-newworld', { click: 'New World' });
await b.close();
