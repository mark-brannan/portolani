// Renders docs/mockups/drawers-reorg/: node docs/mockups/drawers-reorg/shoot.mjs <out dir> [name prefix] [port], with npm run dev serving
import { chromium } from 'playwright-core';
const OUT = process.argv[2];
const PORT = process.argv[4] ?? 10399;
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

const shots = [];
async function run(cand, vp, name, { tab, whole, drawerId = 'drawer', button = '#open' } = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: vp.width < 600 ? 2 : 1, hasTouch: vp.width < 600, isMobile: vp.width < 600 });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:${PORT}/${cand ? `?mock=${cand}&tab=${tab ?? 0}` : ''}#map=5.48/40.265/7.000`); await p.waitForTimeout(3500);
  await p.click(button); await p.waitForTimeout(900);
  const h = await p.evaluate((id) => document.getElementById(id).scrollHeight, drawerId);
  if (whole) {
    await p.evaluate((id) => { const d = document.getElementById(id); d.style.maxHeight = 'none'; d.style.overflow = 'visible'; }, drawerId);
    await p.setViewportSize({ width: vp.width, height: h + 80 }); await p.waitForTimeout(500);
    await p.locator('#' + drawerId).screenshot({ path: `${OUT}/${name}.png` });
  } else await p.screenshot({ path: `${OUT}/${name}.png` });
  shots.push([name, h]);
  await ctx.close();
}
const D = { width: 1280, height: 900 }, P = { width: 390, height: 844 };
const only = process.argv[3];
const jobs = [
  [0, D, '0-today-desktop'], [0, P, '0-today-phone'], [0, D, '0-today-whole', { whole: true }],
  [1, D, '1-one-scroll-desktop'], [1, P, '1-one-scroll-phone'], [1, D, '1-one-scroll-whole', { whole: true }],
  [2, D, '2-tabs-sea-desktop', { tab: 0 }], [2, P, '2-tabs-sea-phone', { tab: 0 }], [2, D, '2-tabs-margins-desktop', { tab: 2 }], [2, D, '2-tabs-sea-whole', { tab: 0, whole: true }],
  [3, D, '3-split-rose-desktop'], [3, D, '3-split-charts-desktop', { drawerId: 'chartsDrawer', button: '#charts' }], [3, P, '3-split-charts-phone', { drawerId: 'chartsDrawer', button: '#charts' }], [3, D, '3-split-rose-whole', { whole: true }],
];
for (const [c, vp, name, o] of jobs) if (!only || name.startsWith(only)) await run(c, vp, name, o);
console.log(JSON.stringify(shots));
await b.close();
