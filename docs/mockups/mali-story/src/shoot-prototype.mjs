// Shoots the interactive prototype (public/mockups/mali-story/) through each entry point and the road, for the PR body.
// Serve the checkout first (npm run dev -- --port 10318), then from this folder: node shoot-prototype.mjs [base url]
import { chromium } from 'playwright-core';
const base = (process.argv[2] ?? 'http://127.0.0.1:10318/') + 'mockups/mali-story/index.html';
const out = (n) => `../proto-${n}.png`;
const b = await chromium.launch({ executablePath: process.env.CHROME });
const errors = [];
async function page(viewport, hash = '') {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base + hash); await p.waitForTimeout(1500); return p;
}
const settle = (p) => p.waitForTimeout(1400);
const wide = { width: 1280, height: 800 };

let p = await page(wide);
await p.screenshot({ path: out('1-king-entry') });
await p.click('#king'); await settle(p); await p.screenshot({ path: out('2-king-open') });
await p.click('#tile [data-go="claims"]'); await settle(p); await p.screenshot({ path: out('3-fact-or-fiction') });
await p.click('tr[data-claim="2"]'); await settle(p); await p.screenshot({ path: out('4-row-lights-cairo') });
await p.click('#tile [data-go="road"]'); await settle(p);
await p.click('[data-stop="4"]'); await p.waitForTimeout(3200); await p.screenshot({ path: out('5-road-cairo') });
await p.click('[data-stop="10"]'); await settle(p); await p.screenshot({ path: out('6-road-fleet') });
await p.close();

p = await page(wide, '#plates');
await p.screenshot({ path: out('7-plates-entry') });
await p.click('[data-plate] >> nth=0'); await settle(p); await p.screenshot({ path: out('8-plates-open') });
await p.close();

const phone = { width: 390, height: 844 };
p = await page(phone);
await p.click('#king'); await settle(p); await p.screenshot({ path: out('9-phone-king') });
await p.click('#tile [data-go="road"]'); await settle(p); await p.click('[data-stop="7"]'); await p.waitForTimeout(3200); await p.screenshot({ path: out('10-phone-road') });
await p.close();
p = await page(phone, '#plates');
await p.screenshot({ path: out('11-phone-plates') });
await p.click('[data-plate] >> nth=1'); await settle(p); await p.screenshot({ path: out('12-phone-plates-open') });
await p.click('#compare [data-go="claims"]'); await settle(p); await p.click('tr[data-claim="0"]'); await settle(p); await p.screenshot({ path: out('13-phone-fact-or-fiction') });
await p.close();

await b.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('shot 13');
