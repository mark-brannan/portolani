// The URL hash as the page reads and writes it, in headless Chromium: the view round-trips, clamps and
// wraps; editing the hash redraws without a reload; Reset keeps only the view, its projection with it (and the drawer's layout);
// Copy link copies the URL, or selects it in a box when the clipboard is refused; the three drawer sliders
// (density, continents, regions) read from and write to the hash, as do the temporary sheets overlay and
// knobs (debug=, tune=); and the drawer's four layouts each show every control and ride in the hash
// (`layout=`). Each scenario opens a fresh page at a hash.
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

scenario('reset: every control back to default, only the view and its projection kept', 'map=7.00/43.700/7.300&ink=5a1a1a&density=1.5&projection=miller', async (page) => {
  assert.equal(await value(page, 'projection'), 'miller');
  await page.evaluate(() => { document.getElementById('status').textContent = ''; });
  await openDrawer(page);
  await page.locator('#reset').click();
  await placed(page);
  assert.equal(await hash(page), '#map=7.00/43.700/7.300&projection=miller');
  assert.equal(await value(page, 'projection'), 'miller');
  assert.equal(await value(page, 'ink'), '#3b2a1a');
  assert.equal(await value(page, 'density'), '1');
});

scenario('copy link: the clipboard holds the page URL', 'map=7.00/43.700/7.300&density=1.5', async (page) => {
  await openDrawer(page);
  await page.locator('#copy').click();
  await page.waitForFunction(() => document.getElementById('shareNote').textContent !== '');
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await page.evaluate(() => location.href));
  assert.equal(await page.locator('#shareUrl').isHidden(), true);
}, { permissions: ['clipboard-read', 'clipboard-write'] });

