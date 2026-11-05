// The webapp's `coastlines/provider` (the import map swaps it in for scene.mjs): the plugin's ENC cells,
// read over the Signal K Resources API, as the land, coastline and depth layers. A view draws from the
// cells of one usage band, the finest whose scale suits its metres per pixel, that meet its bbox. It
// names a gridded band of the coastlines catalogue, so scene.mjs takes its detail path; a view with no
// cell is coastlines' own provider's, over the one world the webapp ships: Natural Earth's 50m land and
// coast. Under the cells that world is drawn too, cut out of the cells' boxes, so a chart is never
// blank past a cell's edge and the 50m coast never fills an ENC's water.
import { islandInfo } from 'portolani/island.mjs';
import { provider as coastlines } from 'coastlines/world-provider';

// where the catalogue and the files are: `${base}` lists the cells, `${base}/<cell>/<CLASS>` is one layer
export const source = { base: '/signalk/v2/api/resources/enc-geojson', fetch: (url) => globalThis.fetch(url) };
export const ENC_BAND = 'gshhg-h-land', NO_BAND = 'enc-none';
const CLASSES = { land: ['LNDARE'], coastline: ['COALNE', 'SLCONS'], depth: ['DEPARE', 'DEPCNT', 'SOUNDG', 'UWTROC', 'WRECKS', 'OBSTRN'] };
// the largest scale denominator each usage band is compiled for (1 overview ... 6 berthing); a view
// draws from the finest band whose cells hold at its scale, up to UNDERSCALE times smaller
export const BAND_SCALE = { 1: Infinity, 2: 1.5e6, 3: 3.5e5, 4: 9e4, 5: 2.2e4, 6: 4e3 };
const UNDERSCALE = 2, PX_M = 0.00028;
// the world files the build ships (app/chart.mjs CHART_GEO); coastlines asks for its band indexes too, and
// a read that rejects is a band it skips, down to these whole files
export const WORLD_FILES = ['data/ne-land-50m.geojson', 'data/ne-coastline-50m.geojson'];
const WORLD_LAYERS = ['land', 'coastline'];
// whether the last view drawn took its land from cells: the page's status line says so when it did not
export const drawnFrom = { cells: 0 };

let catalogue = null, catalogueLoad = null;
const layers = new Map(); // `${cell}/${CLASS}` -> Promise of its features
export function readCatalogue() {
  // an empty or failed catalogue is not kept: the plugin may still be converting, so the next call asks again
  return catalogueLoad ??= source.fetch(source.base).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    .then((c) => { if (!Object.keys(c).length) catalogueLoad = null; return (catalogue = c); });
}
export function reset() { catalogue = catalogueLoad = null; layers.clear(); }

const WORLD_VIEW = { lat: 0, resolution: (2 * Math.PI * 6378137) / 512, lonMin: -180, lonMax: 180, latMin: -90, latMax: 90 }; // zoom 0, as scene.mjs asks for the world
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

