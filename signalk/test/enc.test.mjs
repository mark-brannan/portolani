// The plugin's converter serves NOAA ENC US3WA46M (test/fixtures, its .000 and ten updates, gzipped)
// over a stand-in of the Resources API routes, and the webapp's adapter draws the spike's Seattle view
// through scene.mjs, offline: the land, coast and depth all come from the cell.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as nodeModule from 'node:module';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { syncStore } from '../lib/cells.mjs';
import { resourceProvider, RESOURCE_TYPE } from '../lib/provider.mjs';
import { packOf, chartOptions, readSettings, DEFAULTS, ROSES, TOWNS } from '../app/chart.mjs';
import { chartGeo } from '../geo.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..');
const adapterURL = pathToFileURL(join(HERE, '..', 'app', 'enc-provider.js')).href;
// the webapp's import map, as hooks: scene.mjs's `coastlines/provider` is the adapter, `portolani/` is scripts/
const SCRIPTS = pathToFileURL(join(ROOT, 'scripts')).href;
const WORLD = import.meta.resolve('coastlines/provider'); // the adapter's own coastlines, as the build copies it
function resolveMapped(specifier, adapter, scripts, world) {
  if (specifier === 'coastlines/world-provider') return world;
  if (specifier === 'coastlines/provider') return adapter;
  if (specifier.startsWith('portolani/')) return `${scripts}/${specifier.slice(10)}`;
  return null;
}
if (nodeModule.registerHooks) {
  nodeModule.registerHooks({
    resolve(specifier, context, next) {
      const url = resolveMapped(specifier, adapterURL, SCRIPTS, WORLD);
      return url ? { url, shortCircuit: true } : next(specifier, context);
    },
  });
} else {
  // Node 20 has no registerHooks (22.15+): the same map through module.register, in a loader thread
  const loader = `const resolveMapped = ${resolveMapped};
let map;
export function initialize(data) { map = data; }
export async function resolve(specifier, context, next) {
  const url = resolveMapped(specifier, map.adapter, map.scripts, map.world);
  return url ? { url, shortCircuit: true } : next(specifier, context);
}`;
  nodeModule.register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url, { data: { adapter: adapterURL, scripts: SCRIPTS, world: WORLD } });
}

