// One mode (#211): dark margins round the map, parchment inside every drawer, whatever the browser's
// light/dark setting. The source check runs offline: no `prefers-color-scheme` anywhere in public/.
// The page check opens every drawer, and the settings drawer in each of its layouts, in headless Chromium
// with the browser set to dark, and asserts the drawer's background is the --panel token, its ink --fg,
// the page's margin --margin, and that nothing visible inside the drawer has a dark background.
//
// The page check needs the built preview (`npm run build:preview` -> _site/), playwright-core and a
// Chromium (`npx playwright-core install chromium-headless-shell`); without them it skips, since
// `npm test` runs offline. CI sets DRAWERS_REQUIRED=1 so that a skip there is a failure.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pub = fileURLToPath(new URL('../public/', import.meta.url));

test('no prefers-color-scheme rule anywhere in public/', () => {
  for (const f of readdirSync(pub, { recursive: true })) {
    const p = path.join(pub, f);
    if (!/\.(html|css|m?js)$/.test(p)) continue;
    assert.doesNotMatch(readFileSync(p, 'utf8'), /prefers-color-scheme/, `${f} follows the browser's light/dark setting`);
  }
});

const site = fileURLToPath(new URL('../_site/', import.meta.url));
const required = process.env.DRAWERS_REQUIRED === '1';
let chromium = null;
try { ({ chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')); } catch { /* not installed */ }
const skip = !existsSync(path.join(site, 'index.html')) ? 'no _site/: run `npm run build:preview`' : !chromium ? 'no playwright-core' : false;
if (skip && required) throw new Error(`drawers test cannot run: ${skip}`);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf' };
let server, browser, base;

before(async () => {
  if (skip) return;
  server = createServer(async (req, res) => {
    let p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p.endsWith('/')) p = path.join(p, 'index.html');
    try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); } catch { res.writeHead(404).end(); }
  }).listen(0);
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); server?.close(); });

// every instrument's drawer, and the settings drawer (the rose) in each of its layouts
const CASES = [
  ['open', ''], ['open', 'layout=question'], ['open', 'layout=moods'], ['open', 'layout=sheet'],
  ['charts', ''], ['sights', ''], ['go', ''], ['voyages', ''], ['anchor', ''],
];

test('every drawer is parchment inside, the margin dark, with the browser set to dark', { skip, timeout: 120000 }, async () => {
  // one page, the scene placed once; a layout is a hash change, which the page follows without a reload
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForFunction(() => /total \d+ ms\)$/.test(document.getElementById('status').textContent), null, { timeout: 90000 });
  for (const [button, hash] of CASES) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.click(`#${button}`);
    const id = await page.getAttribute(`#${button}`, 'aria-controls');
    await page.waitForFunction((i) => getComputedStyle(document.getElementById(i)).visibility === 'visible', id);
    const r = await page.evaluate((i) => {
      const token = (name) => { // a token's value as the browser computes a colour
        const probe = document.createElement('i');
        probe.style.color = `var(${name})`; document.body.append(probe);
        const c = getComputedStyle(probe).color; probe.remove(); return c;
      };
      const luma = (c) => { const [r, g, b, a = 1] = c.match(/[\d.]+/g).map(Number); return a < 0.5 ? null : (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
      const d = document.getElementById(i);
      const dark = [...d.querySelectorAll('*')].filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
        .map((el) => [el, getComputedStyle(el).backgroundColor]).filter(([, c]) => (luma(c) ?? 1) < 0.45)
        .map(([el, c]) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''} ${c}`);
      return {
        bg: getComputedStyle(d).backgroundColor, ink: getComputedStyle(d).color, body: getComputedStyle(document.body).backgroundColor,
        panel: token('--panel'), fg: token('--fg'), margin: token('--margin'), dark,
      };
    }, id);
    const where = `${button}${hash ? ` (${hash})` : ''}`;
    assert.equal(r.panel, 'rgb(239, 227, 198)', `${where}: --panel is parchment, #efe3c6`);
    assert.equal(r.margin, 'rgb(29, 25, 19)', `${where}: --margin is #1d1913`);
    assert.equal(r.bg, r.panel, `${where}: the drawer's background is --panel`);
    assert.equal(r.ink, r.fg, `${where}: the drawer's ink is --fg`);
    assert.equal(r.body, r.margin, `${where}: the margin round the map is --margin`);
    assert.deepEqual(r.dark, [], `${where}: nothing inside the drawer has a dark background`);
    await page.keyboard.press('Escape');
    await page.waitForFunction((i) => getComputedStyle(document.getElementById(i)).visibility === 'hidden', id);
  }
  await ctx.close();
});
