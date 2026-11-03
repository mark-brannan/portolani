// The converter: S-57 ENC cells (a .000 base and its .001, .002 ... updates) to gzipped GeoJSON, one
// file per cell per object class, under a store folder, with a catalogue of what each cell holds. A cell
// is converted again only when its files change, so a restart reads the catalogue and nothing else.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync, renameSync } from 'node:fs';
import { join, basename } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { parseS57, applyUpdate, toGeoJSON, S57_ATTRIBUTES, spatialKey } from '@s57-parser/s57';

// The object classes kept, by their S-57 code; M_COVR gives the catalogue its bbox and is kept with them.
export const CLASSES = { LNDARE: 71, COALNE: 30, SLCONS: 122, DEPARE: 42, DEPCNT: 43, SOUNDG: 129, UWTROC: 153, WRECKS: 159, OBSTRN: 86, M_COVR: 302 };
const NAME = Object.fromEntries(Object.entries(CLASSES).map(([n, c]) => [c, n]));
const NUMERIC = new Set(['float', 'int']);
const CATALOGUE = 'catalogue.json';

// The usage band is the third character of an ENC's name: 1 overview, 2 general, 3 coastal, 4 approach, 5 harbour, 6 berthing
export const bandOf = (cell) => Number(cell[2]) || 0;

// A file's bytes as an ArrayBuffer, gunzipped when it ends in .gz (the test's fixtures)
function bytes(path) {
  const b = path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
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

// The edition and update number from a file's DSID field: DSNM, then EDTN and UPDN, each ended by a unit terminator
function dsid(buf, cell) {
  const m = new RegExp(`${cell}\\.\\d{3}\\x1f(\\d*)\\x1f(\\d*)\\x1f`).exec(Buffer.from(buf).toString('latin1'));
  return m ? { edition: Number(m[1]), update: Number(m[2]) } : {};
}

// A feature's attributes by acronym (ATTL_87 -> DRVAL1), numbers as numbers, with its class by name
function properties(p) {
  const out = { OBJL: NAME[p.OBJL] ?? p.OBJL, RCID: p.RCID };
  for (const [k, v] of Object.entries(p)) {
    if (!k.startsWith('ATTL_')) continue;
    const a = S57_ATTRIBUTES.get(Number(k.slice(5)));
    out[a?.acronym ?? k] = a && NUMERIC.has(a.valueType) && v !== '' && Number.isFinite(Number(v)) ? Number(v) : v;
  }
  if (p._outline) out._outline = p._outline;
  return out;
}

// A sounding's points as [lon, lat, depth]: toGeoJSON keeps only the position
function soundings(ds, rcid) {
  const f = ds.features.find((r) => r.rcid === rcid), pts = [];
  for (const ref of f?.spatialRefs ?? []) for (const c of ds.spatialRecords.get(spatialKey(ref.rcnm, ref.rcid))?.coordinates3D ?? []) pts.push([c.lon, c.lat, c.depth]);
  return pts;
}

// One cell, its updates applied, as a FeatureCollection a class, and what the catalogue says of it
export function convertCell({ cell, base, updates }) {
  const first = bytes(base), ds = parseS57(first);
  let info = dsid(first, cell);
  for (const u of updates) { const b = bytes(u); applyUpdate(ds, b); info = { ...info, update: dsid(b, cell).update ?? info.update }; }
  const layers = Object.fromEntries(Object.keys(CLASSES).map((n) => [n, []]));
  for (const f of toGeoJSON(ds, Object.values(CLASSES)).features) {
    if (!f.geometry) continue;
    const name = NAME[f.properties.OBJL];
    const geometry = name === 'SOUNDG' ? { type: 'MultiPoint', coordinates: soundings(ds, f.properties.RCID) } : f.geometry;
    layers[name].push({ type: 'Feature', properties: properties(f.properties), geometry });
  }
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
  return { cell, band: bandOf(cell), bbox, scale: ds.cscl ?? null, ...info, layers };
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
    try { converted = convertCell(c); } catch (e) { warn(`${c.cell}: skipped, ${e.message}`); keepOld(c.cell); continue; }
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
