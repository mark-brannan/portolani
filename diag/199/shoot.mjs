import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/home/solace/portolani/');
const { chromium } = require('/home/solace/portolani/node_modules/playwright-core');
const D = new URL('./', import.meta.url).pathname;
const views = [
 [1,'3.17/-18.526/-111.901'],[2,'4.33/39.525/-26.502'],[3,'4.33/36.013/-0.489'],[4,'6.14/40.474/7.400'],
 [5,'1.00/4.215/10.000'],[6,'2.00/40.899/173.403'],[7,'6.00/-9.000/-140.000'],[8,'5.67/-9.238/-139.742'],
 [9,'4.40/39.000/16.000'],[10,'5.50/-9.000/-140.000']];
const browser = await chromium.launch();
const lines = [];
for (const [n, h] of views) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:10198/#map=${h}`);
  let note = '';
  try {
    await page.waitForFunction(() => /load \d+/.test(document.getElementById('status')?.textContent ?? ''), null, { timeout: 60000 });
  } catch { note = ' [TIMEOUT: no load status in 60s]'; }
  await page.waitForTimeout(500);
  const st = await page.evaluate(() => document.getElementById('status')?.textContent ?? '');
  await page.screenshot({ path: `${D}view${n}.png` });
  lines.push(`${n}\t#map=${h}\t${st}${note}`);
  console.log(lines.at(-1));
  await page.close();
}
fs.writeFileSync(`${D}status.txt`, lines.join('\n') + '\n');
await browser.close();
