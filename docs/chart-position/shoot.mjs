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
// west up, then the sheet lifted by its eye: the world turns back to north up (the hash's bearing goes)
{
  const p = await open(D);
  await p.click('#sheetChips [data-mend=up]'); await p.waitForTimeout(4000);
  console.log('west up:', await p.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('bearing')));
  await p.screenshot({ path: `${OUT}/westup.png` });
  await p.click(`${ROW} .eye`); await p.waitForTimeout(4000);
  console.log('lifted:', await p.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('bearing')));
  await p.screenshot({ path: `${OUT}/westup-lifted.png` });
  await p.context().close();
}
await b.close();
