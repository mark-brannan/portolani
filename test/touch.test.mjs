// The page under touch, in headless Chromium with touch emulation at the two common phone widths
// (360 and 412 px): a two-finger pinch zooms the map about the pinch centre and not the page, anywhere in
// the window, one finger drags, the astrolabe's drawer opens on a tap and stays up on a choice, Go stays up on a
// tap on the map and shuts on a second tap on its compass, and its Find my position button fills in the fix and
// flies there without bringing up the keyboard, Go still up (the user, 2026-10-30). Under 520 px the map fills the window, cropped at its
// sides; the settings are a bottom sheet at half the window's height with the map above it, a lighter
// drawer a sheet as tall as its lines over the map's foot, and the cartouche and the scale bar sit on cards. With a mouse on a wide screen
// each of the seven drawers hangs below the row without covering or moving it, one at a time; several voyages
// are drawn at once, each in its own ink, and the link carries them. With the hover chips on, a mouse resting on a grouped
// list's shut heading opens its section after the dwell; off (hover=0 in the link), only a click does; a phone has no chips.
// A person's card on the map is grabbed by its frame and looked at by a click or a tap on its body, put away by the
// pointer or the keyboard, taken off by Pulverum and dealt back by choosing the person again; two fingers twisted on the
// map turn the world; a flight deals only once the map is there.
//
// Needs the built preview (`npm run build:preview` -> _site/), playwright-core and a Chromium
// (`npx playwright-core install chromium-headless-shell`); without them it skips, since `npm test`
// runs offline. CI sets TOUCH_REQUIRED=1 so that a skip there is a failure. TOUCH_SHOTS=<dir> also
// writes a screenshot per width.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
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

      // the astrolabe's drawer: shut, opened by a tap on the astrolabe, still up after a choice (the second line, The world)
      assert.equal(await shown('sightsPanel'), false);
      await page.tap('#sights');
      assert.equal(await shown('sightsPanel'), true);
      assert.equal(await page.getAttribute('#sights', 'aria-expanded'), 'true');
      const h3 = await hash();
      await page.tap('#sightsList button >> nth=1');
      assert.equal(await shown('sightsPanel'), true, 'a choice shut the drawer');
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

      // its controls are the same chips; the astrolabe swaps it for the locations, the same sheet at the foot
      assert.ok(await page.locator('#drawer .chip').count() > 10);
      await page.tap('#sights');
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('drawer')).visibility), 'hidden', 'the astrolabe left the settings open');
      const light = await box('#sightsPanel');
      assert.ok(light.height <= height / 2 + 2 && Math.abs(light.width - width) <= 1 && Math.abs(light.y + light.height - height) <= 1, JSON.stringify(light));
      map = await box('#map');
      assert.ok(map.y <= 0 && map.y + map.height >= height, `the map does not stay full behind the locations: ${JSON.stringify(map)}`);

      // a second tap on the astrolabe shuts the sheet, and the map has the window again
      await page.tap('#sights');
      await page.waitForTimeout(400);
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('sightsPanel')).visibility), 'hidden');
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
    for (const [b, d] of [['#open', 'drawer'], ['#go', 'goPanel'], ['#sights', 'sightsPanel'], ['#voyages', 'voyagesPanel'], ['#people', 'peoplePanel'], ['#charts', 'chartsDrawer']]) {
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
    await page.click('#charts');
    assert.equal(await opened('chartsDrawer'), false, 'a second click left the charts open');

    await page.click('#voyages');
    assert.equal(await opened('voyagesPanel'), true);
    await page.mouse.click(200, 400);
    assert.equal(await opened('voyagesPanel'), false, 'a click on the map left the timeline open');
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
    // rises, and with its rows cut short here the next heading comes to rest under the pointer; a nudge opens nothing.
    // Goa's tile, at the drawer's foot, is put by for this so the headings it would cover stay in reach, however many pictures it has
    const pointer = await page.evaluate(() => {
      document.getElementById('sightCard').hidden = true;
      const [, anc, med, aod] = [...document.querySelectorAll('#sightsList .group')], fold = (g) => g.querySelector(':scope > .fold').getBoundingClientRect();
      const m = fold(med), y = m.top + m.height / 2, rise = anc.querySelector(':scope > .rows').getBoundingClientRect().height;
      // after the slide the pointer sits (y - m.top + rise) below the medieval heading's top; put the next heading's middle there
      med.querySelector('.places').style.cssText = `height:${y - m.top + rise - m.height - fold(aod).height / 2 - 6}px;overflow:hidden`;
      return { x: m.left + 40, y };
    });
    await page.mouse.move(pointer.x, pointer.y);
    await page.waitForTimeout(700);
    assert.deepEqual(await openGroups(), ['The medieval Indian Ocean and Asia'], 'resting on the second heading did not open it');
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.fold')?.firstChild.textContent, pointer), "Mali's trade network", 'the slide did not bring the next heading under the pointer');
    await page.mouse.move(pointer.x + 1, pointer.y);
    await page.waitForTimeout(700);
    assert.deepEqual(await openGroups(), ['The medieval Indian Ocean and Asia'], 'a heading the slide brought under the pointer opened on a nudge');
    await page.evaluate(() => { document.querySelectorAll('#sightsList .group')[2].querySelector('.places').style.cssText = ''; document.getElementById('sightCard').hidden = false; });
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
    // a chart is a row: its thumbnail is its scan, and it lays the sheet and flies to its frame, the drawer left open
    await page.click('#charts');
    const map0 = await page.evaluate(() => new URLSearchParams(location.hash.slice(1)).get('map'));
    const vesconte = page.locator('#chartList .chart', { hasText: 'Vesconte' }), thumb = vesconte.locator('.thumb');
    assert.equal(await thumb.evaluate((b) => b.classList.contains('none')), false, 'Vesconte has no scan thumbnail');
    await thumb.click();
    assert.equal(await opened('chartsDrawer'), true, "a chart's frame shut its drawer");
    await page.waitForFunction(() => /[#&]overlay=vesconte-1313(&|$)/.test(location.hash), null, { timeout: 60000 });
    await page.waitForFunction((m) => new URLSearchParams(location.hash.slice(1)).get('map') !== m, map0, { timeout: 60000 });
    const [, lat, lon] = (await page.evaluate(() => location.hash)).replace('#map=', '').split('&')[0].split('/').map(Number);
    assert.ok(Math.abs(lat - 37.4) < 1.5 && Math.abs(lon - 13.3) < 1.5, `Vesconte's sheet is not framed on Italy's shore: ${lat}, ${lon}`);
    // its eye takes the sheet off again and leaves the drawer open
    await vesconte.locator('.eye').click();
    await page.waitForFunction(() => !/[#&]overlay=/.test(location.hash), null, { timeout: 60000 });
    assert.equal(await opened('chartsDrawer'), true, 'the eye shut the drawer');
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

test('voyages: several drawn at once, each in its own ink, carried by the link; the eye shows or hides one, the name shows it alone and draws it on every time; an older single voyage= link opens; the skull empties the list, the drawer open and no Clear of its own', { skip, timeout: 240000 }, async () => {
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
    assert.equal(await page.$eval('#voyagesPanel', (d) => d.classList.contains('open')), true, 'a choice shut the drawer');
    assert.deepEqual(await on(), ['columbus', 'magellan', 'drake']); // the list's order
    assert.equal(new Set(await inks()).size, 3, 'two voyages share an ink');
    assert.match(await hash(), /voyages=magellan\.[0-9a-f]{6},columbus\.[0-9a-f]{6},drake\.[0-9a-f]{6}(&|$)/);
    await page.waitForTimeout(400);
    assert.equal(await viewNow(), where, 'the eye moved the view');
    assert.equal(await page.evaluate(() => window.drew), false, 'the eye set the pen going');
    const before = await inkOf();
    await page.click('#voyageList [data-eye="magellan"]');
    assert.deepEqual(await on(), ['columbus', 'drake'], 'the eye did not hide it');
    assert.match(await hash(), /voyages=magellan\.[0-9a-f]{6}~,columbus\.[0-9a-f]{6},drake\.[0-9a-f]{6}(&|$)/);
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
    assert.match(await hash(), /voyages=magellan\.[0-9a-f]{6},columbus\.[0-9a-f]{6}~,drake\.[0-9a-f]{6}~(&|$)/);
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
    assert.match(await hash(), /voyages=magellan\.[0-9a-f]{6},columbus\.[0-9a-f]{6},drake:16727a/);
    await page.click('#voyageWidth [data-value="2.2"]');
    assert.match(await hash(), /voyagewidth=2.2/);
    if (!(await page.$eval('#voyagesPanel', (d) => d.classList.contains('open')))) await page.click('#voyages');
    assert.equal(await page.locator('#voyagesPanel .tool').count(), 0, 'the Voyages drawer has a Clear of its own: the skull is the one clear');
    const mapOf = (h) => new URLSearchParams(h.slice(1)).get('map'), was = mapOf(await hash());
    // a chart's sheet laid too (its eye, as the page's own handler takes it): the skull must lift it, and throw nothing doing so
    await page.waitForFunction(() => !document.querySelector('#chartList [data-overlay="carta-marina"] .eye')?.hidden);
    await page.$eval('#chartList [data-overlay="carta-marina"] .eye', (b) => b.click());
    await page.waitForFunction(() => /overlay=carta-marina/.test(location.hash));
    await page.click('#sweep');
    await page.waitForFunction(() => !/overlay=|sheet=/.test(location.hash), null, { timeout: 60000 });
    assert.deepEqual(await on(), []);
    assert.doesNotMatch(await hash(), /overlay=|sheet=/, 'the skull left a chart on the map');
    assert.equal(mapOf(await hash()), was, 'the skull moved the map');
    assert.doesNotMatch(await hash(), /voyages=/);
    assert.match(await hash(), /voyagewidth=2.2/, 'the skull cleared a setting');
    assert.equal(await page.$eval('#voyagesPanel', (d) => d.classList.contains('open')), true, 'the skull shut the drawer');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('people and voyages: two vertical drawers no wider than the charts, earliest first under era headings; a chosen person\'s tile and their voyages sit directly under their row; a people has a row', { skip, timeout: 240000 }, async () => {
  const server = createServer(async (req, res) => {
    let p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p.endsWith('/')) p = path.join(p, 'index.html');
    try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); } catch { res.writeHead(404).end(); }
  }).listen(0);
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/#map=2/15/-20`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    const opened = (id) => page.evaluate((i) => document.getElementById(i).classList.contains('open'), id);
    const box = (sel) => page.locator(sel).boundingBox();
    const hash = () => page.evaluate(() => decodeURIComponent(location.hash));
    const noSideScroll = (id) => page.evaluate((i) => { const d = document.getElementById(i); return d.scrollWidth <= d.clientWidth + 1; }, id);
    // the Charts drawer's width is the bar
    await page.click('#charts');
    await page.waitForTimeout(400);
    const charts = await box('#chartsDrawer');
    // the medallion opens the People drawer alone, no wider than the charts, every person once, earliest first
    await page.click('#people');
    await page.waitForSelector('#peopleList [data-person]');
    await page.waitForTimeout(400); // the slide
    assert.equal(await opened('peoplePanel'), true, 'the medallion did not open the People drawer');
    assert.equal(await opened('voyagesPanel'), false, 'the Voyages drawer opened with the people');
    assert.deepEqual([await page.getAttribute('#people', 'aria-expanded'), await page.getAttribute('#voyages', 'aria-expanded')], ['true', 'false']);
    const peoplePanel = await box('#peoplePanel');
    assert.ok(peoplePanel.width <= charts.width + 1 && peoplePanel.width <= 480, `the People drawer is wider than the charts: ${peoplePanel.width} > ${charts.width}`);
    assert.equal(await noSideScroll('peoplePanel'), true, 'the People drawer scrolls sideways');
    const root = fileURLToPath(new URL('..', import.meta.url));
    const index = JSON.parse(await readFile(path.join(root, 'data/voyages/index.json'), 'utf8'));
    const records = JSON.parse(await readFile(path.join(root, 'data/voyages/people.json'), 'utf8'));
    const persons = Object.entries(records).filter(([, p]) => p && typeof p === 'object').map(([id]) => id);
    const shownPeople = await page.$$eval('#peopleList [data-person]', (bs) => bs.map((b) => b.dataset.person));
    assert.deepEqual([...shownPeople].sort(), [...persons].sort(), 'a person missing or twice');
    assert.equal(shownPeople[0], 'lapita-people', 'the Lapita people, 1500 BC, are not the first row');
    assert.ok(shownPeople.indexOf('east-polynesian-voyagers') > shownPeople.indexOf('leif-erikson') && shownPeople.indexOf('east-polynesian-voyagers') < shownPeople.indexOf('marco-polo'), 'the East Polynesian voyagers are out of order');
    assert.ok(shownPeople.indexOf('pytheas') < shownPeople.indexOf('ibn-battuta') && shownPeople.indexOf('ibn-battuta') < shownPeople.indexOf('christopher-columbus'), 'not earliest first');
    assert.deepEqual(await page.$$eval('#peopleList .era', (es) => es.map((e) => e.dataset.era)), ['The ancient world', 'The medieval Indian Ocean and Asia', 'The age of discovery'], 'the era headings');
    assert.ok(await page.$eval('#peopleList [data-person="lapita-people"]', (b) => b.querySelector('.chip')?.textContent === 'a people' && /1500–800 BC/.test(b.textContent)), 'the Lapita row lacks its chip or its BC years');
    assert.ok(await page.$eval('#peopleList [data-person="ibn-battuta"]', (b) => /1304/.test(b.textContent) && !b.querySelector('.chip')), 'Ibn Battuta\'s row lacks his years or has a chip');
    assert.equal(await page.$eval('#peopleList .era', (e) => getComputedStyle(e).fontStyle), 'italic');
    // the rows read top to bottom, one under the other, each the drawer's width
    const rows = await page.$$eval('#peopleList [data-person]', (bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return [r.top, r.left, r.width]; }));
    rows.forEach(([top], i) => { if (i) assert.ok(top > rows[i - 1][0], 'a row not below the one before'); });
    assert.ok(rows.every(([, left, width]) => Math.abs(left - rows[0][1]) < 1 && width > 300), 'the rows are not one column');
    // Ibn Battuta chosen: his row lit, his tile slid open directly under it, his nine voyages inside with eyes and play, all drawn
    await page.click('#peopleList [data-person="ibn-battuta"]');
    await page.waitForTimeout(400);
    assert.match(await hash(), /person=ibn-battuta/);
    assert.equal(await page.getAttribute('#peopleList [data-person="ibn-battuta"]', 'aria-pressed'), 'true');
    assert.deepEqual(await page.$$eval('#peopleList li.open', (ls) => ls.map((l) => l.dataset.row)), ['ibn-battuta'], 'not exactly his row open');
    assert.equal(await page.$eval('#personCard', (c) => c.closest('li[data-row]')?.dataset.row), 'ibn-battuta', 'the tile is not in his row');
    const [row, card, next] = await page.evaluate(() => {
      const li = document.querySelector('#peopleList li[data-row="ibn-battuta"]'), card = document.getElementById('personCard');
      let after = li.nextElementSibling; while (after && !after.dataset.row) after = after.nextElementSibling; // past an era heading
      return [li.querySelector('[data-person]').getBoundingClientRect().toJSON(), card.getBoundingClientRect().toJSON(), after?.getBoundingClientRect().toJSON()];
    });
    assert.ok(card.top >= row.bottom - 1 && card.height > 100, `the tile is not under his row: row ends ${row.bottom}, tile at ${card.top}`);
    assert.ok(next && next.top >= card.bottom - 1, 'the next person is not below his tile');
    const ib = index.filter((id) => JSON.parse(readFileSync(path.join(root, `data/voyages/${id}.json`), 'utf8')).who.includes('ibn-battuta'));
    assert.deepEqual(await page.$$eval('#personCard .pvoyages li[data-row]', (ls) => ls.map((l) => l.dataset.row)), ib, 'his voyages, in the index\'s order');
    assert.equal(ib.length, 9);
    assert.ok(await page.$eval('#personCard .bio', (b) => b.textContent.length > 40), 'no notes in the tile');
    assert.ok(await page.$$eval('#personCard .pvoyages li', (ls) => ls.every((l) => l.querySelector('[data-eye]') && l.querySelector('[data-play]') && l.querySelector('.vsum').textContent.length > 20 && l.querySelector('.vsum a'))), 'a voyage row without its eye, play, summary or link');
    assert.ok(await page.$$eval('#personCard [data-eye]', (es) => es.every((e) => e.getAttribute('aria-pressed') === 'true')), 'his voyages are drawn, so their eyes read on');
    assert.equal(await noSideScroll('peoplePanel'), true, 'the tile made the drawer scroll sideways');
    // the eye in his tile puts that one voyage off, and the drawer stays open; the hash carries it hidden
    await page.click('#personCard [data-eye="ibn-battuta-3"]');
    assert.equal(await page.getAttribute('#personCard [data-eye="ibn-battuta-3"]', 'aria-pressed'), 'false');
    assert.match(await hash(), /voyages=ibn-battuta-3(\.[0-9a-f]{6})?~/);
    assert.match(await hash(), /person=ibn-battuta/, 'the eye let the person go');
    assert.equal(await opened('peoplePanel'), true);
    // the eye back on leaves nothing behind: letting him go takes the voyage off with him
    await page.click('#personCard [data-eye="ibn-battuta-3"]');
    assert.equal(await page.getAttribute('#personCard [data-eye="ibn-battuta-3"]', 'aria-pressed'), 'true');
    assert.doesNotMatch(await hash(), /voyages=/, 'the eye back on left the voyage chosen');
    await page.click('#peopleList [data-person="ibn-battuta"]');
    assert.doesNotMatch(await hash(), /voyages=|person=/, 'letting him go left a voyage of his chosen');
    await page.click('#peopleList [data-person="ibn-battuta"]');
    // the people and the voyages carry their spans as bars, on each era's scale under its ruler
    assert.ok(await page.$$eval('#peopleList .era', (es) => es.every((e) => e.querySelector('.ruler span'))), 'an era heading without its ruler');
    assert.ok(await page.$eval('#peopleList [data-person="ibn-battuta"] .bar', (b) => b.getBoundingClientRect().width > 8), 'Ibn Battuta\'s life bar is missing or a sliver');
    // another person chosen: his tile shuts, theirs opens under their own row
    await page.click('#peopleList [data-person="lapita-people"]');
    await page.waitForTimeout(400);
    assert.deepEqual(await page.$$eval('#peopleList li.open', (ls) => ls.map((l) => l.dataset.row)), ['lapita-people']);
    assert.equal(await page.$eval('#personCard', (c) => c.closest('li[data-row]')?.dataset.row), 'lapita-people');
    assert.deepEqual(await page.$$eval('#personCard .pvoyages li[data-row]', (ls) => ls.map((l) => l.dataset.row)), ['lapita-expansion']);
    assert.match(await hash(), /person=lapita-people/);
    // the dividers swap it for the Voyages drawer: as wide, every voyage once, earliest first under the same headings, nothing sideways
    await page.click('#voyages');
    await page.waitForSelector('#voyageList [data-voyage]');
    await page.waitForTimeout(400);
    assert.equal(await opened('voyagesPanel'), true, 'the dividers did not open the Voyages drawer');
    assert.equal(await opened('peoplePanel'), false, 'the People drawer stayed open with the voyages');
    assert.deepEqual([await page.getAttribute('#people', 'aria-expanded'), await page.getAttribute('#voyages', 'aria-expanded')], ['false', 'true']);
    const voyagesPanel = await box('#voyagesPanel');
    assert.ok(voyagesPanel.width <= charts.width + 1 && voyagesPanel.width <= 480, `the Voyages drawer is wider than the charts: ${voyagesPanel.width}`);
    assert.equal(await noSideScroll('voyagesPanel'), true, 'the Voyages drawer scrolls sideways');
    const shownVoyages = await page.$$eval('#voyageList [data-voyage]', (bs) => bs.map((b) => b.dataset.voyage));
    assert.deepEqual([...shownVoyages].sort(), [...index].sort(), 'a voyage missing or twice');
    assert.equal(shownVoyages[0], 'lapita-expansion');
    assert.deepEqual(await page.$$eval('#voyageList .era', (es) => es.map((e) => e.dataset.era)), ['The ancient world', 'The medieval Indian Ocean and Asia', 'The age of discovery']);
    assert.ok(await page.$$eval('#voyageList li[data-row]', (ls) => ls.every((l) => l.querySelector('[data-eye]') && l.querySelector('[data-play]') && l.querySelector('[data-ink]') && l.querySelector('path'))), 'a voyage row without its eye, play, swatch or line sample');
    const tools = await box('#voyagesPanel .vtools'), list = await box('#voyageList');
    assert.ok(tools.y + tools.height <= list.y + 1, 'the tools do not head the list');
    assert.equal(await page.$$eval('#voyageWidth [role=radio], #voyageWidth button', (cs) => cs.length > 0), true, 'no line-weight chips');
    await page.click('#voyages');
    assert.equal(await opened('voyagesPanel'), false, 'a second click on the dividers left the voyages open');
    // a phone: each a bottom sheet, the page never scrolling sideways, the Lapita row there
    const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })).newPage();
    phone.on('pageerror', (e) => errors.push(e.message));
    await phone.goto(`http://localhost:${server.address().port}/#map=2/15/-20`);
    await phone.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    await phone.tap('#people');
    await phone.waitForSelector('#peopleList [data-person="lapita-people"]');
    await phone.waitForTimeout(400);
    const sheet = await phone.locator('#peoplePanel').boundingBox();
    assert.ok(sheet.width <= 390 && sheet.y + sheet.height >= 844 - 1, `the People drawer is not a bottom sheet: ${JSON.stringify(sheet)}`);
    assert.equal(await phone.evaluate(() => { const d = document.getElementById('peoplePanel'); return d.scrollWidth <= d.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth; }), true, 'the phone scrolls sideways');
    await phone.tap('#voyages');
    await phone.waitForSelector('#voyageList [data-voyage]');
    assert.equal(await phone.evaluate(() => { const d = document.getElementById('voyagesPanel'); return d.classList.contains('open') && d.scrollWidth <= d.clientWidth + 1; }), true, 'the Voyages sheet scrolls sideways');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

// A card on the table (docs/spec/design.md, "A card on the table: a click looks, three buttons, Pulverum"): dealt, it
// carries no controls; its frame grabs it without looking, its body looks; looked at, it is a hand that drags it and
// the map together, the wheel zooms both, and off it no hand; Esc sends it home and it stays dealt; Pulverum, the third
// button right of the card, takes it off the table; choosing the person again deals it back. And a flight deals only once the map's middle has reached the place (docs/spec/design.md, "the map is there
// before the deal").
const serve = () => createServer(async (req, res) => {
  let p = path.join(site, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (p.endsWith('/')) p = path.join(p, 'index.html');
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }).end(await readFile(p)); } catch { res.writeHead(404).end(); }
}).listen(0);
const COLUMBUS = '#map=4/-50/-30&person=christopher-columbus&pictures=0,1&pictureat=0:-30,-50,0.015_1:-10,-50,0.015'; // two of his pictures apart on open sea, the first at the view's centre
const mapOf = (h) => /map=([^&]+)/.exec(h)?.[1].split('/').map(Number).join('/'); // as numbers: the page rewrites 4 as 4.00
// the cursor a pointer resting at (x, y) on the map finds, as a press there would find what lies under it
const cursorAt = (page, x, y) => page.evaluate(({ x, y }) => { const m = document.getElementById('map'); m.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, isPrimary: true, bubbles: true })); return m.style.cursor; }, { x, y });
// from the middle rightward, where the first card's body ends and its frame's band ends
async function frameOf(page, cx, cy) {
  let body = null, frame = null;
  for (let x = cx; x < cx + 400; x += 2) {
    const c = await cursorAt(page, x, cy);
    if (c === 'zoom-in') body = x; else if (c === 'grab') frame = x; else if (body != null) break;
  }
  return { body, frame };
}

