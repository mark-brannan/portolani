// The page under touch, in headless Chromium with touch emulation at the two common phone widths
// (360 and 412 px): a two-finger pinch zooms the map about the pinch centre and not the page, anywhere in
// the window, one finger drags, the anchor's drawer opens on a tap and stays up on a choice, Go stays up on a
// tap on the map and shuts on a second tap on its compass, and its Find my position button fills in the fix and
// flies there without bringing up the keyboard, Go still up (the user, 2026-10-30). Under 520 px the map fills the window, cropped at its
// sides; the settings are a bottom sheet at half the window's height with the map above it, a lighter
// drawer a sheet as tall as its lines over the map's foot, and the cartouche and the scale bar sit on cards. With a mouse on a wide screen
// each of the seven drawers hangs below the row without covering or moving it, one at a time; several voyages
// are drawn at once, each in its own ink, and the link carries them. With the hover chips on, a mouse resting on a grouped
// list's shut heading opens its section after the dwell; off (hover=0 in the link), only a click does; a phone has no chips.
// A person's picture on the map is looked at large, put away by the pointer or the keyboard, and dealt back by choosing
// the person again; the last one touched or focused lies on top; the link to its Commons page is a glyph labelled in full.
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

      // the anchor's drawer: shut, opened by a tap on the anchor, still up after a choice (the third line, The North)
      assert.equal(await shown('anchorPanel'), false);
      await page.tap('#anchor');
      assert.equal(await shown('anchorPanel'), true);
      assert.equal(await page.getAttribute('#anchor', 'aria-expanded'), 'true');
      const h3 = await hash();
      await page.tap('#anchorages button >> nth=2');
      assert.equal(await shown('anchorPanel'), true, 'a choice shut the drawer');
      await settled(h3);

      // Go: a sheet that stays up on a tap on the map, and shuts on a second tap on the compass
      await page.tap('#go');
      assert.equal(await shown(), true);
      await page.waitForTimeout(400);
      await page.touchscreen.tap(20, 300);
      assert.equal(await shown(), true, 'a tap on the map shut the Go sheet');
      await page.tap('#go');
      assert.equal(await shown(), false, 'a second tap on the compass left Go open');
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
      assert.equal(await shown(), true, 'Go shut the drawer');
      assert.notEqual(await page.evaluate(() => document.activeElement.id), 'coordsText', 'Go left the keyboard up');
      const v4 = await view();
      assert.ok(Math.abs(v4.lat - FIX.latitude) < 0.001 && Math.abs(v4.lon - FIX.longitude) < 0.001 && v4.zoom >= 10, JSON.stringify(v4));

      if (process.env.TOUCH_SHOTS) {
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
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('hoverRow')).display), 'none', 'a touch screen shows the hover chips');
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

