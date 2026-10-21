// The page under touch, in headless Chromium with touch emulation at the two common phone widths
// (360 and 412 px): a two-finger pinch zooms the map about the pinch centre and not the page, one
// finger drags, the anchor's drawer opens on a tap and shuts on a choice, Go stays up under a tap on the
// map and shuts on a second tap on its compass, and its Find my position button fills in the fix without
// flying there. Under 520 px every drawer is a bottom sheet at half the window's height with the map above
// it, and the cartouche and the scale bar sit on cards clear of the map. With a mouse on a wide screen
// each of the six drawers hangs below the row without covering or moving it, one at a time.
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
  test(`touch at ${width} px: pinch, drag, drawers, locate`, { skip, timeout: 240000 }, async () => {
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
      const shown = (id = 'goPanel') => page.evaluate((i) => document.getElementById(i).classList.contains('open') && getComputedStyle(document.getElementById(i)).visibility === 'visible', id);
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

      // a pinch just below the row of instruments (top right) is the map's too
      await pinchOut(canvas.x + canvas.width - 100, canvas.y + 80);
      assert.ok((await view()).zoom > v1.zoom + 1, 'a pinch below the row did not zoom the map');
      assert.equal(await pageScale(), 1, 'the pinch below the row zoomed the page');

      // one finger drags
      const v2 = await view(), h2 = await hash();
      await touch('touchStart', [[cx, cy]]);
      for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx + i * 10, cy]]);
      await touch('touchEnd', []);
      await settled(h2);
      const v3 = await view();
      assert.ok(v3.lon < v2.lon - 0.0001 && v3.zoom === v2.zoom, `a drag right carries the chart with it, so the centre moves west: ${JSON.stringify(v2)} -> ${JSON.stringify(v3)}`);

      // the anchor's drawer: shut, opened by a tap on the anchor, shut by a choice (the third line, The North)
      assert.equal(await shown('anchorPanel'), false);
      await page.tap('#anchor');
      assert.equal(await shown('anchorPanel'), true);
      assert.equal(await page.getAttribute('#anchor', 'aria-expanded'), 'true');
      const h3 = await hash();
      await page.tap('#anchorages button >> nth=2');
      assert.equal(await shown('anchorPanel'), false, 'the drawer stayed open after a choice');
      await settled(h3);

      // Go: a sheet that stays up under a tap on the map, and shuts on a second tap on the compass
      await page.tap('#go');
      assert.equal(await shown(), true);
      await page.waitForTimeout(400);
      const above = await page.locator('#map').boundingBox();
      await page.touchscreen.tap(above.x + 20, above.y + above.height / 2);
      assert.equal(await shown(), true, 'a tap on the map shut the Go sheet');
      await page.tap('#go');
      assert.equal(await shown(), false, 'a second tap on the compass left Go open');

      // locate: the fix fills in the box, Go stays open and nothing flies; Go then flies there at z10 or closer
      const h4 = await hash();
      await page.tap('#go');
      await page.tap('#locate');
      await page.waitForFunction(() => document.getElementById('coordsText').value !== '', null, { timeout: 15000 }); // the fix comes back async
      assert.equal(await page.inputValue('#coordsText'), `${FIX.latitude.toFixed(4)}, ${FIX.longitude.toFixed(4)}`);
      assert.equal(await shown(), true, 'Find my position shut Go');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'coordsText');
      assert.equal(await page.$eval('#locate', (b) => b.disabled), false);
      await page.waitForTimeout(800);
      assert.equal(await hash(), h4, 'Find my position moved the map');
      await page.tap('#coords button[type=submit]');
      assert.equal(await shown(), false, 'Go stayed open after going');
      await settled(h4);
      const v4 = await view();
      assert.ok(Math.abs(v4.lat - FIX.latitude) < 0.01 && Math.abs(v4.lon - FIX.longitude) < 0.01 && v4.zoom >= 10, JSON.stringify(v4));

      if (process.env.TOUCH_SHOTS) {
        await page.tap('#go');
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
  test(`phone layout at ${width} px: a drawer is a half-height bottom sheet, the cartouche and scale bar are clear of the map`, { skip, timeout: 240000 }, async () => {
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

      // its controls are the same chips; the anchor swaps it for the anchorages, the same sheet at the foot
      assert.ok(await page.locator('#drawer .chip').count() > 10);
      await page.tap('#anchor');
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('drawer')).visibility), 'hidden', 'the anchor left the settings open');
      const light = await box('#anchorPanel');
      assert.ok(Math.abs(light.height - height / 2) <= 2 && Math.abs(light.width - width) <= 1 && Math.abs(light.y + light.height - height) <= 1, JSON.stringify(light));
      map = await box('#map');
      assert.ok(map.y + map.height <= light.y + 1, `the anchorages cover the map: map ${JSON.stringify(map)}, sheet ${JSON.stringify(light)}`);

      // a second tap on the anchor shuts the sheet, and the map has the window again
      await page.tap('#anchor');
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('anchorPanel')).visibility), 'hidden');
      map = await box('#map');
      assert.ok(Math.abs(map.y + map.height / 2 - height / 2) <= 2, 'the map did not come back to the middle of the window');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      server.close();
    }
  });
}

