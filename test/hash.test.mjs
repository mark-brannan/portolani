// The URL hash as the page reads and writes it, in headless Chromium: the view round-trips, clamps and
// wraps; editing the hash redraws without a reload; Reset keeps only the view; Copy link copies the URL,
// or selects it in a box when the clipboard is refused; and the three drawer sliders (density, continents,
// regions) read from and write to the hash. Each scenario opens a fresh page at a hash.
//
// Needs the built preview (`npm run build:preview` -> _site/), playwright-core and a Chromium
// (`npx playwright-core install chromium-headless-shell`); without them it skips, since `npm test`
// runs offline. CI sets HASH_REQUIRED=1 so that a skip there is a failure.
//
// Where the page and its labels disagree (mark-brannan/portolani#207) these pin what the page does today,
// with a `Mismatch:` comment.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = fileURLToPath(new URL('../_site/', import.meta.url));
const required = process.env.HASH_REQUIRED === '1';
let chromium = null;
try { ({ chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')); } catch { /* not installed */ }
const skip = !existsSync(path.join(site, 'index.html')) ? 'no _site/: run `npm run build:preview`' : !chromium ? 'no playwright-core' : false;
if (skip && required) throw new Error(`hash test cannot run: ${skip}`);

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

// A fresh page at `hash`, once the scene is placed (#status ends in a total). `init` runs before the page's own script.
async function open(hash, { permissions = [], init } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', permissions });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}#${hash}`);
  await placed(page);
  return { page, errors, close: () => ctx.close() };
}
const placed = (page) => page.waitForFunction(() => /total \d+ ms\)$/.test(document.getElementById('status').textContent), null, { timeout: 90000 });
const hash = (page) => page.evaluate(() => location.hash);
const params = async (page) => new URLSearchParams((await hash(page)).slice(1));
const status = (page) => page.locator('#status').textContent();
const value = (page, id) => page.evaluate((i) => String(document.getElementById(i).value), id); // inputs and the chip groups alike
const text = (page, id) => page.locator(`#${id}`).textContent();
const openDrawer = (page) => page.locator('#open').click();
// a slider moved by the user: the page reads it and writes the hash at once
const slide = async (page, id, v) => { await openDrawer(page); await page.locator(`#${id}`).fill(String(v)); };

// One page per scenario; a script error on the page fails it.
const scenario = (name, hashAt, body, opts) => test(name, { skip, timeout: 120000 }, async () => {
  const s = await open(hashAt, opts);
  try {
    await body(s.page);
    assert.deepEqual(s.errors, [], 'page errors');
  } finally { await s.close(); }
});

// ---------------------------------------------------------------- A. the hash and the view

scenario('map: the view round-trips through the hash', 'map=8.00/43.700/7.300', async (page) => {
  assert.match(await status(page), /^z8\.0: /);
  assert.equal(await hash(page), '#map=8.00/43.700/7.300', 'a load leaves the hash as it is');
  await slide(page, 'density', 1.5); // any write
  assert.equal((await params(page)).get('map'), '8.00/43.700/7.300', 'zoom 2 dp, lat and lon 3 dp');
});

scenario('map: a zoom past the top is clamped to 15, not rejected', 'map=99/40/5', async (page) => {
  assert.match(await status(page), /^z15\.0: /);
  await slide(page, 'density', 1.5);
  assert.equal((await params(page)).get('map'), '15.00/40.000/5.000');
});

scenario('map: a view that fails the pattern opens the default view', 'map=1.2.3/40/5', async (page) => {
  assert.match(await status(page), /^z5\.5: /);
  await slide(page, 'density', 1.5);
  assert.equal((await params(page)).get('map'), '5.48/40.265/7.000');
});

scenario('map: longitude wraps', 'map=5/40/190', async (page) => {
  await slide(page, 'density', 1.5);
  assert.equal((await params(page)).get('map'), '5.00/40.000/-170.000');
});

scenario('hashchange: editing the hash redraws without a reload', 'map=5.48/40.265/7.000', async (page) => {
  await page.evaluate(() => { window.sameDocument = true; document.getElementById('status').textContent = ''; });
  await page.evaluate(() => { location.hash = 'map=5.48/40.265/7.000&ink=5a1a1a&density=1.5'; });
  await placed(page);
  assert.equal(await page.evaluate(() => window.sameDocument), true, 'the page reloaded');
  assert.equal(await value(page, 'ink'), '#5a1a1a');
  assert.equal(await value(page, 'density'), '1.5');
  assert.equal(await hash(page), '#map=5.48/40.265/7.000&ink=5a1a1a&density=1.5', 'a hash edit is not rewritten');
});

scenario('reset: every control back to default, only the view kept', 'map=7.00/43.700/7.300&ink=5a1a1a&density=1.5&projection=miller', async (page) => {
  assert.equal(await value(page, 'projection'), 'miller');
  await page.evaluate(() => { document.getElementById('status').textContent = ''; });
  await openDrawer(page);
  await page.locator('#reset').click();
  await placed(page);
  // Mismatch: the tooltip says "the view stays", but the projection goes with the rest, back to Mercator.
  assert.equal(await hash(page), '#map=7.00/43.700/7.300');
  assert.equal(await value(page, 'projection'), 'mercator');
  assert.equal(await value(page, 'ink'), '#3b2a1a');
  assert.equal(await value(page, 'density'), '1');
});

scenario('copy link: the clipboard holds the page URL', 'map=7.00/43.700/7.300&density=1.5', async (page) => {
  await openDrawer(page);
  await page.locator('#copy').click();
  await page.waitForFunction(() => document.getElementById('shareNote').textContent !== '');
  assert.equal(await text(page, 'shareNote'), 'Link copied');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.evaluate(() => location.href));
  assert.equal(await page.locator('#shareUrl').isHidden(), true);
}, { permissions: ['clipboard-read', 'clipboard-write'] });

scenario('copy link: a refused clipboard selects the link in a box', 'map=7.00/43.700/7.300&density=1.5', async (page) => {
  await openDrawer(page);
  await page.locator('#copy').click();
  await page.waitForFunction(() => document.getElementById('shareNote').textContent !== '');
  assert.equal(await text(page, 'shareNote'), 'Could not copy automatically: the link is selected, press Ctrl+C');
  assert.equal(await page.locator('#shareUrl').isVisible(), true);
  const box = await page.evaluate(() => { const u = document.getElementById('shareUrl'); return { value: u.value, focused: document.activeElement === u, selected: u.value.slice(u.selectionStart, u.selectionEnd) }; });
  const href = await page.evaluate(() => location.href);
  assert.deepEqual(box, { value: href, focused: true, selected: href });
}, { init: () => { navigator.clipboard.writeText = () => Promise.reject(new DOMException('refused', 'NotAllowedError')); } });

// ---------------------------------------------------------------- the drawer sliders

scenario('density: the slider round-trips', 'map=5.48/40.265/7.000', async (page) => {
  assert.equal((await params(page)).has('density'), false);
  await slide(page, 'density', 1.5);
  assert.equal((await params(page)).get('density'), '1.5');
  assert.equal(await text(page, 'densityOut'), '1.5');
});

scenario('density: an out-of-range hash falls back to 1', 'map=5.48/40.265/7.000&density=3', async (page) => {
  assert.equal(await value(page, 'density'), '1');
  assert.equal(await text(page, 'densityOut'), '1');
  await slide(page, 'continentsZoom', 3); // a write from another control
  assert.equal((await params(page)).has('density'), false);
});

scenario('density: a value between the steps', 'map=5.48/40.265/7.000&density=1.3', async (page) => {
  // Mismatch: the hash takes any real in [0, 2]; the slider shows the nearest step while the readout says 1.3,
  // and a change to any control reads every control, so the next write snaps it to the slider's 1.25.
  assert.equal(await value(page, 'density'), '1.25');
  assert.equal(await text(page, 'densityOut'), '1.3');
  await slide(page, 'continentsZoom', 3);
  assert.equal((await params(page)).get('density'), '1.25');
});

scenario('continents: the slider round-trips', 'map=5.48/40.265/7.000', async (page) => {
  await slide(page, 'continentsZoom', 3);
  assert.equal((await params(page)).get('continents'), '3');
  assert.equal(await text(page, 'continentsOut'), 'zoom 3 and out');
});

scenario('continents: 0 is off and 15 is always', 'map=2.00/30.000/10.000', async (page) => {
  await slide(page, 'continentsZoom', 0);
  assert.equal(await text(page, 'continentsOut'), 'off');
  assert.equal((await params(page)).get('continents'), '0');
  await page.locator('#continentsZoom').fill('15');
  assert.equal(await text(page, 'continentsOut'), 'always');
  assert.equal((await params(page)).get('continents'), '15');
});

scenario('continents: a hash number past the top clamps to 15', 'map=5.48/40.265/7.000&continents=99', async (page) => {
  assert.equal(await value(page, 'continentsZoom'), '15');
  assert.equal(await text(page, 'continentsOut'), 'always');
});

scenario('continents: 1 reads as an older link\'s checked box', 'map=5.48/40.265/7.000&continents=1', async (page) => {
  // Mismatch: the slider at 1 writes continents=1, which reads back as the default 5; 1 does not round-trip.
  assert.equal(await value(page, 'continentsZoom'), '5');
});

scenario('regions: the slider round-trips', 'map=5.48/40.265/7.000', async (page) => {
  await slide(page, 'regionsZoom', 9);
  assert.equal((await params(page)).get('regionszoom'), '9');
  assert.equal(await text(page, 'regionsOut'), 'zoom 9 and out');
});

scenario('regions: 1 reads as an older link\'s checked box', 'map=5.48/40.265/7.000&regionszoom=1', async (page) => {
  // Mismatch: as continents, regionszoom=1 reads back as the default 7.
  assert.equal(await value(page, 'regionsZoom'), '7');
});
