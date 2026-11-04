// Renders docs/drawer-tabs/: node docs/drawer-tabs/shoot.mjs <out dir> <prefix> [port]; npm run dev serves the page
import { chromium } from 'playwright-core';
const [OUT, PREFIX = 'after', PORT = 10319] = process.argv.slice(2);
const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const D = { width: 1280, height: 900 }, P = { width: 390, height: 844 };
async function run(vp, name, { tab, whole } = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: vp.width < 600 ? 2 : 1, hasTouch: vp.width < 600, isMobile: vp.width < 600 });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`http://localhost:${PORT}/#map=5.48/40.265/7.000`); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(6000);
  await p.click('#open'); await p.waitForTimeout(900);
  if (vp.width < 600) { await p.evaluate(() => document.querySelector('.tabs').scrollIntoView({ block: 'start' })); await p.waitForTimeout(300); }
  if (tab) { await p.click(`#tab-${tab}`).catch(() => {}); await p.waitForTimeout(300); }
  if (whole) {
    const h = await p.evaluate(() => document.getElementById('drawer').scrollHeight);
    await p.evaluate(() => { const d = document.getElementById('drawer'); d.style.maxHeight = 'none'; d.style.overflow = 'visible'; });
    await p.setViewportSize({ width: vp.width, height: h + 80 }); await p.waitForTimeout(500);
    await p.locator('#drawer').screenshot({ path: `${OUT}/${PREFIX}-${name}.png` });
  } else await p.screenshot({ path: `${OUT}/${PREFIX}-${name}.png` });
  console.log(name, errors.length ? errors : 'ok');
  await ctx.close();
}
await run(D, 'desktop-sea'); await run(D, 'desktop-land', { tab: 1 }); await run(D, 'desktop-margins', { tab: 2 });
await run(P, 'phone-sea'); await run(P, 'phone-land', { tab: 1 }); await run(P, 'phone-margins', { tab: 2 });
await run(D, 'whole-sea', { whole: true });
await b.close();
