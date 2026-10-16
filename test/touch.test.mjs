// The page under touch, in headless Chromium with touch emulation at the two common phone widths
// (360 and 412 px): a two-finger pinch zooms the map about the pinch centre and not the page, one
// finger drags, the places flyout opens on a tap and shuts on a choice or a tap on the map, and the
// locate button flies to the fix and leaves the flyout shut. Under 520 px the settings drawer is a bottom
// sheet at half the window's height with the map above it, and the cartouche and the scale bar sit on
// cards clear of the map.
//
// Needs the built preview (`npm run build:preview` -> _site/), playwright-core and a Chromium
// (`npx playwright-core install chromium-headless-shell`); without them it skips, since `npm test`
// runs offline. CI sets TOUCH_REQUIRED=1 so that a skip there is a failure. TOUCH_SHOTS=<dir> also
// writes a screenshot per width.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const site = fileURLToPath(new URL('../_site/', import.meta.url));
const required = process.env.TOUCH_REQUIRED === '1';
let chromium = null;
try { ({ chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright-core')); } catch { /* not installed */ }
const skip = !existsSync(path.join(site, 'index.html')) ? 'no _site/: run `npm run build:preview`' : !chromium ? 'no playwright-core' : false;
if (skip && required) throw new Error(`touch test cannot run: ${skip}`);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf' };
const FIX = { latitude: 43.7, longitude: 7.3 };

for (const width of [360, 412]) {
  test(`touch at ${width} px: pinch, drag, flyout, locate`, { skip, timeout: 240000 }, async () => {
    const server = createServer(async (req, res) => {
      let p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (p.endsWith('/')) p = path.join(p, 'index.html');
      try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); } catch { res.writeHead(404).end(); }
    }).listen(0);
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, permissions: ['geolocation'], geolocation: FIX });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://localhost:${server.address().port}/#map=7/40/12`);
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });

      const cdp = await ctx.newCDPSession(page);
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
      const view = async () => { const [zoom, lat, lon] = (await page.evaluate(() => location.hash)).replace('#map=', '').split('/').map(Number); return { zoom, lat, lon }; };
      const settled = async (before) => { // the hash is written when the moved view is placed
        await page.waitForFunction((h) => location.hash !== h, before, { timeout: 60000 });
        await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 60000 });
      };
      const shown = () => page.evaluate(() => getComputedStyle(document.getElementById('flyout')).visibility === 'visible');
      const pageScale = () => page.evaluate(() => visualViewport.scale);
      const hash = () => page.evaluate(() => location.hash);
      const canvas = await page.locator('#map').boundingBox();
      const cx = canvas.x + canvas.width / 2, cy = canvas.y + canvas.height / 2;

      const pinchOut = async (x, y) => {
        const h = await hash();
        await touch('touchStart', [[x - 30, y], [x + 30, y]]);
        for (let i = 1; i <= 10; i++) await touch('touchMove', [[x - 30 - i * 8, y], [x + 30 + i * 8, y]]);
        await touch('touchEnd', []);
        await settled(h);
      };

      // a pinch about the centre of the canvas zooms by the spread (60 px to 220 px) and keeps the centre
      const v0 = await view();
      await pinchOut(cx, cy);
      const v1 = await view();
      assert.ok(Math.abs(v1.zoom - v0.zoom - Math.log2(220 / 60)) < 0.05, `zoom ${v0.zoom} -> ${v1.zoom}`);
      assert.ok(Math.abs(v1.lon - v0.lon) < 0.01 && Math.abs(v1.lat - v0.lat) < 0.01, `centre moved: ${JSON.stringify(v0)} -> ${JSON.stringify(v1)}`);
      assert.equal(await pageScale(), 1, 'the pinch zoomed the page');

      // a pinch where the shut flyout's box lies (top right) is the map's too
      await pinchOut(canvas.x + canvas.width - 100, canvas.y + 30);
      assert.ok((await view()).zoom > v1.zoom + 1, 'a pinch under the flyout box did not zoom the map');
      assert.equal(await pageScale(), 1, 'the pinch under the flyout box zoomed the page');

      // one finger drags
      const v2 = await view(), h2 = await hash();
      await touch('touchStart', [[cx, cy]]);
      for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx + i * 10, cy]]);
      await touch('touchEnd', []);
      await settled(h2);
      const v3 = await view();
      assert.ok(v3.lon < v2.lon - 0.0001 && v3.zoom === v2.zoom, `a drag right carries the chart with it, so the centre moves west: ${JSON.stringify(v2)} -> ${JSON.stringify(v3)}`);

      // the flyout: shut, opened by a tap on the places button, shut by a choice
      assert.equal(await shown(), false);
      await page.tap('#places');
      assert.equal(await shown(), true);
      assert.equal(await page.getAttribute('#places', 'aria-expanded'), 'true');
      const h3 = await hash();
      await page.tap('#origins button >> nth=2');
      assert.equal(await shown(), false, 'the flyout stayed open after a choice');
      await settled(h3);

      // shut by a tap on the map
      await page.tap('#places');
      assert.equal(await shown(), true);
      await page.touchscreen.tap(cx, cy);
      assert.equal(await shown(), false, 'the flyout stayed open after a tap on the map');

      // locate: the fix, at z10 or closer, the flyout shut, the button free again
      const h4 = await hash();
      await page.tap('#locate');
      assert.equal(await shown(), false, 'locate popped the flyout');
      await settled(h4);
      const v4 = await view();
      assert.ok(Math.abs(v4.lat - FIX.latitude) < 0.01 && Math.abs(v4.lon - FIX.longitude) < 0.01 && v4.zoom >= 10, JSON.stringify(v4));
      assert.equal(await page.$eval('#locate', (b) => b.disabled), false);
      assert.equal(await shown(), false);

      if (process.env.TOUCH_SHOTS) {
        await page.tap('#places');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(process.env.TOUCH_SHOTS, `touch-${width}.png`) });
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      server.close();
    }
  });
}

