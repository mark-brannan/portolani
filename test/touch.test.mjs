// The page under touch, in headless Chromium with touch emulation at the two common phone widths
// (360 and 412 px): a two-finger pinch zooms the map about the pinch centre and not the page, anywhere in
// the window, one finger drags, the anchor's drawer opens on a tap and shuts on a choice, Go shuts on a tap
// on the map and on a second tap on its compass, and its Find my position button fills in the fix, shuts Go
// and flies there without bringing up the keyboard. Under 520 px the map fills the window, cropped at its
// sides; the settings are a bottom sheet at half the window's height with the map above it, a lighter
// drawer a sheet as tall as its lines over the map's foot, and the cartouche and the scale bar sit on cards. With a mouse on a wide screen
// each of the seven drawers hangs below the row without covering or moving it, one at a time; several voyages
// are drawn at once, each in its own ink, and the link carries them.
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
const FIX = { latitude: 43.712345678, longitude: 7.298765432 }; // more digits than any rounding would keep

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

      // a pinch in the window's upper part, once empty margin above a band of map, is the map's
      const v1b = await view();
      await pinchOut(width / 2, 160);
      assert.ok((await view()).zoom > v1b.zoom + 1, 'a pinch in the upper part of the window did not zoom the map');
      assert.equal(await pageScale(), 1, 'the pinch in the upper part of the window zoomed the page');

      // a pinch just below the row of instruments (top right) is the map's too
      await pinchOut(width - 100, 80); // the canvas is wider than the window: its right edge is off screen
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

      // Go: a sheet that shuts on a tap on the map, and on a second tap on the compass
      await page.tap('#go');
      assert.equal(await shown(), true);
      await page.waitForTimeout(400);
      await page.touchscreen.tap(20, 300);
      assert.equal(await shown(), false, 'a tap on the map left the Go sheet up');
      await page.tap('#go');
      assert.equal(await shown(), true);
      await page.tap('#go');
      assert.equal(await shown(), false, 'a second tap on the compass left Go open');

      // locate: the fix fills in the box at full precision and the map stays put, Go still open; the box is not
      // focused, so no keyboard comes up. Go then flies there at z10 or closer and writes the link
      // (docs/decisions.md, 2026-10-29)
      const h4 = await hash();
      await page.tap('#go');
      await page.tap('#locate');
      await page.waitForFunction(() => document.getElementById('coordsText').value !== '', null, { timeout: 15000 }); // the fix comes back async
      assert.equal(await page.inputValue('#coordsText'), `${FIX.latitude}, ${FIX.longitude}`, 'the box does not hold the fix at full precision');
      assert.equal(await shown(), true, 'Find my position shut Go');
      assert.notEqual(await page.evaluate(() => document.activeElement.id), 'coordsText', 'Find my position focused the box');
      assert.equal(await page.$eval('#locate', (b) => b.disabled), false);
      await page.waitForTimeout(800); // longer than a flight
      assert.equal(await hash(), h4, 'Find my position moved the map');
      await page.tap('#coords button[type=submit]');
      await settled(h4);
      assert.equal(await shown(), false, 'Go left the drawer open');
      const v4 = await view();
      assert.ok(Math.abs(v4.lat - FIX.latitude) < 0.001 && Math.abs(v4.lon - FIX.longitude) < 0.001 && v4.zoom >= 10, JSON.stringify(v4));

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
  test(`phone layout at ${width} px: the map fills the window, the settings are a half-height bottom sheet, the cartouche and scale bar are on cards`, { skip, timeout: 240000 }, async () => {
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
      const visible = (id) => page.evaluate((i) => { const e = document.getElementById(i); return !e.hidden && getComputedStyle(e).visibility === 'visible'; }, id);
      const shot = async (name) => { if (process.env.TOUCH_SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: path.join(process.env.TOUCH_SHOTS, `phone-${width}-${name}.png`) }); } };

      // sheet shut: the map has the window; both cards are shown and clear of it
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('drawer')).visibility), 'hidden');
      assert.ok(await visible('cardCartouche') && await visible('cardScale'), 'the cartouche and scale cards are not shown');
      let map = await box('#map');
      assert.ok(map.x <= 0 && map.y <= 0 && map.x + map.width >= width && map.y + map.height >= height, `the map does not fill the window: ${JSON.stringify(map)}`);
      await shot('closed');

      // sheet open: half the window, full width, at the foot; the map wholly above it, the cards clear of both
      await page.tap('#open');
      await page.waitForTimeout(400);
      const sheet = await box('#drawer');
      assert.ok(Math.abs(sheet.height - height / 2) <= 2 && Math.abs(sheet.width - width) <= 1 && Math.abs(sheet.y + sheet.height - height) <= 1, JSON.stringify(sheet));
      map = await box('#map');
      assert.ok(map.y + map.height <= sheet.y + 1, `the sheet covers the map: map ${JSON.stringify(map)}, sheet ${JSON.stringify(sheet)}`);
      assert.ok(map.y <= 0 && map.x <= 0 && map.x + map.width >= width, `the map does not fill the half above the sheet: ${JSON.stringify(map)}`);
      for (const id of ['#cardCartouche', '#cardScale']) { const c = await box(id); assert.ok(c.y + c.height <= sheet.y + 1, `${id} is under the sheet`); }
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
      assert.ok(light.height <= height / 2 + 2 && Math.abs(light.width - width) <= 1 && Math.abs(light.y + light.height - height) <= 1, JSON.stringify(light));
      map = await box('#map');
      assert.ok(map.y <= 0 && map.y + map.height >= height, `the map does not stay full behind the anchorages: ${JSON.stringify(map)}`);

      // a second tap on the anchor shuts the sheet, and the map has the window again
      await page.tap('#anchor');
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('anchorPanel')).visibility), 'hidden');
      map = await box('#map');
      assert.ok(Math.abs(map.y + map.height / 2 - height / 2) <= 2, 'the map did not come back to the middle of the window');
      assert.ok(map.y <= 0 && map.y + map.height >= height, `the map does not fill the window again: ${JSON.stringify(map)}`);
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
    for (const [b, d] of [['#open', 'drawer'], ['#charts', 'chartsDrawer'], ['#sights', 'sightsPanel'], ['#go', 'goPanel'], ['#voyages', 'voyagesPanel'], ['#people', 'peoplePanel'], ['#anchor', 'anchorPanel']]) {
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
    await page.click('#sightsList button >> text=Goa'); // the age of discovery, the one group open at first
    assert.equal(await opened('sightsPanel'), false, 'a point of interest left its drawer open');
    await page.waitForFunction((x) => location.hash !== x, hs, { timeout: 60000 });
    // Go takes the focus in its box; Esc shuts it and gives the focus back to the compass
    await page.click('#go');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'coordsText');
    await page.keyboard.press('Escape');
    assert.equal(await opened('goPanel'), false, 'Esc left Go open');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'go', 'Esc did not give the focus back to the compass');
    // a chart is a row: without a scan its thumbnail is the greyed chart glyph, and it flies to the chart's frame and shuts the drawer
    await page.click('#charts');
    const h = await page.evaluate(() => location.hash);
    const thumb = page.locator('#chartList .chart', { hasText: 'Vesconte' }).locator('.thumb');
    assert.equal(await thumb.evaluate((b) => b.classList.contains('none')), true, 'Vesconte has a scan thumbnail');
    await thumb.click();
    assert.equal(await opened('chartsDrawer'), false, "a chart's sheet left its drawer open");
    await page.waitForFunction((x) => location.hash !== x, h, { timeout: 60000 });
    const [, lat, lon] = (await page.evaluate(() => location.hash)).replace('#map=', '').split('/').map(Number);
    assert.ok(Math.abs(lat - 37.5) < 1 && Math.abs(lon - 25.2) < 1, `Vesconte's sheet is not round the Cyclades: ${lat}, ${lon}`);
    // the eye shows and hides a chart's sheet and leaves the drawer open
    await page.click('#charts');
    const cosa = page.locator('#chartList .chart', { hasText: 'Juan de la Cosa' });
    const overlaid = () => page.evaluate(() => /[#&]overlay=de-la-cosa(&|$)/.test(location.hash));
    await cosa.locator('.eye').click();
    await page.waitForFunction(() => /[#&]overlay=de-la-cosa(&|$)/.test(location.hash), null, { timeout: 60000 });
    assert.equal(await opened('chartsDrawer'), true, 'the eye shut the drawer');
    assert.equal(await cosa.locator('.eye').getAttribute('aria-pressed'), 'true');
    await cosa.locator('.eye').click();
    await page.waitForFunction(() => !/[#&]overlay=/.test(location.hash), null, { timeout: 60000 });
    assert.equal(await opened('chartsDrawer'), true, 'the eye shut the drawer');
    // the city under the sheet: the flight there takes the sheet off
    await cosa.locator('.eye').click();
    await page.waitForFunction(() => /[#&]overlay=de-la-cosa(&|$)/.test(location.hash), null, { timeout: 60000 });
    await cosa.locator('.city').click();
    await page.waitForFunction(() => !/[#&]overlay=/.test(location.hash), null, { timeout: 60000 });
    assert.equal(await overlaid(), false, 'the sheet still covers El Puerto de Santa María');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

// The Charts drawer's two controls (the user's UI walk of 2026-10-30): the eye shows or hides its own chart's sheet and
// nothing else, so another sheet stays laid, a dragged sheet keeps where it lies, and the map does not move; the
// chart's picture shows that chart alone, at its own placement, and flies to it: every other sheet hides.
test('charts: the eye shows or hides one sheet and leaves the others and the map alone; the picture shows its chart at its own placement', { skip, timeout: 240000 }, async () => {
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
    const MOVED = '10.000,62.000,0.01063,5.0'; // the Carta Marina dragged off its own placement
    await page.goto(`http://localhost:${server.address().port}/#map=3.40/48.000/24.000&overlay=carta-marina&sheet=${MOVED}`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    const key = async (k) => new URLSearchParams((await page.evaluate(() => location.hash)).slice(1)).get(k);
    const changed = async (before) => {
      await page.waitForFunction((h) => location.hash !== h, before, { timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 60000 });
    };
    const press = async (b) => { const h = await page.evaluate(() => location.hash); await b.click(); await changed(h); };
    await page.click('#charts');
    const marina = page.locator('#chartList .chart', { hasText: 'Carta Marina' }), aguiar = page.locator('#chartList .chart', { hasText: 'Jorge de Aguiar' });
    await aguiar.locator('.eye').waitFor({ state: 'visible' });
    const map = await key('map');

    await press(aguiar.locator('.eye'));
    assert.equal(await key('overlay'), 'carta-marina,aguiar', "the eye's show hid the other sheet");
    assert.equal(await key('sheet'), MOVED, "the eye's show moved the other sheet");
    assert.equal(await key('map'), map, "the eye's show moved the map");
    assert.equal(await marina.locator('.eye').getAttribute('aria-pressed'), 'true');
    assert.equal(await aguiar.locator('.eye').getAttribute('aria-pressed'), 'true');

    await press(aguiar.locator('.eye'));
    assert.equal(await key('overlay'), 'carta-marina', "the eye's hide hid the other sheet too");
    assert.equal(await key('sheet'), MOVED);
    assert.equal(await key('map'), map, "the eye's hide moved the map");
    assert.equal(await aguiar.locator('.eye').getAttribute('aria-pressed'), 'false');

    await press(marina.locator('.eye'));
    assert.equal(await key('overlay'), null);
    await press(marina.locator('.eye'));
    assert.equal(await key('overlay'), 'carta-marina');
    assert.equal(await key('sheet'), MOVED, 'hidden and shown by its eye, the sheet came back at its own placement, not where it was dragged');
    assert.equal(await key('map'), map, 'the eye moved the map');
    assert.equal(await page.evaluate(() => document.getElementById('chartsDrawer').classList.contains('open')), true, 'the eye shut the drawer');

    await press(aguiar.locator('.eye'));
    assert.equal(await key('overlay'), 'carta-marina,aguiar');
    await press(marina.locator('.thumb'));
    assert.equal(await key('overlay'), 'carta-marina', 'the picture left another sheet laid');
    assert.equal(await key('sheet'), null, 'the picture left the sheet where it was dragged, not at its own placement');
    assert.notEqual(await key('map'), map, 'the picture did not fly to the chart');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('voyages: several drawn at once, each in its own ink, carried by the link; an older single voyage= link opens; Clear empties the list', { skip, timeout: 240000 }, async () => {
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
    await page.goto(`http://localhost:${server.address().port}/#map=2/15/-20&voyage=magellan`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    await page.click('#voyages');
    await page.waitForSelector('#voyageList [data-voyage]');
    const on = () => page.$$eval('#voyageList [aria-checked=true]', (bs) => bs.map((b) => b.dataset.voyage));
    const inks = () => page.$$eval('#voyageList [data-ink]:not([hidden])', (is) => is.map((i) => i.value));
    const hash = () => page.evaluate(() => decodeURIComponent(location.hash));
    assert.deepEqual(await on(), ['magellan'], 'the older voyage= link');
    await page.click('#voyageList [data-voyage="columbus"]');
    await page.click('#voyageList [data-voyage="drake"]');
    assert.equal(await page.$eval('#voyagesPanel', (d) => d.classList.contains('open')), true, 'a choice shut the drawer');
    assert.deepEqual(await on(), ['columbus', 'magellan', 'drake']); // the list's order
    assert.equal(new Set(await inks()).size, 3, 'two voyages share an ink');
    assert.match(await hash(), /voyages=magellan,columbus,drake(&|$)/);
    await page.$eval('#voyageList [data-ink="drake"]', (i) => { i.value = '#16727a'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await hash(), /voyages=magellan,columbus,drake:16727a/);
    await page.click('#voyageWidth [data-value="4.5"]');
    assert.match(await hash(), /voyagewidth=4.5/);
    if (!(await page.$eval('#voyagesPanel', (d) => d.classList.contains('open')))) await page.click('#voyages');
    await page.click('#voyagesPanel .tool');
    assert.deepEqual(await on(), []);
    assert.doesNotMatch(await hash(), /voyages=/);
    assert.equal(await page.$eval('#voyagesPanel .tool', (b) => b.disabled), true, 'Clear still offered with nothing to clear');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