test('people: a dealt card carries no controls; its frame grabs it, its body looks; looked at, a drag or the wheel moves it with the map; Esc sends it home, Pulverum takes it off; the deal waits for the map', { skip, timeout: 240000 }, async () => {
  const server = serve();
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 740 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/${COLUMBUS}`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelectorAll('#pictureKeys li').length === 2, null, { timeout: 60000 });
    await page.waitForTimeout(1200); // dealt in
    const z = () => page.$$eval('#pictureKeys li', (ls) => Object.fromEntries(ls.map((l) => [l.dataset.pic, Number(l.dataset.z)])));
    const hash = () => page.evaluate(() => decodeURIComponent(location.hash));
    const looked = () => page.$eval('#pictureKeys [data-look="0"]', (b) => b.getAttribute('aria-pressed'));
    const c = await page.locator('#map').boundingBox(), cx = c.x + c.width / 2, cy = c.y + c.height / 2;

    // the body under the pointer is a magnifier, the frame round it a hand, a band wider than the drawn margin
    const { body, frame } = await frameOf(page, cx, cy);
    assert.ok(body != null && frame != null && frame - body >= 8, `no body then frame across the card: ${JSON.stringify({ body, frame })}`);

    // a drag from the frame raises the card and moves it, without looking; the map stays
    assert.deepEqual(await z(), { 0: 0, 1: 1 }, 'the record\'s order before any touch');
    const before = await hash();
    await page.mouse.move(frame - 2, cy); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(frame - 2 - i * 10, cy + i * 5);
    await page.mouse.up();
    await page.waitForFunction((h) => location.hash !== h, before, { timeout: 10000 });
    assert.deepEqual(await z(), { 0: 1, 1: 0 }, 'the card dragged by its frame is not on top');
    assert.equal(await looked(), 'false', 'a drag from the frame looked at the card');
    assert.equal(mapOf(await hash()), mapOf(before), 'a drag from the frame moved the map');
    assert.notEqual(/pictureat=([^&]+)/.exec(await hash())[1], /pictureat=([^&]+)/.exec(before)[1], 'the card did not move');

    // a click on the body looks; over it the pointer is a hand, off it not; a drag on it pans the map with it, the wheel
    // zooms both (design.md, "the looked-at card is held where it can be dragged"); Esc puts it away, still dealt
    const { body: body2 } = await frameOf(page, cx - 60, cy + 30);
    await page.mouse.click(body2 - 30, cy + 30);
    await page.waitForFunction(() => document.querySelector('#pictureKeys [data-look="0"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 5000 });
    await page.waitForTimeout(500);
    assert.equal(await cursorAt(page, cx, cy), 'grab', 'no hand over the card looked at');
    assert.equal(await cursorAt(page, c.x + 4, c.y + c.height - 4), 'default', 'a hand off the card looked at, where a press only puts it away');
    const still = await hash();
    await page.mouse.move(cx, cy); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(cx + i * 10, cy);
    await page.mouse.up();
    await page.waitForFunction((h) => location.hash !== h, still, { timeout: 10000 });
    assert.notEqual(mapOf(await hash()), mapOf(still), 'a drag on the card looked at left the map still');
    assert.equal(await looked(), 'true', 'a drag on the card looked at put it away');
    const dragged = await hash();
    await page.mouse.move(cx, cy); await page.mouse.wheel(0, -300); await page.mouse.wheel(0, -300);
    await page.waitForTimeout(600);
    assert.ok(Number(mapOf(await hash()).split('/')[0]) > Number(mapOf(dragged).split('/')[0]), 'the wheel on a card looked at left the map\'s zoom');
    await page.keyboard.press('Escape');
    assert.equal(await looked(), 'false', 'Esc did not put the card away');
    assert.equal(await page.$$eval('#pictureKeys li', (ls) => ls.length), 2, 'put away, the card left the table');

    // by the keyboard with the People drawer open, Esc puts the card away and leaves the drawer open
    await page.click('#people');
    await page.evaluate(() => document.activeElement.blur()); // moving focus from the drawer to the map is a focus outside, which shuts it
    await page.focus('#pictureKeys [data-look="0"]');
    await page.keyboard.press('Enter');
    assert.equal(await looked(), 'true');
    await page.keyboard.press('Escape');
    assert.equal(await looked(), 'false');
    assert.equal(await page.$eval('#peoplePanel', (d) => d.classList.contains('open')), true, 'Esc shut the drawer too');
    await page.keyboard.press('Escape'); // and the next shuts it
    await page.evaluate(() => document.activeElement.blur());

    // looked at, Pulverum is the lowest of three round buttons just right of the card; it takes that card alone off the
    // table, and a click on the person deals it back
    await page.focus('#pictureKeys [data-look="0"]'); await page.keyboard.press('Enter'); await page.evaluate(() => document.activeElement.blur());
    const [iw, ih] = await page.evaluate(async () => { const m = (await (await fetch('packs/overlays/people/people.json')).json()).pictures['Portrait_of_a_Man,_Said_to_be_Christopher_Columbus_2.jpg']; return [m.width, m.height]; });
    const x0 = Math.max(0, c.x), x1 = Math.min(1100, c.x + c.width), y0 = Math.max(0, c.y), y1 = Math.min(740, c.y + c.height); // the map in the window
    const ww = x1 - x0, k = Math.min(Math.min(0.75 * ww, ww - 2 * (5 + 15 * 2.7 + 110)) / iw, (0.85 * (y1 - y0)) / ih, Math.max(iw, ih) >= 400 ? Infinity : 2);
    const dust = { x: (x0 + x1) / 2 + (iw * k) / 2 + 5 + 15 * 1.4, y: (y0 + y1) / 2 + (ih * k) / 2 - 15 * 1.5 };
    await page.waitForFunction(({ x, y }) => { const m = document.getElementById('map'); m.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, isPrimary: true, bubbles: true })); return m.style.cursor === 'pointer'; }, dust, { timeout: 10000, polling: 100 });
    await page.mouse.click(dust.x, dust.y);
    await page.waitForFunction(() => document.querySelectorAll('#pictureKeys li').length === 1, null, { timeout: 10000 });
    assert.match(await hash(), /pictures=1(&|$)/);
    assert.equal(await page.$('#pictureKeys [data-away]'), null, 'a Put away button is left');
    await page.click('#people');
    await page.click('#peopleList [data-person="christopher-columbus"]');
    await page.waitForFunction(() => document.querySelector('#pictureKeys [data-pic="0"]') && document.querySelector('#pictureKeys [data-pic="1"]'), null, { timeout: 60000 });
    assert.match(await hash(), /person=christopher-columbus/, 'the click let the person go');

    // the map is there before the deal: a flight across the world deals once the window's middle is at the place
    await page.click('#peopleList [data-person="zheng-he"]');
    await page.evaluate(() => { window.dealtAt = null; const look = () => { if (document.querySelectorAll('#pictureKeys li').length) window.dealtAt = location.hash; else requestAnimationFrame(look); }; requestAnimationFrame(look); });
    await page.waitForFunction(() => window.dealtAt, null, { timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 60000 });
    const [, dlat, dlon] = mapOf(await page.evaluate(() => window.dealtAt)).split('/').map(Number), [, lat, lon] = mapOf(await hash()).split('/').map(Number);
    assert.ok(Math.abs(dlat - lat) < 0.5 && Math.abs(dlon - lon) < 0.5, `dealt before the map reached the place: ${dlat},${dlon} for ${lat},${lon}`);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

test('phone: a tap looks, a pinch on the card zooms the map with it; a finger drags a card by its frame; two fingers twisted turn the world; the compass tapped sets north up and dragged turns it; the lip shuts a drawer', { skip, timeout: 240000 }, async () => {
  const server = serve();
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${server.address().port}/${COLUMBUS}`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    await page.waitForFunction(() => document.querySelectorAll('#pictureKeys li').length === 2, null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    const cdp = await ctx.newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
    const hash = () => page.evaluate(() => decodeURIComponent(location.hash));
    const looked = () => page.$eval('#pictureKeys [data-look="0"]', (b) => b.getAttribute('aria-pressed'));
    const cx = 195, cy = 370; // the window's middle, where the first card lies

    // a finger on the frame's band (wider than the drawn margin, for a finger) drags the card without looking
    const { body, frame } = await frameOf(page, cx, cy);
    assert.ok(body != null && frame != null && frame - body >= 14, `the frame's band is too narrow for a finger: ${JSON.stringify({ body, frame })}`);
    const before = await hash();
    await touch('touchStart', [[frame - 2, cy]]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[frame - 2, cy - i * 12]]);
    await touch('touchEnd', []);
    await page.waitForFunction((h) => location.hash !== h, before, { timeout: 10000 });
    assert.equal(await looked(), 'false', 'a drag from the frame looked at the card');
    assert.equal(mapOf(await hash()), mapOf(before), 'a drag from the frame moved the map');

    // a tap on the body looks; a pinch on the card looked at zooms the map with it about the same point (design.md, "on a phone, a pinch zooms the card and the map together")
    await page.touchscreen.tap(cx - 20, cy - 60);
    await page.waitForFunction(() => document.querySelector('#pictureKeys [data-look="0"]')?.getAttribute('aria-pressed') === 'true', null, { timeout: 5000 });
    const still = await hash();
    await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - 30 - i * 8, cy + i * 3], [cx + 30 + i * 8, cy - i * 3]]);
    await touch('touchEnd', []);
    await page.waitForTimeout(600);
    const [z0] = mapOf(still).split('/').map(Number), [z1] = mapOf(await hash()).split('/').map(Number);
    assert.ok(z1 > z0, `a pinch out on the card looked at left the map at zoom ${z1} (was ${z0})`);
    assert.doesNotMatch(await hash(), /bearing=/, 'a twist on the card turned the map');
    await page.keyboard.press('Escape');
    assert.equal(await looked(), 'false');
    await page.waitForTimeout(600); // flown home, off the open map the twist is on

    // two fingers twisted a quarter clockwise on open map turn the world a quarter clockwise, bearing 270
    const h0 = await hash(), [mx, my] = [195, 560]; // below the card, which the pinch left lying larger
    await touch('touchStart', [[mx - 50, my], [mx + 50, my]]);
    for (let i = 1; i <= 15; i++) { const a = (i / 15) * (Math.PI / 2); await touch('touchMove', [[mx - 50 * Math.cos(a), my - 50 * Math.sin(a)], [mx + 50 * Math.cos(a), my + 50 * Math.sin(a)]]); }
    await touch('touchEnd', []);
    await page.waitForFunction((h) => location.hash !== h && /bearing=/.test(location.hash), h0, { timeout: 10000 });
    const bearing = Number(/bearing=([^&]+)/.exec(await hash())[1]);
    assert.ok(Math.abs(bearing - 270) < 3, `twisted a quarter clockwise, bearing ${bearing}`);
    assert.equal(await page.$eval('#walkLeft', (b) => getComputedStyle(b).display), 'none', 'a phone shows the walk-around buttons');
    await page.tap('#compass');
    await page.waitForFunction(() => !/bearing=/.test(location.hash), null, { timeout: 10000 });
    // a finger dragged round the compass turns the world, as a mouse does on a wide screen (design.md, the compass)
    const c = await page.$eval('#compass', (b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await touch('touchStart', [[c[0], c[1] - 18]]);
    for (let i = 1; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); await touch('touchMove', [[c[0] + 18 * Math.cos(a), c[1] + 18 * Math.sin(a)]]); }
    await touch('touchEnd', []);
    await page.waitForFunction(() => /bearing=/.test(location.hash), null, { timeout: 10000 });
    // the lip on a drawer's edge shuts it (design.md, "a lip on every drawer shuts it")
    await page.tap('#sights');
    await page.waitForFunction(() => document.getElementById('sightsPanel').classList.contains('open'));
    await page.waitForTimeout(400);
    await page.tap('#sightsPanel .lip button');
    await page.waitForFunction(() => !document.getElementById('sightsPanel').classList.contains('open'), null, { timeout: 5000 });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});

