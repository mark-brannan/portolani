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
export function reset() { catalogue = catalogueLoad = null; layers.clear(); }

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