test('mouse: the drawers open on a click, not a hover, one at a time below the row without moving it, and shut on a second click, a click elsewhere or Esc', { skip, timeout: 240000 }, async () => {
  const server = createServer(async (req, res) => {
    let p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p.endsWith('/')) p = path.join(p, 'index.html');
    try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); } catch { res.writeHead(404).end(); }
  }).listen(0);
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 740 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/#map=7/40/12`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    const opened = (id) => page.evaluate((i) => document.getElementById(i).classList.contains('open') && getComputedStyle(document.getElementById(i)).visibility === 'visible', id);
    const row = () => page.locator('#where .row').boundingBox();
    const apart = (a, b) => a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1 || a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1;
    await page.hover('#go');
    await page.waitForTimeout(400);
    assert.equal(await opened('goPanel'), false, 'a hover opened Go');

    // each button opens its own drawer and shuts the one before; the row stays put and the drawer clear of it
    const row0 = await row();
    for (const [b, d] of [['#open', 'drawer'], ['#charts', 'chartsDrawer'], ['#sights', 'sightsPanel'], ['#go', 'goPanel'], ['#voyages', 'voyagesPanel'], ['#anchor', 'anchorPanel']]) {
      await page.click(b);
      await page.waitForTimeout(400);
      assert.equal(await opened(d), true, `${b} did not open ${d}`);
      assert.equal(await page.getAttribute(b, 'aria-expanded'), 'true');
      assert.equal(await page.evaluate(() => document.querySelectorAll('.drawer.open').length), 1, `${b}: more than one drawer open`);
      assert.deepEqual(await row(), row0, `${d} moved the row`);
      const box = await page.locator(`#${d}`).boundingBox();
      assert.ok(apart(box, row0), `${d} covers the row: ${JSON.stringify(box)}, row ${JSON.stringify(row0)}`);
    }
    assert.equal(await page.locator('.drawer .close, #close').count(), 0, 'a close button is back');
    await page.click('#anchor');
    assert.equal(await opened('anchorPanel'), false, 'a second click left the anchorages open');

    await page.click('#voyages');
    assert.equal(await opened('voyagesPanel'), true);
    await page.mouse.click(400, 400);
    assert.equal(await opened('voyagesPanel'), false, 'a click on the map left the voyages open');
    await page.click('#open');
    await page.mouse.click(400, 400);
    assert.equal(await opened('drawer'), false, 'a click on the map left the settings open');
    // the astrolabe's points of interest: a choice flies there and shuts the drawer
    await page.click('#sights');
    assert.equal(await opened('sightsPanel'), true, 'the astrolabe did not open the points of interest');
    const hs = await page.evaluate(() => location.hash);
    await page.click('#sightsList button >> text=Pitcairn Islands');
    assert.equal(await opened('sightsPanel'), false, 'a point of interest left its drawer open');
    await page.waitForFunction((x) => location.hash !== x, hs, { timeout: 60000 });
    // Go takes the focus in its box; Esc shuts it and gives the focus back to the compass
    await page.click('#go');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'coordsText');
    await page.keyboard.press('Escape');
    assert.equal(await opened('goPanel'), false, 'Esc left Go open');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'go', 'Esc did not give the focus back to the compass');
    // a chart is a section: its sheet button flies to the sheet and shuts the drawer; its scan is still to come
    await page.click('#charts');
    const h = await page.evaluate(() => location.hash);
    const vesconte = page.locator('#chartList .chart', { hasText: 'Vesconte' });
    assert.equal(await vesconte.locator('button', { hasText: 'The scan' }).isDisabled(), true, 'the scan button is live');
    await vesconte.locator('button', { hasText: 'The sheet' }).click();
    assert.equal(await opened('chartsDrawer'), false, "a chart's sheet left its drawer open");
    await page.waitForFunction((x) => location.hash !== x, h, { timeout: 60000 });
    const [, lat, lon] = (await page.evaluate(() => location.hash)).replace('#map=', '').split('/').map(Number);
    assert.ok(Math.abs(lat - 37.5) < 1 && Math.abs(lon - 25.2) < 1, `Vesconte's sheet is not round the Cyclades: ${lat}, ${lon}`);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
