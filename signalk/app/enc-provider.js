// The webapp's `coastlines/provider` (the import map swaps it in for scene.mjs): the plugin's ENC cells,
// read over the Signal K Resources API, as the land, coastline and depth layers. A view draws from the
// cells of one usage band, the finest whose scale suits its metres per pixel, that meet its bbox. It
// names a gridded band of the coastlines catalogue, so scene.mjs takes its detail path; a view with no
// cell names none, and is drawn from the world, which here is empty: the webapp ships no world geo.
import { islandInfo } from 'portolani/island.mjs';

// where the catalogue and the files are: `${base}` lists the cells, `${base}/<cell>/<CLASS>` is one layer
export const source = { base: '/signalk/v2/api/resources/enc-geojson', fetch: (url) => globalThis.fetch(url) };
export const ENC_BAND = 'gshhg-h-land', NO_BAND = 'enc-none';
const CLASSES = { land: ['LNDARE'], coastline: ['COALNE', 'SLCONS'], depth: ['DEPARE', 'DEPCNT', 'SOUNDG', 'UWTROC', 'WRECKS', 'OBSTRN'] };
// the largest scale denominator each usage band is compiled for (1 overview ... 6 berthing); a view
// draws from the finest band whose cells hold at its scale, up to UNDERSCALE times smaller
export const BAND_SCALE = { 1: Infinity, 2: 1.5e6, 3: 3.5e5, 4: 9e4, 5: 2.2e4, 6: 4e3 };
const UNDERSCALE = 2, PX_M = 0.00028;

let catalogue = null, catalogueLoad = null;
const layers = new Map(); // `${cell}/${CLASS}` -> Promise of its features
export function readCatalogue() {
  // an empty or failed catalogue is not kept: the plugin may still be converting, so the next call asks again
  return catalogueLoad ??= source.fetch(source.base).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    .then((c) => { if (!Object.keys(c).length) catalogueLoad = null; return (catalogue = c); });
}
export function reset() { catalogue = catalogueLoad = null; layers.clear(); slim.clear(); }

const isWorld = (v) => v.lonMin <= -179 && v.lonMax >= 179;
const meets = (v, [w, s, e, n]) => w <= v.lonMax && e >= v.lonMin && s <= v.latMax && n >= v.latMin;
// The cells a view draws from: those meeting its bbox in the finest band that suits its scale
export function cellsFor(view, cat = catalogue) {
  if (!cat || isWorld(view)) return [];
  const met = Object.values(cat).filter((c) => c.bbox && meets(view, c.bbox));
  if (!met.length) return [];
  const denom = view.resolution / PX_M, bands = [...new Set(met.map((c) => c.band))].sort((a, b) => b - a);
  const band = bands.find((b) => denom <= (BAND_SCALE[b] ?? Infinity) * UNDERSCALE) ?? bands.at(-1);
  return met.filter((c) => c.band === band);
}

// A piece of the land the cell cuts at its edge, or one over 1000 km2, is mainland: scene.mjs pigments
// a piece under ISLAND_KM2 as an island (island.mjs), and a cell cuts the mainland into pieces
function landOf(f, bbox) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const edge = ([lon, lat]) => Math.abs(lon - bbox[0]) < 1e-3 || Math.abs(lon - bbox[2]) < 1e-3 || Math.abs(lat - bbox[1]) < 1e-3 || Math.abs(lat - bbox[3]) < 1e-3;
  const main = islandInfo(polys[0]).km2 > 1000 || polys.flat(2).some(edge);
  return main ? { ...f, properties: { ...f.properties, km2: 1e6, hue: 0 } } : f;
}
// the shore is COALNE where it is natural and SLCONS (seawalls, piers, breakwaters) where it is built
const ringsAsLines = (f) => (/Polygon/.test(f.geometry.type)
  ? (f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat(1)).map((r) => ({ ...f, geometry: { type: 'LineString', coordinates: r } }))
  : [f]);

function classOf(cell, cls) {
  const key = `${cell.cell}/${cls}`;
  if (!layers.has(key)) {
    layers.set(key, source.fetch(`${source.base}/${cell.cell}/${cls}`).then((r) => { if (!r.ok) throw new Error(`${key}: ${r.status}`); return r.json(); })
      .then((fc) => {
        const fs = fc.features.filter((f) => f.geometry);
        return cls === 'LNDARE' ? fs.filter((f) => /Polygon/.test(f.geometry.type)).map((f) => landOf(f, cell.bbox))
          : cls === 'SLCONS' ? fs.flatMap(ringsAsLines) : cls === 'COALNE' ? fs.filter((f) => /LineString/.test(f.geometry.type)) : fs;
      })
      .catch((e) => { layers.delete(key); throw e; }));
  }
  return layers.get(key);
}
const wanted = (view, layer) => cellsFor(view).flatMap((c) => (c.layers ? CLASSES[layer].filter((cls) => cls in c.layers) : CLASSES[layer]).map((cls) => [c, cls]));

export function provider() {
  const failed = new Set();
  return {
    bandFor: (view, layer) => (layer in CLASSES && cellsFor(view).length ? ENC_BAND : NO_BAND),
    async pending(view, layer) {
      await readCatalogue();
      const todo = wanted(view, layer).filter(([c, cls]) => !layers.has(`${c.cell}/${cls}`));
      return { band: this.bandFor(view, layer), cells: todo.length, bytes: todo.reduce((s, [c, cls]) => s + (c.layers?.[cls] ?? 0), 0) };
    },
    async loaded(view, layer) {
      await readCatalogue();
      return wanted(view, layer).every(([c, cls]) => layers.has(`${c.cell}/${cls}`) && !failed.has(`${c.cell}/${cls}`));
    },
    async *features(view, layer) {
      if (!(layer in CLASSES)) throw new Error(`unknown layer ${layer}`);
      await readCatalogue();
      const parts = await Promise.all(wanted(view, layer).map(([c, cls]) => classOf(c, cls).catch(() => (failed.add(`${c.cell}/${cls}`), []))));
      for (const fs of parts) yield* fs;
    },
  };
}