test('mouse: the drawers open on a click, not a hover, one at a time below the row without moving it, stay open on a choice, and shut on a second click, a click on the map or Esc', { skip, timeout: 240000 }, async () => {
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
    for (const [b, d] of [['#open', 'drawer'], ['#charts', 'chartsDrawer'], ['#sights', 'sightsPanel'], ['#go', 'goPanel'], ['#voyages', 'timelinePanel'], ['#people', 'timelinePanel'], ['#anchor', 'anchorPanel']]) {
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
    assert.equal(await opened('timelinePanel'), true);
    await page.mouse.click(200, 400);
    assert.equal(await opened('timelinePanel'), false, 'a click on the map left the timeline open');
    await page.click('#open');
    await page.mouse.click(400, 400);
    assert.equal(await opened('drawer'), false, 'a click on the map left the settings open');
    // the astrolabe's points of interest: at most one era open at a time, a second click shuts it; a choice flies there and leaves the drawer open
    await page.click('#sights');
    assert.equal(await opened('sightsPanel'), true, 'the astrolabe did not open the points of interest');
    const openGroups = () => page.$$eval('#sightsList .group.open > .fold', (hs) => hs.map((h) => h.firstChild.textContent));
    assert.deepEqual(await openGroups(), ['The age of discovery'], 'not exactly the marked era open');
    assert.equal(await page.locator('#sightsList details').count(), 0, 'a disclosure triangle is back');
    await page.click('#sightsList .fold >> text=The ancient world');
    assert.deepEqual(await openGroups(), ['The ancient world'], 'a heading did not swap the open era');
    await page.click('#sightsList .fold >> text=The ancient world');
    assert.deepEqual(await openGroups(), [], 'a click on the open heading left it open');
    assert.deepEqual(await page.$$eval('#sightsList .group', (gs) => gs.map((g) => [g.querySelector(':scope > .fold').getAttribute('aria-expanded'), g.querySelector(':scope > .rows > div').inert])),
      Array.from({ length: await page.locator('#sightsList .group').count() }, () => ['false', true]), 'a shut group is not shut to the keyboard');
    await page.click('#sightsList .fold >> text=The age of discovery');
    assert.deepEqual(await openGroups(), ['The age of discovery'], 'a heading did not open its era with none open');
    await page.waitForTimeout(400); // the slide
    const hs = await page.evaluate(() => location.hash);
    await page.click('#sightsList button >> text=Goa');
    assert.equal(await opened('sightsPanel'), true, 'a point of interest shut its drawer');
    await page.waitForFunction((x) => location.hash !== x, hs, { timeout: 60000 });
    // hover, on by default for the demo: the mouse resting on a shut era's heading past the dwell (350 ms) slides it open
    // and the open one shut; the click that was on its way keeps it open; leaving the list shuts nothing
    await page.hover('#sightsList .fold >> text=The ancient world');
    await page.waitForTimeout(150);
    assert.deepEqual(await openGroups(), ['The age of discovery'], 'a passing pointer opened an era before the dwell');
    await page.waitForTimeout(450);
    assert.deepEqual(await openGroups(), ['The ancient world'], 'resting on a heading did not open its era');
    await page.click('#sightsList .fold >> text=The ancient world');
    assert.deepEqual(await openGroups(), ['The ancient world'], 'the click after the dwell shut the era it opened');
    await page.mouse.move(400, 400);
    await page.waitForTimeout(400);
    assert.deepEqual(await openGroups(), ['The ancient world'], 'leaving the list shut the era');
    assert.equal(await opened('sightsPanel'), true, 'a hover shut the drawer');
    // a heading the slide brings under a still pointer does not open in turn: the open era above shuts, the hovered one
    // rises, and with its rows cut short here the next heading comes to rest under the pointer; a nudge opens nothing
    const pointer = await page.evaluate(() => {
      const [anc, med, aod] = [...document.querySelectorAll('#sightsList .group')], fold = (g) => g.querySelector(':scope > .fold').getBoundingClientRect();
      const m = fold(med), y = m.top + m.height / 2, rise = anc.querySelector(':scope > .rows').getBoundingClientRect().height;
      // after the slide the pointer sits (y - m.top + rise) below the medieval heading's top; put the next heading's middle there
      med.querySelector('.places').style.cssText = `height:${y - m.top + rise - m.height - fold(aod).height / 2 - 6}px;overflow:hidden`;
      return { x: m.left + 40, y };
    });
    await page.mouse.move(pointer.x, pointer.y);
    await page.waitForTimeout(700);
    assert.deepEqual(await openGroups(), ['The medieval Indian Ocean and Asia'], 'resting on the second heading did not open it');
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.fold')?.firstChild.textContent, pointer), 'The age of discovery', 'the slide did not bring the next heading under the pointer');
    await page.mouse.move(pointer.x + 1, pointer.y);
    await page.waitForTimeout(700);
    assert.deepEqual(await openGroups(), ['The medieval Indian Ocean and Asia'], 'a heading the slide brought under the pointer opened on a nudge');
    await page.evaluate(() => { document.querySelectorAll('#sightsList .group')[1].querySelector('.places').style.cssText = ''; });
    await page.click('#sightsList .fold >> text=The ancient world');
    // off, from its chip in the settings, which writes hover=0 into the link: resting on a heading opens nothing
    await page.click('#open');
    await page.click('#hoverOpen [data-value="off"]');
    assert.match(await page.evaluate(() => location.hash), /[#&]hover=0(&|$)/, 'the off chip is not in the link');
    await page.click('#sights');
    await page.hover('#sightsList .fold >> text=The medieval Indian Ocean');
    await page.waitForTimeout(600);
    assert.deepEqual(await openGroups(), ['The ancient world'], 'with hover off, resting on a heading opened its era');
    await page.click('#sightsList .fold >> text=The medieval Indian Ocean');
    assert.deepEqual(await openGroups(), ['The medieval Indian Ocean and Asia'], 'with hover off, a click did not open its era');
    // back on from the chip, which takes the key out of the link; a link with hover=0 turns it off again
    await page.click('#open');
    await page.click('#hoverOpen [data-value="on"]');
    assert.doesNotMatch(await page.evaluate(() => location.hash), /hover=/, 'on is written into the link');
    await page.evaluate(() => { location.hash += '&hover=0'; });
    await page.waitForFunction(() => document.querySelector('#hoverOpen [data-value="off"]').getAttribute('aria-checked') === 'true', null, { timeout: 10000 });
    await page.click('#hoverOpen [data-value="on"]');
    // Go takes the focus in its box; Esc shuts it and gives the focus back to the compass
    await page.click('#go');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'coordsText');
    await page.keyboard.press('Escape');
    assert.equal(await opened('goPanel'), false, 'Esc left Go open');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'go', 'Esc did not give the focus back to the compass');
    // a chart is a row: without a scan its thumbnail is the greyed chart glyph, and it flies to the chart's frame, the drawer left open
    await page.click('#charts');
    const h = await page.evaluate(() => location.hash);
    const thumb = page.locator('#chartList .chart', { hasText: 'Vesconte' }).locator('.thumb');
    assert.equal(await thumb.evaluate((b) => b.classList.contains('none')), true, 'Vesconte has a scan thumbnail');
    await thumb.click();
    assert.equal(await opened('chartsDrawer'), true, "a chart's frame shut its drawer");
    await page.waitForFunction((x) => location.hash !== x, h, { timeout: 60000 });
    const [, lat, lon] = (await page.evaluate(() => location.hash)).replace('#map=', '').split('/').map(Number);
    assert.ok(Math.abs(lat - 37.5) < 1 && Math.abs(lon - 25.2) < 1, `Vesconte's sheet is not round the Cyclades: ${lat}, ${lon}`);
    // the eye shows and hides a chart's sheet and leaves the drawer open
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
    // the picture writes the link at once and draws at the flight's landing, so wait for the map to move
    await page.waitForFunction((m) => new URLSearchParams(location.hash.slice(1)).get('map') !== m, map, { timeout: 30000 })
      .catch(() => assert.fail('the picture did not fly to the chart'));

    // two sheets laid one on the other: a drag where both lie takes the top one, the last in the link
    const AT = '2.600,31.300,0.01710,0.0';
    await page.goto(`http://localhost:${server.address().port}/#map=3.00/31.300/2.600&overlay=catalan-atlas-1959-copy,aguiar&sheet=${AT};${AT}`);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    const c = await page.locator('#map').boundingBox(), [x, y] = [c.x + c.width / 2, c.y + c.height / 2];
    const h = await page.evaluate(() => location.hash);
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + i * 10, y + i * 5);
    await page.mouse.up();
    await changed(h);
    const [under, over] = (await key('sheet')).split(';');
    assert.equal(under, AT, 'the drag moved the lower sheet');
    assert.notEqual(over, AT, 'the drag left the top sheet where it was');
    assert.equal(await key('map'), '3.00/31.300/2.600', 'the drag on a sheet panned the map');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('voyages: several drawn at once, each in its own ink, carried by the link; the eye shows or hides one, the name shows it alone and draws it on every time; an older single voyage= link opens; Clear empties the list', { skip, timeout: 240000 }, async () => {
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
    const on = () => page.$$eval('#voyageList [data-shown=true]', (bs) => bs.map((b) => b.dataset.voyage));
    const inks = () => page.$$eval('#voyageList [data-ink]:not([hidden])', (is) => is.map((i) => i.value));
    const hash = () => page.evaluate(() => decodeURIComponent(location.hash));
    const viewNow = () => page.evaluate(() => location.hash.match(/map=([^&]+)/)?.[1].split('/').map(Number).join('/'));
    const settled = () => page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 60000 });
    // the pen's frames say "drawing" in the status line; watched as they come, since a poll can miss a short draw
    const pen = () => page.evaluate(() => { window.drew = false; new MutationObserver((_, o) => { if (document.getElementById('status').textContent.includes(': drawing')) { window.drew = true; o.disconnect(); } }).observe(document.getElementById('status'), { childList: true, characterData: true, subtree: true }); });
    const drawing = () => page.waitForFunction(() => window.drew, null, { timeout: 30000, polling: 100 });
    const inkOf = async () => Object.fromEntries(await page.$$eval('#voyageList [data-ink]:not([hidden])', (is) => is.map((i) => [i.dataset.ink, i.value])));
    assert.deepEqual(await on(), ['magellan'], 'the older voyage= link');
    // the eye: that one voyage on or off, at once, no flight, no pen, no other voyage touched
    await settled();
    const where = await viewNow();
    await pen();
    await page.click('#voyageList [data-eye="columbus"]');
    await page.click('#voyageList [data-eye="drake"]');
    assert.equal(await page.$eval('#timelinePanel', (d) => d.classList.contains('open')), true, 'a choice shut the drawer');
    assert.deepEqual(await on(), ['columbus', 'magellan', 'drake']); // the list's order
    assert.equal(new Set(await inks()).size, 3, 'two voyages share an ink');
    assert.match(await hash(), /voyages=magellan,columbus,drake(&|$)/);
    await page.waitForTimeout(400);
    assert.equal(await viewNow(), where, 'the eye moved the view');
    assert.equal(await page.evaluate(() => window.drew), false, 'the eye set the pen going');
    const before = await inkOf();
    await page.click('#voyageList [data-eye="magellan"]');
    assert.deepEqual(await on(), ['columbus', 'drake'], 'the eye did not hide it');
    assert.match(await hash(), /voyages=magellan~,columbus,drake(&|$)/);
    await page.waitForTimeout(400);
    assert.equal(await viewNow(), where, 'the eye moved the view');
    for (const [id, c] of Object.entries(await inkOf())) assert.equal(c, before[id], `${id} changed ink when another was hidden`);
    // the pen's seconds: 2.5 by default, a slider from 1 to 5 in halves, shown beside it and carried by the link
    assert.equal(await page.$eval('#voyageDrawOut', (o) => o.textContent), '2.5 s');
    assert.deepEqual(await page.$eval('#voyageDraw', (i) => [i.min, i.max, i.step, i.value]), ['1', '5', '0.5', '2.5']);
    await page.$eval('#voyageDraw', (i) => { i.value = '1'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.equal(await page.$eval('#voyageDrawOut', (o) => o.textContent), '1 s');
    assert.match(await hash(), /voyagedraw=1(&|$)/);
    // the name: that voyage alone, framed, and drawn on afresh every time; the others hidden, their colours kept
    await pen();
    await page.click('#voyageList [data-voyage="magellan"]');
    assert.deepEqual(await on(), ['magellan'], 'the name did not show it alone');
    assert.match(await hash(), /voyages=magellan,columbus~,drake~(&|$)/);
    await drawing();
    await settled();
    assert.notEqual(await viewNow(), where, 'the name did not fly to frame the voyage');
    for (const [id, c] of Object.entries(await inkOf())) assert.equal(c, before[id], `${id} changed ink when the name hid it`);
    await pen();
    await page.click('#voyageList [data-voyage="magellan"]');
    assert.deepEqual(await on(), ['magellan'], 'a second click on the name changed what is shown');
    await drawing(); // a second click draws it on again
    await settled();
    await page.click('#voyageList [data-eye="columbus"]');
    await page.click('#voyageList [data-eye="drake"]');
    assert.deepEqual(await on(), ['columbus', 'magellan', 'drake'], 'the eyes did not show them again');
    await page.$eval('#voyageList [data-ink="drake"]', (i) => { i.value = '#16727a'; i.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await hash(), /voyages=magellan,columbus,drake:16727a/);
    await page.click('#voyageWidth [data-value="4.5"]');
    assert.match(await hash(), /voyagewidth=4.5/);
    if (!(await page.$eval('#timelinePanel', (d) => d.classList.contains('open')))) await page.click('#voyages');
    await page.click('#timelinePanel .tool');
    assert.deepEqual(await on(), []);
    assert.doesNotMatch(await hash(), /voyages=/);
    assert.equal(await page.$eval('#timelinePanel .tool', (b) => b.disabled), true, 'Clear still offered with nothing to clear');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('timeline: people above the axis, voyages below, each once, the era bands across it end to end, Earlier widens it; each button opens it at its own lane', { skip, timeout: 240000 }, async () => {
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
    await page.goto(`http://localhost:${server.address().port}/#map=2/15/-20`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    const opened = () => page.evaluate(() => document.getElementById('timelinePanel').classList.contains('open'));
    const lit = () => page.$$eval('.lanecap.lit', (cs) => cs.map((c) => c.id));
    const box = (sel) => page.locator(sel).boundingBox();
    await page.click('#people');
    await page.waitForSelector('#peopleStrip [data-person]');
    await page.waitForSelector('#voyageList [data-voyage]');
    assert.equal(await opened(), true, 'the medallion did not open the timeline');
    assert.deepEqual([await page.getAttribute('#people', 'aria-expanded'), await page.getAttribute('#voyages', 'aria-expanded')], ['true', 'false']);
    assert.deepEqual(await lit(), ['peopleCap']);
    // the two lanes on either side of one axis
    const [people, axis, voyages] = [await box('#peopleStrip'), await box('#timeAxis'), await box('#voyageList')];
    assert.ok(people.y + people.height <= axis.y + 1 && voyages.y >= axis.y + axis.height - 1, 'the people are not above the axis and the voyages below it');
    // every voyage and every person, once each
    const root = fileURLToPath(new URL('..', import.meta.url));
    const index = JSON.parse(await readFile(path.join(root, 'data/voyages/index.json'), 'utf8'));
    const records = JSON.parse(await readFile(path.join(root, 'data/voyages/people.json'), 'utf8'));
    const persons = Object.entries(records).filter(([, p]) => p && typeof p === 'object').map(([id]) => id);
    const shownVoyages = await page.$$eval('#voyageList [data-voyage]', (bs) => bs.map((b) => b.dataset.voyage));
    const shownPeople = await page.$$eval('#peopleStrip [data-person]', (bs) => bs.map((b) => b.dataset.person));
    assert.deepEqual([...shownVoyages].sort(), [...index].sort(), 'a voyage missing or twice');
    assert.deepEqual([...shownPeople].sort(), [...persons].sort(), 'a person missing or twice');
    // the era bands run from the axis's left edge to its right, end to end, each named once
    // measured in one go, relative to the track, so a drawer still sliding in cannot skew them
    const measure = () => page.evaluate(() => {
      const t = document.getElementById('track').getBoundingClientRect();
      return { t: { x: 0, width: t.width }, bs: [...document.querySelectorAll('#eras .band')].map((b) => { const r = b.getBoundingClientRect(); return { name: b.dataset.era, left: r.left - t.left, right: r.right - t.left, label: b.textContent }; }) };
    });
    const track = async () => (await measure()).t;
    await page.waitForTimeout(400); // the drawer's slide
    let { t, bs } = await measure();
    assert.deepEqual(bs.map((b) => b.name), ['The ancient world', 'The medieval Indian Ocean and Asia', 'The age of discovery', 'The modern world']);
    assert.ok(bs.every((b) => b.label === b.name), 'a band not named once');
    assert.ok(Math.abs(bs[0].left - t.x) < 1 && Math.abs(bs.at(-1).right - (t.x + t.width)) < 1, 'the bands do not cover the axis');
    bs.forEach((b, i) => { if (i) assert.ok(Math.abs(b.left - bs[i - 1].right) < 1, `a gap before ${b.name}`); });
    // Earlier: the track half as wide again, the earlier stretch to the left with its windows and no entries, the main stretch unchanged in width
    const w0 = t.width, mainW = bs.at(-1).right - bs[0].left;
    await page.click('#earlier');
    ({ t, bs } = await measure());
    assert.equal(await page.getAttribute('#earlier', 'aria-pressed'), 'true');
    assert.ok(Math.abs(t.width - w0 * 1.5) < 1, `Earlier did not widen the axis: ${w0} -> ${t.width}`);
    assert.ok(Math.abs(bs.at(-1).right - bs[0].left - mainW) < 1, 'the main stretch changed width');
    assert.ok(bs[0].left - t.x > w0 * 0.49, 'no earlier stretch to the left of Lapita');
    assert.deepEqual(await page.$$eval('#eras .mark', (ms) => ms.map((m) => m.dataset.mark)), ['Sahul', 'Beringia', 'Clovis']);
    assert.ok((await page.textContent('#timeAxis')).includes('50,000 BC'));
    const firstEntry = Math.min(...await page.$$eval('#peopleStrip .bar, #voyageList .vbar', (es) => { const t = document.getElementById('track').getBoundingClientRect().left; return es.map((e) => e.getBoundingClientRect().left - t); }));
    assert.ok(firstEntry >= bs[0].left - 1, 'an entry on the earlier stretch');
    await page.click('#earlier');
    assert.ok(Math.abs((await track()).width - w0) < 1, 'Earlier again did not bring the axis back');
    // the dividers: the same drawer, at the voyages' lane; a second click shuts it
    await page.click('#voyages');
    assert.equal(await opened(), true, 'the dividers shut the timeline');
    assert.deepEqual([await page.getAttribute('#people', 'aria-expanded'), await page.getAttribute('#voyages', 'aria-expanded')], ['false', 'true']);
    assert.deepEqual(await lit(), ['voyagesCap']);
    const panel = await box('#timelinePanel'), axisNow = await box('#timeAxis');
    assert.ok(axisNow.y >= panel.y && axisNow.y < panel.y + 60, `the voyages' lane is not in view: axis at ${axisNow.y}, drawer at ${panel.y}`);
    await page.click('#voyages');
    assert.equal(await opened(), false, 'a second click on the dividers left the timeline open');
    // a phone: the timeline scrolls sideways, opened at its right end, where most of it is
    const phone = await (await browser.newContext({ viewport: { width: 412, height: 800 }, hasTouch: true, isMobile: true })).newPage();
    phone.on('pageerror', (e) => errors.push(e.message));
    await phone.goto(`http://localhost:${server.address().port}/#map=2/15/-20`);
    await phone.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    await phone.tap('#people');
    await phone.waitForSelector('#peopleStrip [data-person]');
    await phone.waitForSelector('#voyageList [data-voyage]');
    const sc = await phone.$eval('#timeScroll', (e) => ({ sw: e.scrollWidth, cw: e.clientWidth, left: e.scrollLeft }));
    assert.ok(sc.sw > sc.cw, `the phone's timeline does not scroll sideways: ${JSON.stringify(sc)}`);
    assert.ok(sc.left >= sc.sw - sc.cw - 1, `the phone's timeline did not open at its right end: ${JSON.stringify(sc)}`);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the page scrolls sideways');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('people: a picture on the map is looked at, put away and dealt back by choosing the person again; the last touched lies on top; its Commons link is a glyph', { skip, timeout: 240000 }, async () => {
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
    // two of Columbus's pictures laid apart on open sea, the first at the view's centre
    await page.goto(`http://localhost:${server.address().port}/#map=4/-50/-30&person=christopher-columbus&pictures=0,1&pictureat=0:-30,-50,0.015_1:-10,-50,0.015`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelectorAll('#pictureKeys li').length === 2, null, { timeout: 60000 });
    await page.waitForTimeout(1200); // dealt in
    const z = () => page.$$eval('#pictureKeys li', (ls) => Object.fromEntries(ls.map((l) => [l.dataset.pic, Number(l.dataset.z)])));
    const hash = () => page.evaluate(() => decodeURIComponent(location.hash));

    // the link to its page is the glyph alone, the sentence its label
    const link = await page.$eval('#pictureKeys [data-pic="0"] a', (a) => ({ text: a.textContent, label: a.getAttribute('aria-label'), title: a.title, href: a.href }));
    assert.deepEqual({ text: link.text, label: link.label, title: link.title }, { text: '⧉', label: 'Its page on Wikimedia Commons', title: 'Its page on Wikimedia Commons' });
    assert.match(link.href, /^https:\/\/commons\.wikimedia\.org\//);

    // the last touched lies on top: by the pointer, then by the keyboard's focus
    assert.deepEqual(await z(), { 0: 0, 1: 1 }, 'the record\'s order before any touch');
    const c = await page.locator('#map').boundingBox(), cx = c.x + c.width / 2, cy = c.y + c.height / 2;
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.up();
    assert.deepEqual(await z(), { 0: 1, 1: 0 }, 'the picture grabbed is not on top');
    await page.focus('#pictureKeys [data-pic="1"] a');
    assert.deepEqual(await z(), { 0: 0, 1: 1 }, 'the picture focused is not on top');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')?.startsWith('Look: ')), true, 'Look is not next in the keyboard\'s order');
    await page.evaluate(() => document.activeElement.blur());

    // Look, by the button on the first picture's edge (the only place the cursor is a magnifier), lays it upright in the
    // middle of the window, 0.85 of it at most and no more than its own pixels; Esc lays it back
    const looked = () => page.$eval('#pictureKeys [data-look="0"]', (b) => b.getAttribute('aria-pressed'));
    const zoomIn = await page.evaluate(({ x0, y0 }) => {
      const m = document.getElementById('map'), out = [];
      for (let y = y0; y < y0 + 400; y += 3) for (let x = x0; x < x0 + 400; x += 3) {
        m.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, isPrimary: true, bubbles: true }));
        if (m.style.cursor === 'zoom-in') out.push([x, y]);
      }
      return out;
    }, { x0: cx - 200, y0: cy - 200 });
    assert.ok(zoomIn.length, 'no Look button on the first picture');
    const look = () => page.mouse.click(zoomIn.reduce((s, p) => s + p[0], 0) / zoomIn.length, zoomIn.reduce((s, p) => s + p[1], 0) / zoomIn.length);
    await look();
    assert.equal(await looked(), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await looked(), 'false', 'Esc did not lay the picture back');
    // by the keyboard with the People drawer open, Esc lays the picture back and leaves the drawer open
    await page.click('#people');
    await page.evaluate(() => document.activeElement.blur()); // the drawer focused its first control; moving focus from there to the map is a focus outside, which shuts it
    await page.focus('#pictureKeys [data-look="0"]');
    await page.keyboard.press('Enter');
    assert.equal(await looked(), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await looked(), 'false');
    assert.equal(await page.$eval('#timelinePanel', (d) => d.classList.contains('open')), true, 'Esc shut the drawer too');
    await page.keyboard.press('Escape'); // and the next shuts it
    assert.equal(await page.$eval('#timelinePanel', (d) => d.classList.contains('open')), false);
    await page.evaluate(() => document.activeElement.blur());
    await look();
    // looked at, its buttons from the right corner of its lower edge: Put away, Turn over, the link (13 CSS px round)
    const [iw, ih] = await page.evaluate(async () => { const m = (await (await fetch('packs/overlays/people/people.json')).json()).pictures['Portrait_of_a_Man,_Said_to_be_Christopher_Columbus_2.jpg']; return [m.width, m.height]; });
    const k = Math.min((c.width * 0.85) / iw, (Math.min(740, c.y + c.height) - Math.max(0, c.y)) * 0.85 / ih, 1), my = (Math.max(0, c.y) + Math.min(740, c.y + c.height)) / 2;
    await page.mouse.click(cx + (iw * k) / 2 - 13 * 0.4, my + (ih * k) / 2);
    await page.waitForFunction(() => document.querySelectorAll('#pictureKeys li').length === 1, null, { timeout: 10000 });
    assert.match(await hash(), /pictures=1(&|$)/, 'put away, the picture is still in the link');
    // the other by the keyboard
    await page.focus('#pictureKeys [data-away="1"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('#pictureKeys li').length === 0, null, { timeout: 10000 });
    assert.match(await hash(), /pictures=none(&|$)/);

    // choosing the person again (a click lets them go, the next chooses them) deals every picture back
    await page.click('#people');
    await page.click('[data-person="christopher-columbus"]');
    assert.doesNotMatch(await hash(), /person=/);
    await page.click('[data-person="christopher-columbus"]');
    await page.waitForFunction(() => document.querySelector('#pictureKeys [data-pic="0"]') && document.querySelector('#pictureKeys [data-pic="1"]'), null, { timeout: 60000 });
    assert.doesNotMatch(await hash(), /pictures=/);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