// Every chart turns a quarter at a time (docs/spec/design.md, "Every chart turns, a quarter at a time"): the walk-around
// buttons beside the compass step de la Cosa through its own quarter turns, so West up (its drawn bearing, 270) lights exactly there and the up chip
// is pressed only then; and the eye shows or hides a sheet without moving the view or turning the world.
test('charts: the walk-around buttons step through the chart\'s quarter turns, West up lighting at its bearing; the eye leaves the view alone', { skip, timeout: 240000 }, async () => {
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
    await page.goto(`http://localhost:${server.address().port}/#map=3.00/30.000/-20.000&overlay=de-la-cosa`);
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('total'), null, { timeout: 90000 });
    const key = async (k) => new URLSearchParams((await page.evaluate(() => location.hash)).slice(1)).get(k);
    await page.click('#charts');
    const cosa = page.locator('#chartList .chart', { hasText: 'Juan de la Cosa' });
    await cosa.locator('.thumb').click(); // lays the sheet and brings up its chips
    const walk = page.locator('#walkLeft'), up = cosa.locator('.pos [data-up]');
    await up.waitFor({ state: 'visible', timeout: 60000 });
    const bearingAfter = async (was) => {
      await page.waitForFunction((w) => (new URLSearchParams(location.hash.slice(1)).get('bearing') ?? '0') !== w, was, { timeout: 30000 });
      await page.waitForTimeout(1500); // the turn is a short animation
      return Number(await key('bearing') ?? 0);
    };
    // anticlockwise from north up: each step a quarter from the chart's own up, so 87.8, 177.8, 267.8 (West up), 357.8, 87.8
    const seen = [];
    let was = String(await key('bearing') ?? '0');
    for (let i = 0; i < 5; i++) {
      await walk.click();
      const b = await bearingAfter(was);
      seen.push(b); was = String(await key('bearing') ?? '0');
      const lit = (await up.getAttribute('aria-pressed')) === 'true';
      assert.equal(lit, Math.abs(b - 267.8) < 1 || Math.abs(b - 270) < 1, `West up is ${lit ? 'lit' : 'dark'} at ${b}`);
    }
    assert.ok(seen.some((b) => Math.abs(b - 270) < 3), `the walk never reached West up: ${seen}`);
    for (let i = 1; i < seen.length; i++) assert.ok(Math.abs((((seen[i] - seen[i - 1]) % 360) + 360) % 360 - 90) < 3, `step ${i} was not a quarter turn: ${seen}`);
    // the eye hides and shows the sheet and leaves the view, bearing included, where it is
    const view = async () => `${await key('map')}|${await key('bearing')}`, before = await view();
    await cosa.locator('.eye').click();
    await page.waitForFunction(() => !/[#&]overlay=/.test(location.hash), null, { timeout: 30000 });
    assert.equal(await view(), before, 'the eye hid the sheet and moved the view');
    await cosa.locator('.eye').click();
    await page.waitForFunction(() => /[#&]overlay=de-la-cosa(&|$)/.test(location.hash), null, { timeout: 30000 });
    assert.equal(await view(), before, 'the eye showed the sheet and moved the view');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    server.close();
  }
});