// ---------------------------------------------------------------- towns and water names
// The cells' built-up areas (BUAARE) and named sea areas (SEAARE, with OBJNAM), slimmed once a cell to what
// the scene's `places` and `waterNames` options take (scene.mjs withCellData): a town { name, lon, lat, area }
// at its area's most inland point, a name { text, at, km2, box } at its area's most open water.
const KM_DEG = 111.32;
function ringKm2(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return Math.abs(a / 2) * KM_DEG * KM_DEG * Math.cos(((r[0]?.[1] ?? 0) * Math.PI) / 180);
}
// a polygon's parts, the largest first, each its rings and its area
const partsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])
  .map((rings) => ({ rings, km2: ringKm2(rings[0]) - rings.slice(1).reduce((a, r) => a + ringKm2(r), 0) }))
  .sort((a, b) => b.km2 - a.km2);
const inRing = (r, x, y) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c;
  return c;
};
const boxOfRing = (r) => r.reduce((b, [x, y]) => ({ x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
// The point of a polygon farthest from its edges, of a GRID by GRID sampling of its box: where a name reads as inside it
const GRID = 14;
function interiorOf(rings) {
  const b = boxOfRing(rings[0]), k = Math.cos((((b.y0 + b.y1) / 2) * Math.PI) / 180);
  const edges = rings.flatMap((r) => r.slice(1).map((p, i) => [r[i], p]));
  const clear = (x, y) => {
    let m = Infinity;
    for (const [[ax, ay], [bx, by]] of edges) {
      const dx = (bx - ax) * k, dy = by - ay, px = (x - ax) * k, py = y - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, (px * dx + py * dy) / l)) : 0;
      m = Math.min(m, Math.hypot(px - t * dx, py - t * dy));
    }
    return m;
  };
  let best = null, far = -1;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const x = b.x0 + ((i + 0.5) * (b.x1 - b.x0)) / GRID, y = b.y0 + ((j + 0.5) * (b.y1 - b.y0)) / GRID;
    if (!inRing(rings[0], x, y) || rings.slice(1).some((h) => inRing(h, x, y))) continue;
    const d = clear(x, y);
    if (d > far) { far = d; best = [x, y]; }
  }
  return { at: best ?? rings[0][0], box: b };
}
const POINT_DEG = 0.01; // the half-width of the box of an area charted as a point
const pointBox = ([x, y]) => ({ x0: x - POINT_DEG, y0: y - POINT_DEG, x1: x + POINT_DEG, y1: y + POINT_DEG });
function townOf(f) {
  const name = f.properties.OBJNAM ?? '';
  if (f.geometry.type === 'Point') return [{ name, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], area: 0 }];
  const [big] = partsOf(f.geometry);
  if (!big) return [];
  const { at } = interiorOf(big.rings);
  return [{ name, lon: at[0], lat: at[1], area: big.km2 }];
}
function waterOf(f) {
  const text = f.properties.OBJNAM;
  if (!text) return [];
  if (f.geometry.type === 'Point') return [{ text, at: f.geometry.coordinates.slice(0, 2), km2: 0, box: pointBox(f.geometry.coordinates) }];
  const [big] = partsOf(f.geometry);
  if (!big) return [];
  const { at, box } = interiorOf(big.rings);
  return [{ text, at, km2: big.km2, box }];
}
const slim = new Map(); // `${cell}/${CLASS}` -> Promise of its slimmed features
function slimOf(cell, cls, make) {
  const key = `${cell.cell}/${cls}`;
  if (!slim.has(key)) {
    slim.set(key, source.fetch(`${source.base}/${cell.cell}/${cls}`).then((r) => { if (!r.ok) throw new Error(`${key}: ${r.status}`); return r.json(); })
      .then((fc) => fc.features.filter((f) => f.geometry).flatMap(make)).catch(() => { slim.delete(key); return []; }));
  }
  return slim.get(key);
}
// The towns and water names of the cells a view draws from (cellsFor's view: its lon/lat frame and resolution),
// and the cells' extents, which the scene takes as `coverage`: no monster stands off the cells
export async function cellData(view) {
  await readCatalogue();
  const cells = cellsFor(view), has = (cls) => cells.filter((c) => !c.layers || cls in c.layers);
  const [places, waterNames] = await Promise.all([
    Promise.all(has('BUAARE').map((c) => slimOf(c, 'BUAARE', townOf))),
    Promise.all(has('SEAARE').map((c) => slimOf(c, 'SEAARE', waterOf))),
  ]);
  return { places: places.flat(), waterNames: waterNames.flat(), coverage: cells.map((c) => c.bbox) };
}
// cellsFor's view for a scene's: the lon/lat frame of the canvas's corners and edge middles (`invert`, canvas px
// to lon/lat, at any bearing) and the metres a px at its centre
export function frameView(view, invert, w, h) {
  const pts = [[0, 0], [w, 0], [0, h], [w, h], [w / 2, 0], [w / 2, h], [0, h / 2], [w, h / 2]].map(([x, y]) => invert(x, y)).filter((p) => p && p.every(Number.isFinite));
  const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
  return { lat: view.lat, resolution: (2 * Math.PI * 6378137 * Math.cos((view.lat * Math.PI) / 180)) / (512 * 2 ** view.zoom),
    lonMin: Math.min(...lons), lonMax: Math.max(...lons), latMin: Math.min(...lats), latMax: Math.max(...lats) };
}