for (const width of [360, 412]) {
  test(`phone layout at ${width} px: the drawer is a half-height bottom sheet, the cartouche and scale bar are clear of the map`, { skip, timeout: 240000 }, async () => {
    const height = 740;
    const server = createServer(async (req, res) => {
      let p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (p.endsWith('/')) p = path.join(p, 'index.html');
      try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); } catch { res.writeHead(404).end(); }
    }).listen(0);
    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`http://localhost:${server.address().port}/#map=8/43.5/7.5`);
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
      const box = async (id) => (await page.locator(id).boundingBox());
      const apart = (a, b) => a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1 || a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1;
      const visible = (id) => page.evaluate((i) => { const e = document.getElementById(i); return !e.hidden && getComputedStyle(e).visibility === 'visible'; }, id);
      const shot = async (name) => { if (process.env.TOUCH_SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: path.join(process.env.TOUCH_SHOTS, `phone-${width}-${name}.png`) }); } };

      // sheet shut: the map has the window; both cards are shown and clear of it
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('drawer')).visibility), 'hidden');
      assert.ok(await visible('cardCartouche') && await visible('cardScale'), 'the cartouche and scale cards are not shown');
      let map = await box('#map');
      for (const id of ['#cardCartouche', '#cardScale']) assert.ok(apart(await box(id), map), `${id} overlaps the map when the sheet is shut`);
      await shot('closed');

      // sheet open: half the window, full width, at the foot; the map wholly above it, the cards clear of both
      await page.tap('#open');
      await page.waitForTimeout(400);
      const sheet = await box('#drawer');
      assert.ok(Math.abs(sheet.height - height / 2) <= 2 && Math.abs(sheet.width - width) <= 1 && Math.abs(sheet.y + sheet.height - height) <= 1, JSON.stringify(sheet));
      map = await box('#map');
      assert.ok(map.y + map.height <= sheet.y + 1, `the sheet covers the map: map ${JSON.stringify(map)}, sheet ${JSON.stringify(sheet)}`);
      for (const id of ['#cardCartouche', '#cardScale']) { const c = await box(id); assert.ok(apart(c, map), `${id} overlaps the map when the sheet is open`); assert.ok(c.y + c.height <= sheet.y + 1, `${id} is under the sheet`); }
      await shot('open');

      // the map is still the map: a drag above the sheet moves it and leaves the sheet up
      const h0 = await page.evaluate(() => location.hash);
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
      const cx = map.x + map.width / 2, cy = map.y + map.height / 2;
      await touch('touchStart', [[cx, cy]]);
      for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx + i * 10, cy]]);
      await touch('touchEnd', []);
      await page.waitForFunction((h) => location.hash !== h, h0, { timeout: 60000 });
      assert.equal(await page.evaluate(() => document.getElementById('drawer').classList.contains('open')), true, 'a drag on the map shut the sheet');

      // its controls are the same chips, then the close button shuts the sheet
      assert.ok(await page.locator('#drawer .chip').count() > 10);
      await page.tap('#close');
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('drawer')).visibility), 'hidden');
      map = await box('#map');
      assert.ok(Math.abs(map.y + map.height / 2 - height / 2) <= 2, 'the map did not come back to the middle of the window');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      server.close();
    }
  });
}

test('mouse: a click on the map does not stop the flyout opening on hover', { skip, timeout: 240000 }, async () => {
  const server = createServer(async (req, res) => {
    let p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p.endsWith('/')) p = path.join(p, 'index.html');
    try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); } catch { res.writeHead(404).end(); }
  }).listen(0);
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 740 } })).newPage();
    await page.goto(`http://localhost:${server.address().port}/#map=7/40/12`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    const shown = () => page.evaluate(() => getComputedStyle(document.getElementById('flyout')).visibility === 'visible');
    await page.mouse.click(400, 400);
    await page.hover('#home');
    await page.waitForTimeout(400);
    assert.equal(await shown(), true, 'hovering the row opens the flyout after a click on the map');
    await page.hover('#origins .group >> nth=0');
    await page.waitForTimeout(500);
    assert.equal(await shown(), true, 'resting on a group heading holds the flyout open');
  } finally {
    await browser.close();
    server.close();
  }
});