// The world outside the cells' boxes, as rectangles: the grid the boxes' edges cut, less the cells that
// lie in a box, each row's runs joined
function outside(boxes, [W, S, E, N]) {
  const xs = [...new Set([W, E, ...boxes.flatMap((b) => [b[0], b[2]])])].filter((x) => x >= W && x <= E).sort((a, b) => a - b);
  const ys = [...new Set([S, N, ...boxes.flatMap((b) => [b[1], b[3]])])].filter((y) => y >= S && y <= N).sort((a, b) => a - b);
  const rects = [];
  for (let j = 0; j + 1 < ys.length; j++) {
    let run = null;
    for (let i = 0; i + 1 < xs.length; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      const inBox = boxes.some((b) => cx > b[0] && cx < b[2] && cy > b[1] && cy < b[3]);
      if (inBox) { if (run) rects.push(run), run = null; } else if (run) run[2] = xs[i + 1]; else run = [xs[i], ys[j], xs[i + 1], ys[j + 1]];
    }
    if (run) rects.push(run);
  }
  return rects;
}
// A ring cut to a rectangle (Sutherland-Hodgman, one edge at a time); fewer than four points is nothing
function clipRing(ring, [x0, y0, x1, y1]) {
  const edges = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]]];
  let pts = ring.slice(0, -1);
  for (const [inside, cross] of edges) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length], b = pts[i];
      if (inside(b)) { if (!inside(a)) out.push(cross(a, b)); out.push(b); } else if (inside(a)) out.push(cross(a, b));
    }
    if (!(pts = out).length) return null;
  }
  return pts.length >= 3 ? [...pts, pts[0]] : null;
}
// A line cut to a rectangle, as the runs inside it (Liang-Barsky per segment)
function clipLine(line, [x0, y0, x1, y1]) {
  const runs = [];
  let run = null;
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i], [bx, by] = line[i + 1], dx = bx - ax, dy = by - ay;
    let t0 = 0, t1 = 1;
    const ok = [[-dx, ax - x0], [dx, x1 - ax], [-dy, ay - y0], [dy, y1 - ay]].every(([p, q]) => {
      if (p === 0) return q >= 0;
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
      return true;
    });
    if (!ok) { run = null; continue; }
    const a = [ax + t0 * dx, ay + t0 * dy], b = [ax + t1 * dx, ay + t1 * dy];
    if (!run || t0 > 0) runs.push(run = [a]);
    run.push(b);
    if (t1 < 1) run = null;
  }
  return runs.filter((r) => r.length > 1);
}
const boxMeets = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
// a ring's extent and a polygon's island, worked out once per ring: the world is the same arrays every redraw
const extents = new WeakMap(), islands = new WeakMap();
const extent = (pts) => extents.get(pts) ?? extents.set(pts, pts.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity])).get(pts);
const islandOf = (poly) => islands.get(poly[0]) ?? islands.set(poly[0], islandInfo(poly)).get(poly[0]);
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const linesOf = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
// The world's features of a layer near a view, cut out of the cells' boxes: a polygon keeps the area and
// colour of its whole island, as a cell's pieces do
function* worldBeside(features, layer, view, boxes) {
  const m = 1, frame = [view.lonMin - m, view.latMin - m, view.lonMax + m, view.latMax + m];
  const rects = outside(boxes, frame);
  for (const f of features) {
    if (layer === 'land') for (const poly of polysOf(f.geometry)) {
      if (!boxMeets(extent(poly[0]), frame)) continue;
      const isl = islandOf(poly);
      for (const r of rects) {
        const outer = clipRing(poly[0], r);
        if (!outer) continue;
        const holes = poly.slice(1).map((h) => clipRing(h, r)).filter(Boolean);
        yield { type: 'Feature', properties: { km2: isl.km2, hue: isl.hue }, geometry: { type: 'Polygon', coordinates: [outer, ...holes] } };
      }
    }
    else for (const line of linesOf(f.geometry)) {
      if (!boxMeets(extent(line), frame)) continue;
      for (const r of rects) for (const run of clipLine(line, r)) yield { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: run } };
    }
  }
}

export function provider({ read } = {}) {
  const failed = new Set();
  const world = coastlines({ read: (p) => (WORLD_FILES.includes(p) && read ? read(p) : Promise.reject(new Error(`${p}: 404, not shipped`))) });
  const worldsOwn = (view, layer) => WORLD_LAYERS.includes(layer) && !cellsFor(view).length;
  const collect = async (it) => { const out = []; for await (const f of it) out.push(f); return out; };
  const whole = new Map(); // layer -> the world's whole file, read once (a failed read is not kept)
  const wholeOf = (layer) => whole.get(layer) ?? whole.set(layer, collect(world.features(WORLD_VIEW, layer)).catch((e) => { whole.delete(layer); throw e; })).get(layer);
  return {
    bandFor: (view, layer) => (worldsOwn(view, layer) ? world.bandFor(view, layer) : layer in CLASSES && cellsFor(view).length ? ENC_BAND : NO_BAND),
    async pending(view, layer) {
      await readCatalogue();
      if (worldsOwn(view, layer)) return world.pending(view, layer);
      const todo = wanted(view, layer).filter(([c, cls]) => !layers.has(`${c.cell}/${cls}`));
      return { band: this.bandFor(view, layer), cells: todo.length, bytes: todo.reduce((s, [c, cls]) => s + (c.layers?.[cls] ?? 0), 0) };
    },
    async loaded(view, layer) {
      await readCatalogue();
      if (worldsOwn(view, layer)) return world.loaded(view, layer);
      return wanted(view, layer).every(([c, cls]) => layers.has(`${c.cell}/${cls}`) && !failed.has(`${c.cell}/${cls}`));
    },
    async *features(view, layer) {
      if (!(layer in CLASSES)) throw new Error(`unknown layer ${layer}`);
      await readCatalogue();
      const cells = cellsFor(view);
      if (layer === 'land') drawnFrom.cells = cells.length;
      if (worldsOwn(view, layer)) { yield* world.features(view, layer); return; }
      // the world beneath, cut out of the boxes: the whole 50m file, as coastlines vends it to a zoomed-out view
      if (WORLD_LAYERS.includes(layer)) yield* worldBeside(await wholeOf(layer), layer, view, cells.map((c) => c.bbox));
      const parts = await Promise.all(wanted(view, layer).map(([c, cls]) => classOf(c, cls).catch(() => (failed.add(`${c.cell}/${cls}`), []))));
      for (const fs of parts) yield* fs;
    },
  };
}