scenario('copy link: a refused clipboard selects the link in a box', 'map=7.00/43.700/7.300&density=1.5', async (page) => {
  await openDrawer(page);
  await page.locator('#copy').click();
  await page.waitForFunction(() => document.getElementById('shareNote').textContent !== '');
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

scenario('continents: no key is the default 6', 'map=5.48/40.265/7.000', async (page) => {
  assert.equal(await value(page, 'continentsZoom'), '6');
  assert.equal(await text(page, 'continentsOut'), 'zoom 6 and out');
});

// The slider at 1 writes continents=1 (or regionszoom=1), and a page opened at that hash reads 1 back.
for (const [id, key, out] of [['continentsZoom', 'continents', 'continentsOut'], ['regionsZoom', 'regionszoom', 'regionsOut']]) {
  scenario(`${key}: 1 round-trips through the hash`, 'map=5.48/40.265/7.000', async (page) => {
    await slide(page, id, 1);
    const written = (await hash(page)).slice(1);
    assert.equal(new URLSearchParams(written).get(key), '1');
    const again = await open(written);
    try {
      assert.equal(await value(again.page, id), '1');
      assert.equal(await text(again.page, out), 'zoom 1 and out');
      assert.equal(await hash(again.page), `#${written}`);
      assert.deepEqual(again.errors, [], 'page errors on the reopened link');
    } finally { await again.close(); }
  });
}

scenario('regions: the slider round-trips', 'map=5.48/40.265/7.000', async (page) => {
  await slide(page, 'regionsZoom', 9);
  assert.equal((await params(page)).get('regionszoom'), '9');
  assert.equal(await text(page, 'regionsOut'), 'zoom 9 and out');
});

// ---------------------------------------------------------------- the drawer's layouts (#225)

// Every control in the drawer, by its element's id. Each layout shows all of them, each one element.
const CONTROLS = ['density', 'pick-monster', 'pick-ship', 'pick-rose', 'placement', 'townSize', 'pick-town', 'mountains', 'hills', 'pick-relief', 'trees',
  'pick-cartouche', 'titleMode', 'title', 'projection', 'names', 'rhumb', 'continentsZoom', 'regions', 'regionsZoom', 'land', 'islands', 'seaTint',
  'rivers', 'lakes', 'scale', 'scaleBorder', 'ink', 'parchment'];
const HEADINGS = {
  default: ['Sea', 'Roses', 'Placement', 'Towns', 'Land', 'Cartouche', 'Map', 'Colours'],
  question: ['The chart', 'The land', 'The figures'],
  moods: ['The chart', 'The land', 'The figures'], // under Fine controls, once it is opened
  sheet: ['Sea', 'Land', 'Margins'],
};
// the drawer's headings as shown, less the ?ui= figures and About, which no layout moves
const headings = (page) => page.evaluate(() => [...document.querySelectorAll('#drawer h2')].filter((h) => h.getClientRects().length && !['h-ui', 'h-about'].includes(h.id)).map((h) => h.textContent));
async function showsEveryControl(page, name) {
  for (const id of CONTROLS) {
    assert.equal(await page.locator(`#drawer [id="${id}"]`).count(), 1, `${name}: #${id} is one element`);
    assert.equal(await page.locator(`#${id}`).isVisible(), true, `${name}: #${id} shown`);
  }
}
const layoutChip = (page, name) => page.locator(`#layout [data-layout="${name}"]`);

scenario('layout: each of the four shows every control once, under its own headings', 'map=5.48/40.265/7.000', async (page) => {
  await openDrawer(page);
  assert.deepEqual(await headings(page), HEADINGS.default);
  await showsEveryControl(page, 'default');
  for (const name of ['question', 'moods', 'sheet', 'default']) {
    await layoutChip(page, name).click();
    assert.equal(await layoutChip(page, name).getAttribute('aria-checked'), 'true');
    assert.equal((await params(page)).get('layout'), name === 'default' ? null : name, 'the layout rides in the hash; Default is no key');
    if (name === 'moods') {
      assert.equal(await page.locator('#drawer details.fine').evaluate((d) => d.open), false, 'Fine controls starts closed');
      assert.deepEqual(await page.locator('.moods .preset b').allTextContents(), ['Pilot’s chart', 'Tasteful', 'Woodcut', 'Illuminated', 'All the things']);
      await page.locator('#drawer details.fine > summary').click();
    }
    assert.deepEqual(await headings(page), HEADINGS[name]);
    await showsEveryControl(page, name);
  }
});

scenario('layout: a link opens its layout, and a write, Reset and a hash edit keep or change it', 'map=7.00/43.700/7.300&layout=sheet', async (page) => {
  assert.equal(await layoutChip(page, 'sheet').getAttribute('aria-checked'), 'true');
  await slide(page, 'density', 1.5);
  assert.deepEqual(await headings(page), HEADINGS.sheet);
  assert.equal((await params(page)).get('layout'), 'sheet', 'a write from another control keeps it');
  assert.equal((await params(page)).get('density'), '1.5');
  await page.evaluate(() => { document.getElementById('status').textContent = ''; });
  await page.locator('#reset').click();
  await placed(page);
  assert.equal(await hash(page), '#map=7.00/43.700/7.300&layout=sheet', 'Reset keeps the view and the layout');
  await page.evaluate(() => { location.hash = 'map=7.00/43.700/7.300&layout=question'; });
  await placed(page);
  assert.equal(await layoutChip(page, 'question').getAttribute('aria-checked'), 'true');
  assert.deepEqual(await headings(page), HEADINGS.question);
  await page.evaluate(() => { location.hash = 'map=7.00/43.700/7.300&layout=nonsense'; });
  await placed(page);
  assert.deepEqual(await headings(page), HEADINGS.default, 'an unknown layout opens Default');
});

// The five moods, sparse to dense, and what each writes to the hash: its figures as a set, and every other key a
// mood sets (null where it is the default, which the hash leaves out). All the things' figures and seed are checked
// below. Each mood is a whole look, so a key the mood before it set is gone.
const HILLS = ['v:mountains-a', 'v:mountains-b', 'v:mountains-c'];
const AGUIAR_SCAN = ['venice', 'genoa', 'lisbon', 'lake', 'lake-moat', 'smina', 'jerusalem', 'ceuta', 'avignon'].map((t) => `s:town-aguiar-${t}`);
const AGUIAR_DRAWN = ['walled', 'walled-2', 'walled-3', 'hall', 'hall-2', 'hall-3', 'towers', 'towers-2', 'towers-3', 'hill', 'hill-2', 'hill-3', 'church', 'church-2', 'church-3', 'gate', 'gate-2', 'gate-3', 'venice', 'moat'].map((t) => `v:town-aguiar-${t}`);
const PLAIN = { land: null, islands: null, seas: null, rivers: null, lakes: null, mountains: null, trees: null, ink: null, parchment: null };
const MOODS = [
  ['Pilot’s chart', { ...PLAIN, sprites: ['p:rose'], density: '0', placement: 'historic', land: 'off', rivers: 'off', lakes: 'off', mountains: 'off', trees: 'off' }],
  ['Tasteful', { ...PLAIN, sprites: ['s:rose-catalan', 'v:rose-catalan', 'v:rose-catalan-small', 'v:cartouche-frame', 'v:merman', 'v:hippocampus', 'v:galley', 'v:caravel', ...HILLS, ...AGUIAR_SCAN],
    density: '0.5', placement: 'historic', islands: '1', seas: '1', mountains: 'off' }],
  ['Woodcut', { ...PLAIN, sprites: ['p:rose', 's:cartouche-dewit', 's:serpent-a', 's:whale-b', 's:pistrix-c', 's:cete-e', 's:pare-truie', 's:pare-boar', 's:pare-lion', 's:pare-calf', 's:pare-elephant', 's:pare-bear', 's:pare-seaman', 's:pare-bishop', 'd:debry-monster', 's:ship-a', 's:ship-b', 's:ship-w-key', 's:ship-w-buss', 'd:debry-ship-a', 'd:debry-ship-b', 'd:debry-canoe', 'p:tower', 'p:tower-dome', 'p:house', 'p:church', 'p:castle', 'p:round-tower', 'p:tent'],
    density: null, placement: 'historic', land: 'off', rivers: 'marina', mountains: 'ink', trees: 'ink', ink: '1d1913', parchment: 'efe9dc' }], // density 1 and lakes marina are the defaults
  ['Illuminated', { ...PLAIN, sprites: ['s:rose-aguiar', 's:rose-catalan', 's:rose-prunes', 's:rose-aguiar-b', 'v:rose-fleurs', 'v:rose-fleurs-small', 'v:cartouche-frame', 'v:sea-dragon', 'v:sea-lion', 'v:dolphin', 'v:merman', 'v:hippocampus', 'v:walrus', 'v:galleon', 'v:caravel-heraldic', 'v:carrack', 'v:galley', 'v:caravel', ...HILLS, ...AGUIAR_SCAN, ...AGUIAR_DRAWN],
    density: '1.5', placement: 'historic', land: 'gilt', islands: '1', seas: '1', rivers: 'aguiar', lakes: 'aguiar' }],
  ['All the things', { ...PLAIN, density: '2' }],
];
scenario('layout: Moods sets the existing controls at once, a whole look each', 'map=5.48/40.265/7.000&layout=moods', async (page) => {
  await openDrawer(page);
  const mood = (label) => page.locator('.moods .preset', { hasText: label });
  const checked = () => page.locator('.moods .preset').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-checked')));
  assert.deepEqual(await checked(), MOODS.map(() => 'false'), 'a page with no mood chosen shows no mood on');
  for (const [i, [label, want]] of MOODS.entries()) {
    await page.evaluate(() => { document.getElementById('status').textContent = ''; });
    await mood(label).click();
    await placed(page);
    const q = await params(page);
    for (const [key, v] of Object.entries(want)) {
      if (key === 'sprites') assert.deepEqual(new Set(q.get('sprites').split(',')), new Set(v), `${label}: its figures`);
      else assert.equal(q.get(key), v, `${label}: ${key}`);
    }
    assert.equal(await value(page, 'density'), want.density ?? '1', `${label}: the slider shows its density`);
    if (want.placement) assert.equal(await page.locator('#placement [data-placement="historic"]').getAttribute('aria-checked'), 'true', `${label}: Historic shows on`);
    assert.deepEqual(await checked(), MOODS.map((_, j) => String(j === i)), `${label}: its chip alone shows on`);
  }
  const q = await params(page); // All the things
  assert.match(q.get('placement'), /^seed:-?\d+$/);
  assert.ok(q.get('sprites').split(',').length > 10, 'every figure on');
  assert.equal(await value(page, 'land'), 'ochre', 'the controls show the default styles again');
  assert.equal(await value(page, 'ink'), '#3b2a1a');
});

// ---------------------------------------------------------------- under the hood (temporary): debug= and tune=

// the drawer open at its collapsed "Under the hood" section, opened
const hood = async (page) => { await openDrawer(page); await page.evaluate(() => { document.getElementById('hood').open = true; }); };
const chip = (page, id, v) => page.locator(`#${id} [data-value="${v}"]`).click();

scenario('debug: the sheets chips round-trip', 'map=6.14/40.474/7.400', async (page) => {
  assert.equal((await params(page)).has('debug'), false);
  assert.equal(await value(page, 'debug'), 'off');
  await hood(page);
  await chip(page, 'debug', 'sheets,rings');
  assert.equal((await params(page)).get('debug'), 'sheets,rings');
  await chip(page, 'debug', 'off');
  assert.equal((await params(page)).has('debug'), false);
});

scenario('debug: a hash names its layers in one order, and an unknown word is dropped', 'map=6.14/40.474/7.400&debug=rings,bogus,sheets', async (page) => {
  assert.equal(await value(page, 'debug'), 'sheets,rings');
  await slide(page, 'density', 1.5);
  assert.equal((await params(page)).get('debug'), 'sheets,rings');
});

scenario('debug: a bad value falls back to off and is not written back', 'map=6.14/40.474/7.400&debug=bogus', async (page) => {
  assert.equal(await value(page, 'debug'), 'off');
  await slide(page, 'density', 1.5);
  assert.equal((await params(page)).has('debug'), false);
});

scenario('tune: a link\'s knobs round-trip', 'map=6.14/40.474/7.400&tune=radius:0.5,reach:1.5,origin:zero,curated:0,roselines:0,roseshare:0.6,sheetroses:6', async (page) => {
  assert.deepEqual(await Promise.all(['tuneRadius', 'tuneReach', 'tuneOrigin', 'tuneCurated', 'tuneRoselines', 'tuneRoseshare', 'tuneSheetroses'].map((id) => value(page, id))), ['0.5', '1.5', 'zero', '0', '0', '0.6', '6']);
  assert.equal(await text(page, 'tuneRadiusOut'), '0.5 of sheet height');
  assert.equal(await text(page, 'tuneReachOut'), '1.5 × diagonal');
  await slide(page, 'density', 1.5);
  assert.equal((await params(page)).get('tune'), 'radius:0.5,reach:1.5,origin:zero,curated:0,roselines:0,roseshare:0.6,sheetroses:6');
});

scenario('tune: the sliders and chips write their knob, and only it', 'map=6.14/40.474/7.400', async (page) => {
  assert.equal((await params(page)).has('tune'), false);
  await hood(page);
  await page.locator('#tuneRadius').fill('0.5');
  assert.equal((await params(page)).get('tune'), 'radius:0.5');
  assert.equal(await text(page, 'tuneRadiusOut'), '0.5 of sheet height');
  await chip(page, 'tuneOrigin', 'zero');
  assert.equal((await params(page)).get('tune'), 'radius:0.5,origin:zero');
  await page.locator('#tuneRadius').fill('0.4'); // back to the default: left out
  await chip(page, 'tuneOrigin', 'rose');
  assert.equal((await params(page)).has('tune'), false);
});

scenario('tune: rose share and roses per sheet are the band\'s own until moved', 'map=6.14/40.474/7.400', async (page) => {
  assert.match(await text(page, 'tuneRoseshareOut'), /band's own/);
  await slide(page, 'density', 1.5); // a write from another control leaves them unset
  assert.equal((await params(page)).has('tune'), false);
  await hood(page);
  await page.locator('#tuneSheetroses').fill('2');
  assert.equal((await params(page)).get('tune'), 'sheetroses:2');
  assert.equal(await text(page, 'tuneSheetrosesOut'), '2');
});

scenario('tune: a bad or default value falls back and is not written back', 'map=6.14/40.474/7.400&tune=radius:9,reach:x,origin:north,curated:2,sheetroses:2.5,roseshare:0.4,junk', async (page) => {
  assert.equal(await value(page, 'tuneRadius'), '0.4');
  assert.equal(await value(page, 'tuneOrigin'), 'rose');
  assert.equal(await value(page, 'tuneCurated'), '1');
  await slide(page, 'density', 1.5);
  // roseshare:0.4 is in range, so it is kept: its default is each band's own, not 0.4
  assert.equal((await params(page)).get('tune'), 'roseshare:0.4');
});

scenario('reset: the sheets and the knobs go back to default with the rest', 'map=6.14/40.474/7.400&debug=sheets&tune=radius:0.5,origin:zero,sheetroses:2', async (page) => {
  await page.evaluate(() => { document.getElementById('status').textContent = ''; });
  await openDrawer(page);
  await page.locator('#reset').click();
  await placed(page);
  assert.equal(await hash(page), '#map=6.14/40.474/7.400');
  assert.deepEqual(await Promise.all(['debug', 'tuneRadius', 'tuneOrigin', 'tuneSheetroses'].map((id) => value(page, id))), ['off', '0.4', 'rose', '4']);
  assert.match(await text(page, 'tuneSheetrosesOut'), /band's own/);
});
