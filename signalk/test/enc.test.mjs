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
import { packOf, CHART_OPTIONS } from '../app/chart.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..');
const adapterURL = pathToFileURL(join(HERE, '..', 'app', 'enc-provider.js')).href;
// the webapp's import map, as hooks: scene.mjs's `coastlines/provider` is the adapter, `portolani/` is scripts/
const SCRIPTS = pathToFileURL(join(ROOT, 'scripts')).href;
function resolveMapped(specifier, adapter, scripts) {
  if (specifier === 'coastlines/provider') return adapter;
  if (specifier.startsWith('portolani/')) return `${scripts}/${specifier.slice(10)}`;
  return null;
}
if (nodeModule.registerHooks) {
  nodeModule.registerHooks({
    resolve(specifier, context, next) {
      const url = resolveMapped(specifier, adapterURL, SCRIPTS);
      return url ? { url, shortCircuit: true } : next(specifier, context);
    },
  });
} else {
  // Node 20 has no registerHooks (22.15+): the same map through module.register, in a loader thread
  const loader = `const resolveMapped = ${resolveMapped};
let map;
export function initialize(data) { map = data; }
export async function resolve(specifier, context, next) {
  const url = resolveMapped(specifier, map.adapter, map.scripts);
  return url ? { url, shortCircuit: true } : next(specifier, context);
}`;
  nodeModule.register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url, { data: { adapter: adapterURL, scripts: SCRIPTS } });
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
const env = {
  createCanvas,
  // no world geo: every geo/ file is empty, as the webapp serves it
  readJSON: async (p) => (p.startsWith('geo/') ? empty : p.startsWith('packs/') ? packOf(p.split('/')[1], JSON.parse(readFileSync(join(ROOT, p), 'utf8'))) : JSON.parse(readFileSync(join(ROOT, p), 'utf8'))),
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
  for (const l of ['LNDARE', 'COALNE', 'SLCONS', 'DEPARE', 'DEPCNT', 'SOUNDG', 'UWTROC', 'WRECKS', 'OBSTRN']) assert.ok(c.layers[l] > 0, l);
  c.bbox.forEach((v, i) => assert.ok(Math.abs(v - [-123.468, 47.033, -122.151, 48.342][i]) < 1e-3, `bbox ${i}`));

  const server = await serve(resourceProvider(() => store));
  t.after(() => server.close());
  const { source } = await import(adapterURL);
  source.base = `http://127.0.0.1:${server.address().port}/${RESOURCE_TYPE}`;
  const depare = await (await source.fetch(`${source.base}/US3WA46M/DEPARE`)).json();
  assert.ok(depare.features.every((f) => typeof f.properties.DRVAL1 === 'number'), 'DRVAL1 is a number');

  const { createScene, drawScene, H } = await import('../../scripts/scene.mjs');
  const b = SEATTLE;
  const view = { lon: (b.lonMin + b.lonMax) / 2, lat: Math.atan(Math.sinh((merc(b.latMin) + merc(b.latMax)) / 2)) / RAD,
    zoom: Math.log2((2 * Math.PI * H) / (512 * (merc(b.latMax) - merc(b.latMin)) * 1.02)) };
  const draw = async (depth) => {
    const { scene, data, bg } = await createScene(env, { ...CHART_OPTIONS, view, depth });
    const c = createCanvas(1600, 1000), g = c.getContext('2d');
    drawScene(g, scene, data, bg, { scale: 1, x: 0, y: 0 });
    return { c, data };
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
