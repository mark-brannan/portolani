// The converter: S-57 ENC cells (a .000 base and its .001, .002 ... updates) to gzipped GeoJSON, one
// file per cell per object class, under a store folder, with a catalogue of what each cell holds. A cell
// is converted again only when its files change, so a restart reads the catalogue and nothing else.
// GDAL's S57 driver reads the cells, through gdal3.js (GDAL in WebAssembly), and applies the updates.
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, statSync, existsSync, rmSync, renameSync } from 'node:fs';
import { join, basename, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { gzipSync, gunzipSync } from 'node:zlib';

// The object classes kept, by their S-57 code; M_COVR gives the catalogue its bbox and is kept with them.
export const CLASSES = { LNDARE: 71, COALNE: 30, SLCONS: 122, DEPARE: 42, DEPCNT: 43, SOUNDG: 129, UWTROC: 153, WRECKS: 159, OBSTRN: 86, M_COVR: 302 };
const NAME = Object.fromEntries(Object.entries(CLASSES).map(([n, c]) => [c, n]));
// the record fields GDAL adds to every feature, which the store leaves out (RCID and OBJL stay)
const RECORD = new Set(['PRIM', 'GRUP', 'RVER', 'AGEN', 'FIDN', 'FIDS', 'LNAM', 'LNAM_REFS', 'FFPT_RIND']);
const CATALOGUE = 'catalogue.json';

// The usage band is the third character of an ENC's name: 1 overview, 2 general, 3 coastal, 4 approach, 5 harbour, 6 berthing
export const bandOf = (cell) => Number(cell[2]) || 0;

// gdal3.js, started once. Its `path` is read relative to the working directory, whatever it is.
let gdal = null;
const require = createRequire(import.meta.url);
const gdalJs = () => (gdal ??= require('gdal3.js/node.js')({ path: relative(process.cwd(), join(dirname(require.resolve('gdal3.js/node.js')), 'dist', 'package')), useWorker: false }));

// One cell at a time through GDAL, whose files and datasets are global: a second sync waits for the first
let queue = Promise.resolve();
const serial = (fn) => { const run = queue.then(fn, fn); queue = run.catch(() => {}); return run; };

// A cell opened by GDAL, `fn(Gdal, dataset, layers)` run on it, and closed. Gzipped files (the test's
// fixtures) are gunzipped to a temporary folder first, as the driver finds the updates by their names
// beside the base. `layers` is each layer's feature count, by class name.
export const withCell = ({ cell, base, updates }, fn, options = []) => serial(async () => {
  const Gdal = await gdalJs();
  let path = base, tmp = null;
  if ([base, ...updates].some((p) => p.endsWith('.gz'))) {
    tmp = mkdtempSync(join(tmpdir(), 'enc-cell-'));
    for (const p of [base, ...updates]) writeFileSync(join(tmp, basename(p, '.gz')), p.endsWith('.gz') ? gunzipSync(readFileSync(p)) : readFileSync(p));
    path = join(tmp, `${cell}.000`);
  }
  try {
    const { datasets, errors } = await Gdal.open(path, options);
    const ds = datasets[0];
    if (!ds) throw new Error(errors.map((e) => e.message).join('; ') || 'GDAL cannot open it');
    try {
      const info = await Gdal.getInfo(ds);
      return await fn(Gdal, ds, Object.fromEntries((info.layers ?? []).map((l) => [l.name, l.featureCount])));
    } finally { await Gdal.close(ds); }
  } finally { if (tmp) rmSync(tmp, { recursive: true, force: true }); }
});

// One layer of an open cell as GeoJSON features
async function layer(Gdal, ds, name) {
  const out = await Gdal.ogr2ogr(ds, ['-f', 'GeoJSON', name]);
  try { return JSON.parse(Buffer.from(await Gdal.getFileBytes(out)).toString('utf8')).features; }
  finally { for (const f of out.all ?? [out]) Gdal.Module.FS.unlink(f.local); }
}

// Every cell under `dir`, at any depth (signalk-charts-provider-simple keeps one folder a cell), with its updates in order
export function findCells(dir) {
  const cells = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const m = /^([A-Z0-9]{8})\.(\d{3})(\.gz)?$/i.exec(e.name);
      if (!m) continue;
      const c = cells.get(m[1]) ?? cells.set(m[1], { cell: m[1], base: null, updates: [] }).get(m[1]);
      if (m[2] === '000') c.base = p; else c.updates.push({ n: Number(m[2]), path: p });
    }
  };
  if (existsSync(dir)) walk(dir);
  return [...cells.values()].filter((c) => c.base).map((c) => ({ ...c, updates: c.updates.sort((a, b) => a.n - b.n).map((u) => u.path) }));
}

// A feature's attributes by acronym, as GDAL names them, numbers as numbers and lists as comma-separated
// strings, with its class by name and without GDAL's record fields
function properties(p) {
  const out = { OBJL: NAME[p.OBJL] ?? p.OBJL, RCID: p.RCID };
  for (const [k, v] of Object.entries(p)) if (!(k in out) && !RECORD.has(k) && v != null) out[k] = Array.isArray(v) ? v.join(',') : v;
  return out;
}