// GET /<type>, /<type>/<id> and /<type>/<id>/<property>, as signalk-server routes them to a provider
function serve(provider) {
  const server = createServer(async (req, res) => {
    const [type, id, property] = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean);
    try {
      if (type !== provider.type) throw new Error('no provider');
      const body = id ? await provider.methods.getResource(id, property) : await provider.methods.listResources({});
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(body));
    } catch (e) { res.writeHead(404).end(JSON.stringify({ state: 'FAILED', statusCode: 404, message: e.message })); }
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

const empty = { type: 'FeatureCollection', features: [] };
const shipped = chartGeo(ROOT);
const env = {
  createCanvas,
  // of the world geo only the ranges and peaks the build ships; every other geo/ file is empty, as the webapp serves it
  readJSON: async (p) => (p.startsWith('geo/') ? shipped[p] ?? empty : p.startsWith('packs/') ? packOf(p.split('/')[1], JSON.parse(readFileSync(join(ROOT, p), 'utf8'))) : JSON.parse(readFileSync(join(ROOT, p), 'utf8'))),
  loadImage: (p) => loadImage(join(ROOT, p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};
const RAD = Math.PI / 180, merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
const SEATTLE = { lonMin: -122.52, lonMax: -122.33, latMin: 47.55, latMax: 47.72 };

test('US3WA46M through the provider draws the Seattle view, with its depth', async (t) => {
  const store = mkdtempSync(join(tmpdir(), 'enc-store-'));
  t.after(() => rmSync(store, { recursive: true, force: true }));
  const cat = await syncStore(join(HERE, 'fixtures'), store);
  assert.deepEqual(Object.keys(cat), ['US3WA46M']);
  const c = cat.US3WA46M;
  assert.equal(c.band, 3);
  assert.equal(c.edition, 37);
  assert.equal(c.update, 10);
  for (const l of ['LNDARE', 'COALNE', 'SLCONS', 'DEPARE', 'DEPCNT', 'SOUNDG', 'UWTROC', 'WRECKS', 'OBSTRN', 'SEAARE', 'BUAARE']) assert.ok(c.layers[l] > 0, l);
  c.bbox.forEach((v, i) => assert.ok(Math.abs(v - [-123.468, 47.033, -122.151, 48.342][i]) < 1e-3, `bbox ${i}`));

  const server = await serve(resourceProvider(() => store));
  t.after(() => server.close());
  const { source, cellData, frameView } = await import(adapterURL);
  source.base = `http://127.0.0.1:${server.address().port}/${RESOURCE_TYPE}`;
  const depare = await (await source.fetch(`${source.base}/US3WA46M/DEPARE`)).json();
  assert.ok(depare.features.every((f) => typeof f.properties.DRVAL1 === 'number'), 'DRVAL1 is a number');

  const { createScene, drawScene, listSprites, scaleRect, viewProjection, W, H } = await import('../../scripts/scene.mjs');
  const list = await listSprites(env), settings = readSettings({});
  const b = SEATTLE;
  const view = { lon: (b.lonMin + b.lonMax) / 2, lat: Math.atan(Math.sinh((merc(b.latMin) + merc(b.latMax)) / 2)) / RAD,
    zoom: Math.log2((2 * Math.PI * H) / (512 * (merc(b.latMax) - merc(b.latMin)) * 1.02)) };
  // the webapp's draw: the drawer's settings as scene options, with the cells' towns and water names
  const optionsAt = async (at, set = settings) => ({ ...chartOptions(set, list, await cellData(frameView(at, viewProjection(at).invert, W, H))), view: at });
  const draw = async (depth, at = view, set = settings) => {
    const { scene, data, bg } = await createScene(env, { ...(await optionsAt(at, set)), depth });
    const c = createCanvas(1600, 1000), g = c.getContext('2d');
    drawScene(g, scene, data, bg, { scale: 1, x: 0, y: 0 });
    return { c, data, scene, bar: scaleRect() };
  };
  const withDepth = await draw(true), without = await draw(false);
  assert.ok(withDepth.data.land.length > 10, `land from the cell: ${withDepth.data.land.length} polygons`);
  assert.ok(withDepth.data.coastLL.length > 10, `coast from the cell: ${withDepth.data.coastLL.length} lines`);
  assert.ok(withDepth.data.depth?.SOUNDG.length, 'the depth layer reached the scene');
  assert.equal(without.data.depth, undefined);
  const px = (c) => c.getContext('2d').getImageData(0, 0, 1600, 1000).data;
  const a = px(withDepth.c), z = px(without.c);
  let differ = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== z[i] || a[i + 1] !== z[i + 1] || a[i + 2] !== z[i + 2]) differ++;
  assert.ok(differ > 20000, `depth paints the sea: ${differ} px differ`);
  if (process.env.UPDATE_GOLDEN) writeFileSync(join(HERE, 'golden', 'seattle.png'), withDepth.c.toBuffer('image/png'));
  // the cells' water lettered once each, clear of each other and of the scale bar; the cells' towns stood
  const water = withDepth.scene.names.filter((n) => n.water);
  assert.ok(water.some((n) => n.text === 'Elliott Bay'), `Elliott Bay lettered: ${water.map((n) => n.text)}`);
  assert.equal(new Set(water.map((n) => n.text)).size, water.length, 'each name once');
  const apart = (a, b) => Math.abs(a.cx - b.cx) >= a.hw + b.hw || Math.abs(a.cy - b.cy) >= a.hh + b.hh;
  for (const [i, a] of water.entries()) for (const b of water.slice(i + 1)) assert.ok(apart(a.box, b.box), `${a.text} and ${b.text} apart`);
  const { bar } = withDepth, barBox = { cx: bar.x + bar.w / 2, cy: bar.y + bar.h / 2, hw: bar.w / 2, hh: bar.h / 2 };
  for (const n of water) assert.ok(apart(n.box, barBox), `${n.text} clear of the scale bar`);
  assert.ok(withDepth.scene.towns.length > 0, 'the cells\' built-up areas stand towns');
  assert.ok(withDepth.scene.towns.every((t) => !t.sprite || (t.sprite.pack === 'vivid' && TOWNS.includes(t.sprite.style))), 'the drawn town styles');
  // the scale bar in the bottom-left corner, its gap to the bottom edge its gap to the left edge
  assert.ok(Math.abs(bar.x - (H - (bar.y + bar.h))) <= 1, `scale bar ${bar.x} px from the left, ${H - bar.y - bar.h} px from the bottom`);
  // the Towns chips all off is no town: the cells' built-up areas reach no scene
  const place = { name: 'Here', lon: -122.3, lat: 47.6, area: 1 };
  assert.deepEqual(chartOptions(settings, list, { places: [place] }).places, [place]);
  assert.deepEqual(chartOptions({ ...settings, towns: [] }, list, { places: [place] }).places, []);
  // the cartouche off at first, a chip turns it on
  assert.equal(settings.cartouche, false);
  assert.ok(!chartOptions(settings, list).kinds.includes('cartouche'));
  assert.ok(chartOptions({ ...settings, cartouche: true }, list).sprites.includes('vivid/cartouche-frame'));
  // the roses the drawn styles alone, Aguiar's own rose at first; the monsters Paré or heraldic, heraldic at first
  assert.deepEqual(chartOptions(settings, list).sprites.filter((k) => /rose/.test(k)), ['vivid/rose-aguiar']);
  for (const r of ROSES) assert.ok(chartOptions({ ...settings, rose: r }, list).sprites.some((k) => k.startsWith(`vivid/rose-${r}`)), r);
  assert.ok(withDepth.scene.monsters.every((m) => m.sprite.style === 'heraldic'), 'heraldic monsters');
  assert.ok(chartOptions({ ...settings, monster: 'pare' }, list).sprites.every((k) => !/monster|heraldic/.test(k) || k.startsWith('scanned/pare-')));
  assert.ok(!chartOptions({ ...settings, monster: 'off' }, list).kinds.includes('monster'));
  // course up: the chart turned so the course is at the top
  const turned = await createScene(env, { ...(await optionsAt({ ...view, bearing: 45 })) });
  assert.equal(turned.data.proj.bearing, 45);
  // the whole cell, as the webapp opens on it: Puget Sound, the Olympics and the Cascades at its edges
  const [w, s, e, n] = c.bbox, cell = { lon: (w + e) / 2, lat: Math.atan(Math.sinh((merc(s) + merc(n)) / 2)) / RAD,
    zoom: Math.min(Math.log2((2 * Math.PI * H) / (512 * (merc(n) - merc(s)))), Math.log2((2 * Math.PI * 1600) / (512 * (e - w) * RAD))) };
  const whole = await draw(true, cell);
  if (process.env.UPDATE_GOLDEN) writeFileSync(join(HERE, 'golden', 'puget.png'), whole.c.toBuffer('image/png'));
  // the chart's mountains on the cell's land: its style along the ranges the build ships, and no Catalan sprite
  assert.ok(whole.scene.relief?.peaks.length > 10, `mountains on the cell's land: ${whole.scene.relief?.peaks.length}`);
  assert.ok(whole.scene.mountains.every((m) => !m.sprite), 'no mountain sprite stands');
  assert.equal(DEFAULTS.depth && DEFAULTS.mountains && DEFAULTS.peaks, true, 'depth, mountains and peaks on at first');
  assert.ok(shipped['geo/ranges-10m.json'].features.length > 100 && shipped['geo/peaks-10m.json'].features.length > 100, 'the build ships the ranges and the peaks');
  // a landmark peak on the cell's land: the shipped peaks hold none inside this cell, so one is stood on the Olympic
  // Peninsula, and the scene draws it and a tap on its drawing finds its name and height
  const stand = { type: 'Feature', properties: { name: 'Test Summit', elevation: 1800, min_zoom: 0 }, geometry: { type: 'Point', coordinates: [-123.2, 47.8] } };
  const peakEnv = { ...env, readJSON: (p) => (p === 'geo/peaks-10m.json' ? Promise.resolve({ type: 'FeatureCollection', features: [stand] }) : env.readJSON(p)) };
  const { scene: ps, data: pd } = await createScene(peakEnv, await optionsAt(cell));
  const { drawnPeaks, peakHits } = await import('../../scripts/scene.mjs');
  const drawn = drawnPeaks(ps, pd);
  assert.ok(drawn.length >= 1, `the landmark peak is drawn on the cell's land: ${drawn.length}`);
  const proj = viewProjection(cell), [hit] = peakHits(drawn, proj, { x0: 0, y0: 0, x1: 1600, y1: 1000 });
  assert.equal(hit?.tile.title, 'Test Summit');
  assert.match(hit.tile.date, /1,800 m/);
  // drawn as the lone ink peak, its name lettered beside it
  assert.ok(ps.mountains.filter((m) => m.peak).every((m) => m.ink), 'the lone ink peak');
  assert.ok(ps.peakNames.some((n) => n.text === 'Test Summit'), 'the peak lettered');
  // away from the cell, the world: Natural Earth's 50m land and coast, through coastlines' own provider
  const away = await draw(true, { lon: -130, lat: 53, zoom: 7 }); // Haida Gwaii, clear of the cell
  assert.ok(away.data.land.length > 0 && away.data.coastLL.length > 0, `the world's land away from the cell: ${away.data.land.length} polygons`);
  // past the cell's edge, the world under it: land beyond the box, none of the world's inside it
  const wider = await draw(true, { ...cell, zoom: cell.zoom - 1.5 });
  const pts = wider.data.land.flatMap((poly) => poly[0]);
  assert.ok(pts.some(([lon, lat]) => lon < w - 0.05 || lon > e + 0.05 || lat < s - 0.05 || lat > n + 0.05), 'the world drawn past the cell');
  assert.ok(wider.data.land.length > whole.data.land.length, `more land past the cell: ${wider.data.land.length} > ${whole.data.land.length}`);
  // the monsters in the cell's water only, though the world's sea is drawn past it: the cells' extents
  // (`coverage`) keep them off it, where without them they stand on the world's Pacific
  const offCell = ({ scene: sc, data: d }) => sc.monsters.filter((m) => { const [lon, lat] = d.proj.invert(m.x, m.y); return lon < w || lon > e || lat < s || lat > n; }).length;
  assert.equal(offCell(wider), 0, 'no monster off the cell');
  assert.ok(offCell(await createScene(env, { ...(await optionsAt({ ...cell, zoom: cell.zoom - 1.5 })), coverage: null })) > 0, 'without the cells\' extents, monsters off the cell');
  if (process.env.RENDER_DIR) for (const [k, v] of Object.entries({ away, wider, whole })) writeFileSync(join(process.env.RENDER_DIR, `${k}.png`), v.c.toBuffer('image/png'));
});

test('a cell that will not convert is skipped with a warning, and the rest convert', async (t) => {
  const charts = mkdtempSync(join(tmpdir(), 'enc-charts-')), store = mkdtempSync(join(tmpdir(), 'enc-store-'));
  t.after(() => { rmSync(charts, { recursive: true, force: true }); rmSync(store, { recursive: true, force: true }); });
  cpSync(join(HERE, 'fixtures', 'US3WA46M'), join(charts, 'US3WA46M'), { recursive: true });
  mkdirSync(join(charts, 'US5XX01M'));
  writeFileSync(join(charts, 'US5XX01M', 'US5XX01M.000'), 'not an ENC cell');
  const warned = [];
  const cat = await syncStore(charts, store, { warn: (line) => warned.push(line) });
  assert.deepEqual(Object.keys(cat), ['US3WA46M']);
  assert.equal(warned.length, 1);
  assert.match(warned[0], /^US5XX01M: skipped, /);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(store, 'catalogue.json'), 'utf8'))), ['US3WA46M']);
  // stopped before its first cell, a second run keeps the store as it was
  const again = await syncStore(charts, store, { stopped: () => true });
  assert.deepEqual(Object.keys(again), ['US3WA46M']);
});