// One cell, its updates applied, as a FeatureCollection a class, and what the catalogue says of it.
// A sounding is GDAL's MultiPoint of [lon, lat, depth].
export async function convertCell(c) {
  const { layers, dsid } = await withCell(c, async (Gdal, ds, counts) => {
    const layers = Object.fromEntries(Object.keys(CLASSES).map((n) => [n, []]));
    for (const name of Object.keys(CLASSES)) {
      if (!counts[name]) continue;
      for (const f of await layer(Gdal, ds, name)) if (f.geometry) layers[name].push({ type: 'Feature', properties: properties(f.properties), geometry: f.geometry });
    }
    return { layers, dsid: counts.DSID ? (await layer(Gdal, ds, 'DSID'))[0]?.properties ?? {} : {} };
  });
  // an update's DSID carries edition 0, so with updates applied the edition is read from the base alone
  let edition = Number(dsid.DSID_EDTN);
  if (c.updates.length) edition = Number(await withCell(c, async (Gdal, ds) => (await layer(Gdal, ds, 'DSID'))[0]?.properties.DSID_EDTN, ['UPDATES=IGNORE']));
  const info = dsid.DSID_UPDN == null ? {} : { edition, update: Number(dsid.DSID_UPDN) };
  // the data coverage (CATCOV 1) bounds the cell; without it, everything kept does
  const cover = layers.M_COVR.filter((f) => f.properties.CATCOV !== 2);
  const xs = [], ys = [];
  const walk = (c) => (typeof c[0] === 'number' ? (xs.push(c[0]), ys.push(c[1])) : c.forEach(walk));
  for (const f of cover.length ? cover : Object.values(layers).flat()) walk(f.geometry.coordinates);
  let lo = Infinity, hi = -Infinity, bo = Infinity, to = -Infinity;
  for (const x of xs) { if (x < lo) lo = x; if (x > hi) hi = x; }
  for (const y of ys) { if (y < bo) bo = y; if (y > to) to = y; }
  // a cell with no coverage and nothing kept has no extent: null, and syncStore leaves it out
  const bbox = xs.length ? [lo, bo, hi, to] : null;
  return { cell: c.cell, band: bandOf(c.cell), bbox, scale: dsid.DSPM_CSCL ?? null, ...info, layers };
}

// The store: `<store>/<cell>/<CLASS>.geojson.gz` and `<store>/catalogue.json`, an entry a cell:
// { cell, band, bbox: [w, s, e, n], scale, edition, update, source, layers: { LNDARE: bytes, ... }, bytes }
export function readCatalogue(store) {
  try { return JSON.parse(readFileSync(join(store, CATALOGUE), 'utf8')); } catch { return {}; }
}

// What a cell's files are, to tell whether it changed: each file's name, size and time
const sourceOf = (c) => [c.base, ...c.updates].map((p) => { const s = statSync(p); return `${basename(p)}:${s.size}:${Math.round(s.mtimeMs)}`; }).join(',');

// Converts every cell under `charts` that is new or changed since the catalogue, drops cells whose files
// are gone, and resolves to the catalogue. It yields to the event loop between cells, so a server
// running it keeps serving; `stopped()` true ends it at the next cell, with the catalogue written for
// what is on disk. `log` hears one line a cell converted; `warn` one a cell skipped, which keeps its old
// entry when it has one, so one bad cell neither stops the rest nor loses what was there.
export async function syncStore(charts, store, { log = () => {}, warn = () => {}, stopped = () => false } = {}) {
  mkdirSync(store, { recursive: true });
  const old = readCatalogue(store), next = {};
  const keepOld = (cell) => { if (old[cell] && existsSync(join(store, cell))) next[cell] = old[cell]; };
  let done = true;
  for (const c of findCells(charts)) {
    await new Promise((ok) => setImmediate(ok));
    if (stopped()) { done = false; break; }
    const source = sourceOf(c);
    if (old[c.cell]?.source === source && existsSync(join(store, c.cell))) { next[c.cell] = old[c.cell]; continue; }
    const t = performance.now();
    let converted;
    try { converted = await convertCell(c); } catch (e) { warn(`${c.cell}: skipped, ${e.message}`); keepOld(c.cell); continue; }
    const { layers, ...entry } = converted;
    if (!entry.bbox) { warn(`${c.cell}: skipped, it covers nothing`); keepOld(c.cell); continue; }
    // the layers go to a temporary folder renamed over the cell's, so a cell is whole or not there
    const dir = join(store, c.cell), tmp = `${dir}.tmp`, sizes = {};
    rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
    for (const [name, features] of Object.entries(layers)) {
      if (!features.length) continue;
      const gz = gzipSync(JSON.stringify({ type: 'FeatureCollection', features }));
      writeFileSync(join(tmp, `${name}.geojson.gz`), gz);
      sizes[name] = gz.length;
    }
    rmSync(dir, { recursive: true, force: true }); renameSync(tmp, dir);
    next[c.cell] = { ...entry, source, layers: sizes, bytes: Object.values(sizes).reduce((a, b) => a + b, 0) };
    log(`${c.cell}: ${Object.keys(sizes).length} layers, ${next[c.cell].bytes} bytes, ${(performance.now() - t).toFixed(0)} ms`);
  }
  // stopped early, the cells not reached keep their old entries and folders
  const cat = done ? next : { ...old, ...next };
  if (done) for (const cell of Object.keys(old)) if (!next[cell]) rmSync(join(store, cell), { recursive: true, force: true });
  writeFileSync(join(store, CATALOGUE), JSON.stringify(cat, null, 1));
  return cat;
}

// A cell's layer as its gzipped bytes, or null when the cell or layer is not in the store
export function layerFile(store, cell, layer) {
  if (!/^[A-Z0-9]{8}$/i.test(cell) || !(layer in CLASSES)) return null;
  const p = join(store, cell, `${layer}.geojson.gz`);
  return existsSync(p) ? readFileSync(p) : null;
}
