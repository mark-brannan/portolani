// Portolani mockup scene: placement (buildScene) and draw order (drawScene), independent of where
// it runs. A host (scripts/render.mjs in Node, public/page.js in a browser) supplies an
// environment: createCanvas(w, h), readJSON(path), loadImage(path), loadFont(). Paths are logical:
// `geo/<id>.geojson`, a coastlines data id, `geo/<band>/<cell>.json`, a detail cell cut by
// scripts/build-preview.mjs (close views only), and `packs/<pack>/<file>`. Land, wash, coast and
// lattice are drawn in lon/lat through coast-wright, so any view or projection draws the same way.
// A view is a centre, zoom and projection, { lon, lat, zoom, projection }, on a W x H canvas; the
// projection is one of PROJECTIONS, Mercator when left out.

import { fill, trace, limn, rhumb, place, letter, geojsonPolygons, geojsonRings } from 'coast-wright';
import { islandInfo, ISLAND_KM2 } from './island.mjs';
import { cityPlan, drawCity, drawHouses, pxRings, insideRings } from './city.mjs';
import { urbanKey } from './urban.mjs';
import { RIVERS, LAKES, RIVER_STYLES, LAKE_STYLES, waterOf, shown } from './water.mjs';

let env;
const createCanvas = (w, h) => env.createCanvas(w, h);

// ---------------------------------------------------------------- style

const STYLE = {
  parchment: '#e9d8b4',
  rim: '#c9ad7a',
  land: '#dcc49c',
  ink: '#3b2a1a',
  windGreen: '#4f6b3a',
  windRed: '#8c2f1e',
  gilt: '#b58a3c',
  // period pigments for the land treatments (LANDS)
  red: '#a8432e',
  green: '#6b8a4a',
  greenEdge: '#3f5a2e',
  ochre: '#c47f2c',
  gold: '#c9a13b',
  rose: '#c98a7f', // with red and green, the lakes drawn as lozenges (water.mjs)
  terracotta: '#b8613f', // town footprints
  coastWidth: 1.5,
  washWidth: 5,
  rhumbAlpha: 0.3,
  rhumbWidth: 0.75,
  landMode: 'islands', // one of LANDS, set by createScene
  rivers: 'off', // one of RIVER_STYLES, set by createScene
  lakes: 'off', // one of LAKE_STYLES, set by createScene
  font: 'IM Fell English',
  fonts: ['IM Fell English', 'Georgia', 'serif'], // the stack names are lettered in; the first is loaded
};

const W = 1600, H = 1000;
const FRAME = { lonMin: -6, lonMax: 20, latMin: 34, latMax: 46 };
const MARGIN = 2; // degrees beyond FRAME whose features the scene keeps
const DETAIL = { lon: 8.93, lat: 44.41, scale: 2 }; // Genoa; window clamped to the scene
// Whole world at the far end; 50m data holds to about z9. Past each band's zoom a view draws from
// that band's cells (geo/<dir>/<xi>_<yi>.json, `cell` degrees square) within `margin` degrees of
// its frame, a couple of screens at the band's first zoom, so a pan stays on loaded cells; a band
// whose index the site lacks is skipped and the one below it drawn instead. Measured vertex
// spacing (median, m): 50m 7,650; NE 10m 1,574; GSHHG h 707. Must match scripts/build-preview.mjs.
const BANDS = [
  { dir: '10m', zoom: 9, cell: 5, margin: 2 }, // Natural Earth 10m, holds to about z12 but has no narrow channels
  { dir: 'h', zoom: 10, cell: 1, margin: 0.5 }, // GSHHG 2.3.7 "h" land, holds to about z13; draws Seattle's ship canal
  { dir: 'f', zoom: 12, cell: 0.5, margin: 0.25 }, // GSHHG 2.3.7 "f" land, the full resolution; the canal's real shape
];
const ZOOM = { min: 1, max: 15 };
const URBAN_PX = 56; // screen px a built-up area's long side reaches before it is drawn

// Land treatments after the period charts: 'gilt' (today's wash), 'green' (Oliva, c.1590), 'ochre'
// with a dotted shoal line off the coast (Benincasa, 1466) and 'islands' (Beccari, 1403): an ochre
// coast wash and every island under ISLAND_KM2 filled red, green or gold, each keeping its colour.
export const LANDS = ['islands', 'gilt', 'green', 'ochre'];
const LAND_WASH = { gilt: STYLE.gilt, green: STYLE.green, ochre: STYLE.ochre, islands: STYLE.ochre };
const SHOAL_OFFSET = 4, SHOAL_GAP = 6; // px seaward of the coast, and between dots
let redSeaPolys = null; // the Red Sea to tint, or null
// Rivers and lakes (water.mjs), from the 50m files at every zoom, loaded once the first style that
// draws them is chosen; a lake or river is drawn where its box meets the view widened by WATER_PX.
let water = null, waterLoad = null;
const WATER_PX = 64; // a lozenge and its tributaries reach past the lake they stand for
const loadWater = () => (waterLoad ??= Promise.all(['ne-rivers-lake-centerlines-50m', 'ne-lakes-50m'].map(loadGeo))
  .then(([r, l]) => waterOf(r, l)).catch((e) => { waterLoad = null; throw e; })); // a failed fetch is tried again
const DETAIL_ZOOM = BANDS[0].zoom;

// Per-run tuning; `density` scales how much ornament is placed (1 = the committed mockup).
const TUNE = { monsterMax: 4, shipMax: 2, townGap: 48, mountainMax: 3 };

const CELL = 16;             // clearance field cell, px
const MONSTER_GAP = 220;     // min centre spacing between monsters, px
const RHUMB_NODES = 16;
const RHUMB_RAYS = 32;

// ---------------------------------------------------------------- utilities

function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

const RAD = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercLat = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;
const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
// Offset from the centre within +-180 as coast-wright's seam guard takes it: +180 stays on the right.
const fromCentre = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
const kOf = (zoom) => (512 * 2 ** zoom) / (2 * Math.PI); // px per radian of longitude

// Cylindrical projections: x is longitude, the same in each, and y is f(lat) in radians of
// longitude, with inv its inverse and max the y of the map's top edge. Rhumb lines are straight
// only on Mercator, which is why he drew it; on the others they bow toward the poles.
const PROJECTIONS = {
  mercator: { f: mercY, inv: mercLat, max: Math.PI }, // Web Mercator's square, to 85.05 degrees
  'plate-carree': { f: (lat) => lat * RAD, inv: (y) => y / RAD, max: Math.PI / 2 },
  miller: {
    f: (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * RAD)),
    inv: (y) => (2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI) / RAD,
    max: 1.25 * Math.log(Math.tan(0.45 * Math.PI)),
  },
  // Gall-Peters: equal-area, true scale at 45 degrees; here scaled so x matches the others
  'equal-area': { f: (lat) => 2 * Math.sin(lat * RAD), inv: (y) => Math.asin(y / 2) / RAD, max: 2 },
};
const projectionOf = (view) => PROJECTIONS[Object.hasOwn(PROJECTIONS, view.projection) ? view.projection : 'mercator'];

// The view's projection centred on it; longitudes are measured from its centre, so any seam is behind it.
function makeProjection(view, w = W, h = H) {
  const P = projectionOf(view), k = kOf(view.zoom), lonCenter = view.lon, y0 = P.f(view.lat);
  // x(lon, lat) and y(lat, lon), as coast-wright calls them
  const x = (lon) => w / 2 + fromCentre(lon - lonCenter) * RAD * k;
  const y = (lat) => h / 2 - (P.f(lat) - y0) * k;
  return {
    k, zoom: view.zoom, lonCenter, x, y,
    project: (lon, lat) => [x(lon), y(lat)],
    // a point past the map's top or bottom edge inverts to the edge's latitude
    invert: (px, py) => [lonCenter + (px - w / 2) / k / RAD, P.inv(Math.max(-P.max, Math.min(P.max, y0 - (py - h / 2) / k)))],
  };
}

// The view that covers a lon/lat frame, centred on it.
function viewOfFrame(frame) {
  const y0 = (mercY(frame.latMin) + mercY(frame.latMax)) / 2;
  const k = Math.max(W / ((frame.lonMax - frame.lonMin) * RAD), H / (mercY(frame.latMax) - mercY(frame.latMin)));
  return { lon: (frame.lonMin + frame.lonMax) / 2, lat: mercLat(y0), zoom: Math.log2((k * 2 * Math.PI) / 512) };
}
const DEFAULT_VIEW = viewOfFrame(FRAME);

// Zoom within ZOOM, longitude wrapped, projection one of PROJECTIONS, and the centre kept far
// enough from the poles that the canvas stays on the map, or centred on the equator once the
// whole map is shorter than the canvas.
function clampView({ lon, lat, zoom, projection }) {
  zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom));
  projection = Object.hasOwn(PROJECTIONS, projection) ? projection : 'mercator';
  const P = PROJECTIONS[projection], room = Math.max(0, P.max - H / 2 / kOf(zoom));
  return { lon: wrapLon(lon), lat: P.inv(Math.max(-room, Math.min(room, P.f(lat)))), zoom, projection };
}

// The view moved so the map follows a drag of (dx, dy) canvas px.
function panView(view, dx, dy) {
  const P = projectionOf(view), k = kOf(view.zoom);
  return clampView({ ...view, lon: view.lon - dx / k / RAD, lat: P.inv(P.f(view.lat) + dy / k) });
}

// The view zoomed by `factor` about canvas point (px, py), which keeps its place on the map.
function zoomView(view, factor, px, py) {
  const P = projectionOf(view), k = kOf(view.zoom), ox = px - W / 2, oy = py - H / 2;
  const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, view.zoom + Math.log2(factor))), k2 = kOf(zoom);
  const lon = view.lon + (ox / k - ox / k2) / RAD;
  return clampView({ ...view, lon, lat: P.inv(P.f(view.lat) - oy / k + oy / k2), zoom });
}

// The lon/lat frame a projection paints, widened by `margin` degrees.
function frameOf(proj, margin) {
  const half = W / 2 / proj.k / RAD;
  return {
    lonMin: proj.lonCenter - half - margin, lonMax: proj.lonCenter + half + margin,
    latMin: proj.invert(0, H)[1] - margin, latMax: proj.invert(0, 0)[1] + margin,
  };
}
// At any of a longitude's 360-degree copies, so a frame may run past the antimeridian.
const SHIFTS = [-360, 0, 360];
const nearLL = (f, lon, lat) => lat > f.latMin && lat < f.latMax && SHIFTS.some((s) => lon + s > f.lonMin && lon + s < f.lonMax);
const meetsLL = (f, b) => b.y1 > f.latMin && b.y0 < f.latMax && SHIFTS.some((s) => b.x1 + s > f.lonMin && b.x0 + s < f.lonMax);

// Oriented boxes for overlap tests: centre, unit axis u, half-extents.
function obb(cx, cy, angle, hw, hh) {
  return { cx, cy, ux: Math.cos(angle), uy: Math.sin(angle), hw, hh };
}
function obbOverlap(a, b) {
  const axes = [[a.ux, a.uy], [-a.uy, a.ux], [b.ux, b.uy], [-b.uy, b.ux]];
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  for (const [ax, ay] of axes) {
    const ra = a.hw * Math.abs(a.ux * ax + a.uy * ay) + a.hh * Math.abs(-a.uy * ax + a.ux * ay);
    const rb = b.hw * Math.abs(b.ux * ax + b.uy * ay) + b.hh * Math.abs(-b.uy * ax + b.ux * ay);
    if (Math.abs(dx * ax + dy * ay) > ra + rb) return false;
  }
  return true;
}
const obbInside = (o, m = 4) => {
  const ex = o.hw * Math.abs(o.ux) + o.hh * Math.abs(o.uy), ey = o.hw * Math.abs(o.uy) + o.hh * Math.abs(o.ux);
  return o.cx - ex >= m && o.cx + ex <= W - m && o.cy - ey >= m && o.cy + ey <= H - m;
};

// ---------------------------------------------------------------- data

const loadGeo = (id) => env.readJSON(`geo/${id}.geojson`);

// The whole world, parsed once per data set, each shape with its lon/lat box; coast lines also
// split into short runs, which is what a frame drawn while dragging walks.
const worlds = new WeakMap();
async function loadWorld() {
  // the urban footprints (scripts/urban.mjs) are optional: a site without them draws every town as an icon;
  // so are the 50m urban areas, which wash the built-up ground of a town without a footprint
  const missing = (e) => { if (!/404|ENOENT|no urban/.test(String(e?.code ?? e?.message ?? e))) throw e; return null; };
  const [landGeo, coastGeo, placesGeo, namesGeo, urban, urbanGeo] = await Promise.all(
    [...['ne-land-50m', 'ne-coastline-50m', 'ne-populated-places-50m'].map(loadGeo), env.readJSON('geo/names-50m.json'),
      env.readJSON('geo/urban-10m.json').catch(missing), loadGeo('ne-urban-areas-50m').catch(missing)]);
  let world = worlds.get(landGeo);
  if (world) return world;
  const land = geojsonPolygons(landGeo).map((poly) => ({ poly: Object.assign(poly, { isl: islandInfo(poly) }), box: bbox(poly[0]) }));
  const lines = geojsonRings(coastGeo).map((line) => ({ line, box: bbox(line) }));
  const runs = lines.flatMap(({ line }) => coastRuns(line).map((run) => ({ run, box: bbox(run) })));
  const places = placesGeo.features
    .filter((f) => f.properties.SCALERANK <= 4)
    .map(({ properties: p, geometry: { coordinates: [lon, lat] } }) => {
      const rings = urban?.[urbanKey(p.NAME, lon, lat)];
      return { name: p.NAME, rank: p.SCALERANK, pop: p.POP_MAX, area: p.MAX_AREAKM, lon, lat, ...(rings && { urban: rings, ubox: bbox(rings.flat()) }) };
    });
  // seas at a point, countries along each stretch of their coast (scripts/names.mjs)
  const names = namesGeo.features.map(({ properties: p, geometry: g }) => {
    const pts = g.type === 'Point' ? [g.coordinates] : g.coordinates;
    return { text: p.name, at: g.coordinates, land: p.land, kind: p.kind, rank: p.rank, min: p.min, box: bbox(pts) };
  });
  // the built-up areas washed under the towns: a town's own 10m footprint, the ground its city plan's lots
  // stand on, and the coarse 50m areas only where no footprint lies
  const footprints = places.filter((p) => p.urban).map((p) => ({ poly: p.urban, box: p.ubox }));
  const urbanAreas = [...footprints, ...(urbanGeo ? geojsonPolygons(urbanGeo).map((poly) => ({ poly, box: bbox(poly[0]) }))
    .filter((u) => !footprints.some((t) => meets(t.box, u.box))) : [])];
  world = { land, lines, runs, places, names, urban: urbanAreas };
  worlds.set(landGeo, world);
  return world;
}

// The band a view draws from: the closest one whose zoom it has passed and whose index is not known
// to be missing (an index not yet asked for counts as present; loadDetail asks before choosing).
const bandIndex = new Map(); // dir -> Set of cell keys, or null when the site has no such band
const bandFor = (zoom) => BANDS.filter((b) => zoom > b.zoom && bandIndex.get(b.dir) !== null).at(-1);
async function loadBandIndex(band) {
  if (!bandIndex.has(band.dir)) {
    bandIndex.set(band.dir, env.readJSON(`geo/${band.dir}/index.json`).then((i) => new Set(i.cells)).catch(() => null));
  }
  return (bandIndex.set(band.dir, await bandIndex.get(band.dir)), bandIndex.get(band.dir));
}

// The detail world around a view: the band's cells that meet its frame widened by its margin, each
// fetched and boxed once, with the 50m places.
const cells = new Map();
const cellKey = (xi, yi) => `${xi}_${yi}`;
async function loadDetail(coarse, view) {
  for (const b of BANDS) if (view.zoom > b.zoom) await loadBandIndex(b);
  const band = bandFor(view.zoom);
  if (!band) return coarse;
  const known = bandIndex.get(band.dir);
  const f = frameOf(makeProjection(view), band.margin), deg = band.cell, n = 360 / deg;
  const keys = new Set();
  for (let xi = Math.floor(f.lonMin / deg); xi <= Math.floor(f.lonMax / deg); xi++) {
    const wx = ((((xi + n / 2) % n) + n) % n) - n / 2; // wrapped across the antimeridian
    for (let yi = Math.max(-90 / deg, Math.floor(f.latMin / deg)); yi <= Math.min(90 / deg - 1, Math.floor(f.latMax / deg)); yi++) {
      if (known.has(cellKey(wx, yi))) keys.add(`${band.dir}/${cellKey(wx, yi)}`);
    }
  }
  const parts = await Promise.all([...keys].map((k) => {
    if (!cells.has(k)) {
      cells.set(k, env.readJSON(`geo/${k}.json`).then((c) => {
        const lines = c.coast.map((line) => ({ line, box: bbox(line) }));
        return {
          // each piece carries its island's area and colour from the cut (a cell without them works one out from the piece)
          land: c.land.map((poly, i) => ({ poly: Object.assign(poly, { isl: c.m ? { km2: c.m[i][0], hue: c.m[i][1] } : islandInfo(poly) }), box: bbox(poly[0]) })),
          lines,
          runs: lines.flatMap(({ line }) => coastRuns(line).map((run) => ({ run, box: bbox(run) }))),
        };
      }).catch((e) => { cells.delete(k); throw e; })); // a failed fetch is tried again at the next stop
    }
    return cells.get(k);
  }));
  return {
    land: parts.flatMap((p) => p.land), lines: parts.flatMap((p) => p.lines), runs: parts.flatMap((p) => p.runs),
    places: coarse.places, names: coarse.names, urban: coarse.urban, detail: { ...f, band: band.dir }, // the lon/lat frame the loaded cells cover, and whose
  };
}

// Whether a moving view can be drawn from `world`: 50m always; a band's cells only while the view
// would still choose that band and sits inside the frame they were loaded for, so a long drag or a
// zoom across a band edge shows the 50m coast rather than an empty sea or a coarser cell.
function covers(world, view) {
  if (!world.detail) return true;
  if (bandFor(view.zoom)?.dir !== world.detail.band) return false;
  const d = world.detail, f = frameOf(makeProjection(view), 0);
  return f.latMin >= d.latMin && f.latMax <= d.latMax && SHIFTS.some((s) => f.lonMin + s >= d.lonMin && f.lonMax + s <= d.lonMax);
}

// Even-odd point in ring, [lon, lat].
function insideRing(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < xj + ((lat - yj) * (xi - xj)) / (yi - yj)) inside = !inside;
  }
  return inside;
}

// What a view keeps of the world: the shapes with a point within MARGIN degrees of its frame.
function viewData(world, view) {
  const proj = makeProjection(view);
  const f = frameOf(proj, MARGIN);
  const near = ([lon, lat]) => nearLL(f, lon, lat);
  // or that holds the view's centre, so a view far inland keeps the land it sits on
  const centre = (l) => SHIFTS.some((s) => insideRing(l.poly[0], view.lon + s, view.lat));
  const land = world.land.filter((l) => meetsLL(f, l.box) && (l.poly.some((ring) => ring.some(near)) || centre(l))).map((l) => l.poly);
  const coastLL = world.lines.filter((l) => meetsLL(f, l.box) && l.line.some(near)).map((l) => l.line); // [lon, lat] lines
  // px, for placement; a line is broken where it jumps the seam behind the view
  const coast = coastLL.flatMap((line) => {
    const out = [[]];
    for (const [lon, lat] of line) {
      const p = proj.project(lon, lat), cur = out[out.length - 1], prev = cur[cur.length - 1];
      if (prev && Math.abs(p[0] - prev[0]) > Math.PI * proj.k) out.push([p]); else cur.push(p);
    }
    return out.filter((l) => l.length > 1);
  });
  const places = world.places.filter((p) => nearLL(f, p.lon, p.lat)).map((p) => ({ ...p, xy: proj.project(p.lon, p.lat) }));
  // names worth showing at this zoom (Natural Earth's min_label), most important first
  const names = world.names.filter((n) => n.min <= view.zoom + 1 && meetsLL(f, n.box))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'sea' ? -1 : 1) || a.rank - b.rank);
  const urban = world.urban.filter((u) => meetsLL(f, u.box)).map((u) => u.poly);
  return { proj, land, coastLL, coast, places, names, urban };
}

// Two packs draw the same designs two ways: `vivid` as vectors, `scanned` as crops of the scans. A
// sprite's `style` names its design family; a scene picks a rendering, then a style for each kind.
const PACK_NAMES = ['vivid', 'scanned'];
async function readManifests(environment = env) {
  const ms = await Promise.all(PACK_NAMES.map((n) => environment.readJSON(`packs/${n}/pack.json`)));
  return Object.fromEntries(PACK_NAMES.map((n, i) => [n, ms[i]]));
}

// The sprites of one kind and style a rendering draws: its own pack's, else the other pack's, so a
// design drawn only one way still shows; `plain` draws no pictures.
function spritesOf(manifests, rendering, kind, style) {
  if (rendering === 'plain') return [];
  for (const name of rendering === 'scanned' ? ['scanned', 'vivid'] : ['vivid', 'scanned']) {
    const m = manifests[name], found = m.sprites.filter((s) => s.kind === kind && s.style === style);
    if (found.length) return found.map((s) => ({ ...s, pack: name, colour: m.colour ?? 'source' }));
  }
  return [];
}

// What a scene draws, chosen from the manifests before any picture is fetched. A style no pack has
// falls back to the default family; ships follow the monster style, or the default family's ships.
// Empty roses or no cartouche mean the shapes drawn in code (PLAIN); no town sprites, the tower.
// Mountains have one family so far, `catalan`; they are fetched only when the kind is shown.
function chooseSprites(manifests, { rendering = 'vivid', rose = 'aguiar', monster = 'carta-marina', town = 'tower' } = {}) {
  const pick = (kind, style, fallback) => {
    const found = spritesOf(manifests, rendering, kind, style);
    return found.length || !fallback ? found : spritesOf(manifests, rendering, kind, fallback);
  };
  return {
    roses: pick('rose', rose, 'aguiar'),
    cartouche: pick('cartouche', 'dewit')[0] ?? null, // the cartouche follows the rendering
    monsters: pick('monster', monster, 'carta-marina'),
    ships: pick('ship', monster, 'carta-marina'),
    towns: town === 'tower' ? [] : pick('town', town),
    mountains: pick('mountain', 'catalan'),
    tower: town === 'tower' || !pick('town', town).length,
  };
}

// Sprites by key, `<pack>/<id>`, since ids repeat across packs (scanned/serpent-a, vivid/serpent-a).
// The shapes drawn in code are the pseudo-pack `plain`: its rose set, its cartouche frame, the tower.
const PLAIN_SPRITES = [
  { id: 'rose', kind: 'rose', style: 'plain' },
  { id: 'cartouche', kind: 'cartouche', style: 'plain' },
  { id: 'tower', kind: 'town', style: 'tower' },
].map((s) => ({ ...s, key: `plain/${s.id}`, pack: 'plain', file: null }));
const spriteList = (manifests) => [
  ...PACK_NAMES.flatMap((pack) => manifests[pack].sprites.map((s) => ({ ...s, key: `${pack}/${s.id}`, pack, colour: manifests[pack].colour ?? 'source' }))),
  ...PLAIN_SPRITES,
];

// Every sprite a page can offer, each { key, pack, id, kind, style, file, ... }: only the manifests are read.
async function listSprites(environment) {
  return spriteList(await readManifests(environment));
}

// The selection a scene draws when given none, by rule so sprites added to a pack join their family:
// the vivid Aguiar roses and cartouche, the monsters of the scanned Carta Marina and Paré families and
// the drawn heraldic one, every ship, every town (the tower included) and every mountain.
const DEFAULT_RULES = [
  (s) => s.pack === 'vivid' && s.kind === 'rose' && s.style === 'aguiar',
  (s) => s.pack === 'vivid' && s.kind === 'cartouche',
  (s) => s.kind === 'monster' && ((s.pack === 'scanned' && (s.style === 'carta-marina' || s.style === 'pare')) || (s.pack === 'vivid' && s.style === 'heraldic')),
  (s) => s.kind === 'ship',
  (s) => s.kind === 'town',
  (s) => s.kind === 'mountain',
];
function defaultSprites(list) {
  const keys = list.filter((s) => DEFAULT_RULES.some((rule) => rule(s))).map((s) => s.key);
  const cartouche = keys.find((k) => list.find((s) => s.key === k).kind === 'cartouche');
  return keys.filter((k) => list.find((s) => s.key === k).kind !== 'cartouche' || k === cartouche); // one cartouche
}

// What a selection of keys draws, in chooseSprites's shape plus `tower`; unknown keys are ignored.
// The first selected cartouche is the one; plain/rose and plain/cartouche are the PLAIN shapes.
function selectSprites(manifests, keys) {
  const want = new Set(keys), chosen = spriteList(manifests).filter((s) => want.has(s.key));
  const of = (kind) => chosen.filter((s) => s.kind === kind).flatMap((s) => (s.pack !== 'plain' ? [s] : kind === 'rose' ? PLAIN.filter((p) => p.kind === 'rose') : []));
  return {
    roses: of('rose'),
    cartouche: chosen.find((s) => s.kind === 'cartouche' && s.pack !== 'plain') ?? (want.has('plain/cartouche') ? PLAIN.find((s) => s.kind === 'cartouche') : null),
    monsters: of('monster'), ships: of('ship'), towns: of('town'), mountains: of('mountain'),
    tower: want.has('plain/tower'),
  };
}

// The styles the packs offer, for a page's settings: only the manifests are read.
async function listStyles(environment) {
  const ms = Object.values(await readManifests(environment));
  const of = (...kinds) => [...new Set(ms.flatMap((m) => m.sprites.filter((s) => kinds.includes(s.kind)).map((s) => s.style)))];
  return { rose: of('rose'), monster: of('monster', 'ship'), town: ['tower', ...of('town')] };
}

// A chosen sprite with its picture: a source-colour pack is drawn as scanned; an ink pack is filled
// with the ink of the day.
async function withImage(s) {
  if (s.plain) return s; // drawn in code: no picture
  const img = await env.loadImage(`packs/${s.pack}/${s.file}`);
  return normalized({ ...s, img, tinted: s.colour === 'source' ? img : tint(img, STYLE.ink) });
}

// Sizes within a kind are set by the ink, not by the file or the manifest, so drawings cut from
// different charts with different margins and detail stand together. A sprite's footprint is the
// geometric mean of its inked box's sides; a monster or ship is drawn so its footprint is its kind's
// (FOOTPRINT), its long side at most LONG_SIDE of that; a town stands so its footprint at size 1 is
// FOOTPRINT.town, and keeps `grandeur`, the footprint its manifest's `heightPx` gave it, to rank it
// against its family-mates (townVariant).
const FOOTPRINT = { monster: 140, ship: 76, town: 40 };
const LONG_SIDE = 1.5;
function normalized(s) {
  const target = FOOTPRINT[s.kind];
  if (!target) return s;
  const [iw, ih] = inkBox(s.tinted), f = Math.sqrt(iw * ih), { width: W0, height: H0 } = s.img;
  if (s.kind === 'town') return { ...s, heightPx: (target * H0) / f, grandeur: ((s.heightPx ?? TOWN_H) * f) / H0 };
  return { ...s, sizePx: Math.min((target * W0) / f, (LONG_SIDE * target * W0) / Math.max(iw, ih)) };
}

// The inked box of a picture, its sides in the picture's own px: where it darkens the sheet by
// more than 0.3 (alpha times darkness), so a scan's pale wash does not count; drawn at most 256 px a side.
function inkBox(img) {
  const k = Math.min(1, 256 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
  const g = createCanvas(w, h).getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  const a = g.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (dark(a, (y * w + x) * 4) > 0.3) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? [img.width, img.height] : [(x1 - x0 + 1) / k, (y1 - y0 + 1) / k];
}
const dark = (a, i) => (a[i + 3] / 255) * (1 - (0.3 * a[i] + 0.59 * a[i + 1] + 0.11 * a[i + 2]) / 255);

// An ink mask filled with the pack ink, alpha kept: ready to composite with `multiply`.
function tint(img, ink) {
  const c = createCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = ink;
  g.fillRect(0, 0, img.width, img.height);
  return c;
}

// ---------------------------------------------------------------- clearance field

const traceLand = (g, data, polys = data.land) => trace(g, polys, data.proj.x, data.proj.y, { lonCenter: data.proj.lonCenter });

// Chamfer distance (1, sqrt2), in px, from every cell of a cols x rows grid of CELL px to the
// nearest cell where `seed(i)` holds.
function chamfer(cols, rows, seed) {
  const INF = 1e9, d = new Float32Array(cols * rows);
  for (let i = 0; i < cols * rows; i++) d[i] = seed(i) ? 0 : INF;
  const D = Math.SQRT2;
  const relax = (i, j, w) => { if (d[j] + w < d[i]) d[i] = d[j] + w; };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = y * cols + x;
    if (x > 0) relax(i, i - 1, 1);
    if (y > 0) { relax(i, i - cols, 1); if (x > 0) relax(i, i - cols - 1, D); if (x < cols - 1) relax(i, i - cols + 1, D); }
  }
  for (let y = rows - 1; y >= 0; y--) for (let x = cols - 1; x >= 0; x--) {
    const i = y * cols + x;
    if (x < cols - 1) relax(i, i + 1, 1);
    if (y < rows - 1) { relax(i, i + cols, 1); if (x < cols - 1) relax(i, i + cols + 1, D); if (x > 0) relax(i, i + cols - 1, D); }
  }
  for (let i = 0; i < d.length; i++) d[i] *= CELL;
  return d;
}

// Land rasterised at CELL px; chamfer distance (1, sqrt2) from every sea cell to land, in px.
function clearanceField(data) {
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const c = createCanvas(cols, rows);
  const g = c.getContext('2d');
  g.scale(1 / CELL, 1 / CELL);
  g.fillStyle = '#000';
  traceLand(g, data);
  g.fill('evenodd');
  g.strokeStyle = '#000';
  g.lineWidth = CELL; // keeps islands smaller than a cell
  for (const line of data.coast) { g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  const px = g.getImageData(0, 0, cols, rows).data;

  const d = chamfer(cols, rows, (i) => px[i * 4 + 3] > 40);

  const at = (x, y) => {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor(x / CELL))), cy = Math.min(rows - 1, Math.max(0, Math.floor(y / CELL)));
    return d[cy * cols + cx];
  };
  const cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push({ x: (x + 0.5) * CELL, y: (y + 0.5) * CELL, land: d[y * cols + x] });
  // gradient points away from land; the coast tangent is its perpendicular
  const grad = (x, y) => [at(x + CELL, y) - at(x - CELL, y), at(x, y + CELL) - at(x, y - CELL)];

  // exact land at FINE px, for landward tests and sprite footprints
  const FINE = 4, fc = Math.ceil(W / FINE), fr = Math.ceil(H / FINE);
  const f = createCanvas(fc, fr), fg = f.getContext('2d');
  fg.scale(1 / FINE, 1 / FINE);
  traceLand(fg, data);
  fg.fill('evenodd');
  const fpx = fg.getImageData(0, 0, fc, fr).data;
  const isLand = (x, y) => {
    const cx = Math.floor(x / FINE), cy = Math.floor(y / FINE);
    return cx >= 0 && cy >= 0 && cx < fc && cy < fr && fpx[(cy * fc + cx) * 4 + 3] > 127;
  };
  // does an ellipse inscribed in a w x h box touch land or leave the frame?
  const footprintBlocked = (x, y, w, h) => {
    const rx = w * 0.46, ry = h * 0.46;
    if (x - rx < 0 || y - ry < 0 || x + rx > W || y + ry > H) return true;
    for (let dy = -ry; dy <= ry; dy += 5) for (let dx = -rx; dx <= rx; dx += 5) {
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1 && isLand(x + dx, y + dy)) return true;
    }
    return false;
  };
  return { at, cells, grad, isLand, footprintBlocked };
}

// ---------------------------------------------------------------- placement

// How names are lettered, the same when placed and when drawn so both lay them out alike: a
// coast is lettered along its stretch inside the canvas.
const letterOptions = (data) => ({
  fonts: STYLE.fonts, lonCenter: data.proj.lonCenter,
  visible: (lon, lat) => { const x = data.proj.x(lon), y = data.proj.y(lat); return x >= 0 && x <= W && y >= 0 && y <= H; },
});

// World-view lettering, hand-set: [Latin, English, lon, lat]. Zoom levels are whole: continents are
// spaced capitals at level 3 and out (zoom < REGION_ZOOM), regions italic at levels 4 and 5.
const CONTINENTS = [
  ['EVROPA', 'EUROPE', 14, 50], ['AFRICA', 'AFRICA', 20, 7], ['ASIA', 'ASIA', 90, 48],
  ['AMERICA SEPTENTRIONALIS', 'NORTH AMERICA', -100, 45], ['AMERICA MERIDIONALIS', 'SOUTH AMERICA', -60, -12],
  ['TERRA AVSTRALIS', 'AUSTRALIA', 134, -25],
];
const REGIONS = [
  ['Hispania', 'Iberia', -3.5, 40], ['Gallia', 'Gaul', 2.5, 46.2], ['Germania', 'Germany', 10, 51],
  ['Italia', 'Italy', 12.2, 43], ['Grecia', 'Greece', 22, 39.6], ['Natolia', 'Anatolia', 33, 39],
  ['Syria', 'Syria', 38, 35], ['Egiptus', 'Egypt', 29.5, 27], ['Libya', 'Libya', 17, 29],
  ['Barbaria', 'Maghreb', 4, 31], ['Arabia', 'Arabia', 44, 24], ['Thracia', 'Thrace', 26, 42.3],
];
const REGION_ZOOM = 4, REGION_ZOOM_END = 6; // regions: REGION_ZOOM <= zoom < REGION_ZOOM_END, which holds the default view

// The continent and region names to letter, each with the box it reserves: measured with the font and
// spacing they are drawn in, so later names and towns make way. A name off the canvas or meeting an
// earlier box is dropped. `continents` is 'latin', 'english' or false; `regions` 'latin', 'english' or 'off'.
function placeWorldNames(data, ctx, boxes, { continents, regions }) {
  const z = data.proj.zoom, out = [];
  const lang = regions === 'latin' ? 0 : 1;
  const put = (text, lon, lat, size, spacing, italic) => {
    const [x, y] = data.proj.project(lon, lat);
    ctx.font = `${italic ? 'italic ' : ''}${size}px "${STYLE.font}"`;
    ctx.letterSpacing = `${spacing}px`;
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = '0px'; // left set, every later name would measure too wide
    const box = obb(x, y, 0, w / 2, size * 0.5);
    if (!obbInside(box) || boxes.some((b) => obbOverlap(b, box))) return;
    boxes.push(box);
    out.push({ text, x, y, size, spacing, italic, r: Math.max(box.hw, box.hh), box });
  };
  if (continents && z < REGION_ZOOM) {
    for (const c of CONTINENTS) { const text = c[continents === 'latin' ? 0 : 1], size = text.length > 12 ? 22 : 30; put(text, c[2], c[3], size, size * 0.6, false); }
  }
  if (regions !== 'off' && z >= REGION_ZOOM && z < REGION_ZOOM_END) {
    for (const r of REGIONS) put(r[lang], r[2], r[3], 22, 1, true);
  }
  return out;
}

// The name a view is about, for an automatic cartouche title. Of the seas, countries, towns and
// hand-set continents and regions the scene letters (a town only where its name is lettered), the
// highest score wins. Each kind of name is the subject at a zoom (a sea or a country from Natural
// Earth's min_label, a town from its scalerank), and scores less the farther the view is from it.
// A point scores more the nearer the frame's centre; a country by how much of its coast is in frame.
// `lang` 0 Latin, 1 English, for the hand-set names.
function viewTitle(data, towns, lang) {
  const z = data.proj.zoom, half = Math.hypot(W, H) / 2;
  const fit = (s) => Math.exp(-(((z - s) / 1.6) ** 2));
  const central = ([x, y]) => (x < 0 || y < 0 || x > W || y > H ? 0 : 1 - Math.hypot(x - W / 2, y - H / 2) / half);
  const at = (lon, lat) => central(data.proj.project(lon, lat));
  const scored = [
    ...CONTINENTS.map((c) => ({ text: c[lang], score: at(c[2], c[3]) * fit(2) })),
    ...REGIONS.map((r) => ({ text: r[lang], score: at(r[2], r[3]) * fit(4.6) })),
    ...towns.map((t) => ({ text: t.name, score: central([t.x, t.y]) * fit(7 + t.rank) })),
    ...data.names.map((n) => {
      if (n.kind === 'sea') return { text: n.text, score: at(...n.at) * fit(n.min + 1.5) };
      // the stretch's points are 0.1 degrees apart: its length in the frame, against the frame's width
      const pts = n.at.map(([lon, lat]) => at(lon, lat)), inFrame = pts.filter((v) => v > 0);
      const share = Math.min(1, (inFrame.length * 0.1 * RAD * data.proj.k) / W);
      return { text: n.text, score: share * (inFrame.reduce((s, v) => s + v, 0) / (inFrame.length || 1)) * fit(n.min + 2) };
    }),
  ];
  return scored.reduce((a, b) => (b.score > a.score ? b : a), { text: '', score: 0 }).text;
}

// The sprite a town draws from its family. A family of variants named `-port`, `-levant`, `-fort` and
// `-small` (Martines) draws a chief town (scalerank 2 or less) as a Levantine city east of 20E and
// south of 38N and as a port elsewhere, a scalerank 3 town as a fort and a lesser one small. Any
// other family is cut by grandeur into thirds, the grandest drawings for the most populous towns
// (townGrandeur), and the town's own number `i` picks among a third's sprites.
function townVariant(family, p, i) {
  if (!family.length) return null;
  const want = p.rank > 3 ? 'small' : p.rank > 2 ? 'fort' : p.lon > 20 && p.lat < 38 ? 'levant' : 'port';
  const named = family.find((s) => s.id.endsWith(`-${want}`));
  if (named) return named;
  const ranked = [...family].sort((a, b) => (b.grandeur ?? 0) - (a.grandeur ?? 0)), n = ranked.length;
  const g = townGrandeur(p), t = g >= 0.4 ? 0 : g >= SMALL_TOWN ? 1 : 2; // 0 the grandest third: about 3 million and over
  const third = ranked.slice(Math.floor((t * n) / 3), Math.max(Math.floor((t * n) / 3) + 1, Math.floor(((t + 1) * n) / 3)));
  return third[i % third.length];
}

// Where a town falls between a market town (0) and a megacity (1), from its population: the span
// townScale draws by population, whichever way the scene sizes its towns.
const SMALL_TOWN = 0.15; // grandeur under about 700,000 people
const townGrandeur = (p) => (townScale(p, 'population') - 0.75) / (1.8 - 0.75);

// How big a town stands. `area` (the default) on a log scale of Natural Earth's MAX_AREAKM, the
// LandScan footprint of its metropolitan area, so a sprawling metro stands over a dense small city;
// `population` on a log scale of POP_MAX, the fallback where a place has no area; `rank` the chief
// towns (scalerank 2 or less) a quarter bigger. The red lettering of the chief towns follows the rank.
function townScale(p, by = 'area') {
  if (by === 'rank') return p.rank <= 2 ? 1.25 : 1;
  if (by === 'area' && p.area > 0) return Math.min(1.8, Math.max(0.7, 1 + 0.5 * Math.log10(p.area / 500))); // 500 km2 stands at 1
  return Math.min(1.8, Math.max(0.75, 1 + 0.4 * Math.log10(Math.max(1, p.pop) / 1e6))); // a million stands at 1
}

// A town with an urban footprint whose projected extent (the square root of its area) reaches
// CITY_PX is drawn as a city plan over it (city.mjs) rather than as an icon; Seattle's icon stands
// through z9.
const CITY_PX = 400;
// Closing in, a town's icon stands at least ICON_GROW of its ground (footprint) tall, so it grows with
// the land under it rather than shrinking against it, up to ICON_MAX px; a town with an urban
// footprint is then about CITY_PX * ICON_GROW tall as its city plan takes over.
const ICON_GROW = 0.75, ICON_MAX = 96;
const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
const seedOf = (text) => { let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619); return h | 0; };
// Sutherland-Hodgman: a ring cut to a lon/lat box, so a clip traces only the coast near a city.
function cutRing(ring, b) {
  let pts = ring;
  for (const [axis, v, keep] of [[0, b.x0, 1], [0, b.x1, -1], [1, b.y0, 1], [1, b.y1, -1]]) {
    const out = [], inside = (q) => (keep > 0 ? q[axis] >= v : q[axis] <= v);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length], ia = inside(a), ic = inside(c);
      if (ia) out.push(a);
      if (ia !== ic) { const t = (v - a[axis]) / (c[axis] - a[axis]), q = [a[0] + t * (c[0] - a[0]), a[1] + t * (c[1] - a[1])]; q[axis] = v; out.push(q); }
    }
    if (out.length < 3) return null;
    pts = out;
  }
  return pts;
}
// A town's ground on screen, as the side of a square of its area in px: its urban footprint where
// it has one (the measure CITY_PX reads), else its metro area (MAX_AREAKM); 0 with neither. The
// metro area is km2, so it takes the px per km east-west (kmPxAt) and north-south (the projection's
// own y against latitude, which equals the east-west scale only where the projection is conformal).
const kmPxAt = (proj, lat) => (proj.k * 1000) / (EARTH_R * Math.cos(lat * RAD));
function footprint(p, proj) {
  if (!p.urban) {
    if (!(p.area > 0)) return { extent: 0 };
    const d = 1e-4, ns = (proj.project(p.lon, p.lat - d)[1] - proj.project(p.lon, p.lat + d)[1]) / (2 * d * RAD) * 1000 / EARTH_R;
    return { extent: Math.sqrt(p.area * kmPxAt(proj, p.lat) * Math.abs(ns)) };
  }
  const rings = p.urban.map((ring) => ring.map(([lon, lat]) => proj.project(lon, lat)));
  return { rings, extent: Math.sqrt(rings.reduce((a, r) => a + ringArea(r), 0)) };
}
// Where a town's icon of height `th` (anchored at its foot) stands: its place where the icon's box is
// on land, else the nearest point within reach whose box is most on land, inside the town's own
// footprint where it has one, so a waterfront city stands over its built-up ground rather than on
// its shore.
function standOf(p, th, w, field, rings) {
  const [x0, y0] = p.xy, rs = rings && pxRings(rings);
  const dry = (x, y) => {
    let n = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if (field.isLand(x + w * ((i + 0.5) / 4 - 0.5) * 2, y - th * (j + 0.5) / 4)) n++;
    return n / 16;
  };
  let best = dry(x0, y0), at = [x0, y0];
  if (best >= 0.9) return at;
  const reach = th * 1.2, step = th / 8;
  const tries = [];
  for (let dy = -reach; dy <= reach; dy += step) for (let dx = -reach; dx <= reach; dx += step) if (Math.hypot(dx, dy) <= reach) tries.push([dx, dy]);
  tries.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
  for (const [dx, dy] of tries) {
    const x = x0 + dx, y = y0 + dy;
    if (x < 8 || y < 8 || x > W - 8 || y > H - 8 || (rs && !insideRings(rs, x, y - th * 0.15))) continue;
    const v = dry(x, y);
    if (v > best + 0.05) { best = v; at = [x, y]; }
    if (best >= 0.9) break;
  }
  return at;
}

function cityOf(p, proj, landPolys) {
  if (!p.urban) return null;
  const { rings, extent } = footprint(p, proj);
  if (extent < CITY_PX) return null;
  const b = bbox(rings.flat());
  if (b.x1 < 0 || b.y1 < 0 || b.x0 > W || b.y0 > H) return null;
  const kmPx = kmPxAt(proj, p.lat);
  // the land about it, each ring cut to the footprint's box (a little wider) on its nearest copy
  const u = p.ubox, lb = { x0: u.x0 - 0.02, y0: u.y0 - 0.02, x1: u.x1 + 0.02, y1: u.y1 + 0.02 };
  const land = [];
  for (const poly of landPolys) for (const ring of poly) {
    const rb = bbox(ring);
    for (const sh of SHIFTS) {
      if (rb.x1 + sh < lb.x0 || rb.x0 + sh > lb.x1 || rb.y1 < lb.y0 || rb.y0 > lb.y1) continue;
      const cut = cutRing(sh ? ring.map(([x, y]) => [x + sh, y]) : ring, lb);
      if (cut) land.push([cut]);
    }
  }
  // the same land in px, even-odd, so the plan keeps its walled core on dry ground
  const landPx = pxRings(land.map(([ring]) => ring.map(([lon, lat]) => proj.project(lon, lat))));
  const onLand = (x, y) => insideRings(landPx, x, y);
  const plan = cityPlan({ rings, x: p.xy[0], y: p.xy[1], extent, zoom: proj.zoom, kmPx, rnd: mulberry32(seedOf(p.name)), w: W, h: H, onLand });
  return { rings, poly: p.urban, box: b, plan, land, extent, lagoon: plan.lagoon };
}

// The order a view tries its monsters or ships in: a weighted shuffle (Efraimidis-Spirakis, key
// u^(1/weight)), seeded by the view's bucket (castSeed), so a big selection shows all of itself
// across the map while one view always draws the same scene.
// A null seed (an older caller) keeps the plain order: heaviest first, as listed among equals.
function castOrder(sprites, seed, weight = (s) => s.weight ?? 1) {
  if (seed == null) return [...sprites].sort((a, b) => weight(b) - weight(a));
  const rnd = mulberry32(seed);
  return sprites.map((s) => ({ s, k: rnd() ** (1 / weight(s)) })).sort((a, b) => b.k - a.k).map((e) => e.s);
}
// A coarse bucket of the view: the whole zoom and the centre floored to about one view's width of
// degrees. A short pan keeps the cast; a long move or a zoom meets new ones.
function castSeed(view) {
  const z = Math.round(view.zoom), span = (360 * W) / (512 * 2 ** z);
  return (Math.imul(z + 1, 73856093) ^ Math.imul(Math.floor(view.lon / span), 19349663) ^ Math.imul(Math.floor(view.lat / span), 83492791)) | 0;
}

// Mountains: inland, on land at least half a sprite's width (and a margin) from the coast, deepest
// first, MOUNTAIN_GAP apart, clear of every name, town, rose and the cartouche, and of the scale bar;
// only from MOUNTAIN_ZOOM in, where land is big enough to hold a range. Each takes the widest sprite
// that fits there, starting one further along the set each time, so a view mixes the ranges.
const MOUNTAIN_GAP = 180, MOUNTAIN_ZOOM = 3, MOUNTAIN_MARGIN = 16;
function placeMountains(data, field, boxes, sprites, scaleBar) {
  if (!sprites.length || data.proj.zoom < MOUNTAIN_ZOOM || TUNE.mountainMax < 1) return [];
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const inland = chamfer(cols, rows, (i) => field.cells[i].land > 0); // px from each land cell to the sea
  const edge = (x, y) => Math.min(x, y, W - x, H - y);
  const bar = scaleBar ? obb(300, H - 90, 0, 270, 70) : null; // the parchment patch under the bar, roughly
  const bySize = [...sprites].sort((a, b) => b.sizePx - a.sizePx);
  const ranked = field.cells.map((c, i) => ({ ...c, d: Math.min(inland[i], edge(c.x, c.y)) }))
    .filter((c) => c.land === 0 && c.d >= bySize.at(-1).sizePx / 2 + MOUNTAIN_MARGIN).sort((a, b) => b.d - a.d);
  const out = [];
  for (const c of ranked) {
    if (out.length >= TUNE.mountainMax) break;
    if (out.some((m) => Math.hypot(m.x - c.x, m.y - c.y) < MOUNTAIN_GAP)) continue;
    for (let k = 0; k < bySize.length; k++) {
      const sprite = bySize[(out.length + k) % bySize.length], w = sprite.sizePx, h = (w * sprite.img.height) / sprite.img.width;
      if (c.d < w / 2 + MOUNTAIN_MARGIN) continue;
      const box = obb(c.x, c.y, 0, w / 2 + MOUNTAIN_MARGIN, h / 2 + MOUNTAIN_MARGIN); // with room round it
      if (boxes.some((b) => obbOverlap(b, box)) || (bar && obbOverlap(bar, box))) continue;
      out.push({ sprite, x: c.x, y: c.y, size: w });
      break;
    }
  }
  return out;
}

// `sprites`: what chooseSprites chose, with pictures.
function buildScene(data, sprites, ctx, world = {}) {
  const field = clearanceField(data);
  // a rose set: the biggest is the centre rose, the rest the ring's; a set of one serves both, small at 110 px
  const roses = sprites.roses;
  const bigRose = roses.reduce((a, b) => (b.sizePx > a.sizePx ? b : a));
  const rest = roses.filter((s) => s !== bigRose), small = rest.filter((s) => s.sizePx < bigRose.sizePx);
  // taken in set order, one per node; mixed sets ring the smaller roses, a set of big ones rings them at 110 px
  const smallRoses = small.length ? small : rest.length ? rest.map((s) => ({ ...s, sizePx: 110 })) : [{ ...bigRose, sizePx: 110 }];
  const smallSize = Math.max(...smallRoses.map((s) => s.sizePx));
  const cartoucheSprite = sprites.cartouche;
  const occupied = []; // discs {x, y, r} that later ornaments keep clear of
  const edge = (x, y) => Math.min(x, y, W - x, H - y);
  const free = (x, y) => Math.min(field.at(x, y), edge(x, y), ...occupied.map((o) => Math.hypot(x - o.x, y - o.y) - o.r));

  // Cartouche: the corner whose rectangle crosses the least coast, open sea before empty land; never
  // the bottom-left corner while the scale bar holds it.
  const cw = cartoucheSprite.sizePx, ch = cw * cartoucheSprite.img.height / cartoucheSprite.img.width, m = 22;
  const corners = [[m, m], [W - m - cw, m], [m, H - m - ch], [W - m - cw, H - m - ch]].filter((_, i) => i !== 2 || !world.scaleBar).map(([x, y]) => {
    let land = 0, coast = 0;
    for (let yy = y; yy < y + ch; yy += 8) for (let xx = x; xx < x + cw; xx += 8) {
      const l = field.isLand(xx, yy);
      land += l;
      coast += l !== field.isLand(xx + 8, yy) || l !== field.isLand(xx, yy + 8);
    }
    return { x, y, w: cw, h: ch, coast, land };
  });
  const cartouche = corners.sort((a, b) => a.coast - b.coast || a.land - b.land)[0];
  occupied.push({ x: cartouche.x + cw / 2, y: cartouche.y + ch / 2, r: Math.hypot(cw, ch) / 2 });

  // Lattice centre: the clearest open-sea cell in the middle of the frame; the big rose sits on it.
  const central = field.cells.filter((c) => c.x > W * 0.25 && c.x < W * 0.75 && c.y > H * 0.25 && c.y < H * 0.8);
  const centre = central.reduce((a, b) => (free(b.x, b.y) > free(a.x, a.y) ? b : a));
  const bigSize = Math.min(bigRose.sizePx, 2 * 0.95 * free(centre.x, centre.y));
  const roseDraws = [{ sprite: bigRose, x: centre.x, y: centre.y, size: bigSize }];
  occupied.push({ x: centre.x, y: centre.y, r: bigSize / 2 });

  // Circle radius: the one that puts the most nodes in water clear enough for a small rose.
  const ring = (R) => Array.from({ length: RHUMB_NODES }, (_, i) => {
    const a = (i * 2 * Math.PI) / RHUMB_NODES;
    return { x: centre.x + R * Math.cos(a), y: centre.y + R * Math.sin(a) };
  });
  const roseRoom = smallSize / 2 + 6;
  let nodes = [], bestCount = -1;
  for (let R = Math.round(H * 0.36); R <= H * 0.62; R += 8) {
    const n = ring(R), count = n.filter((p) => free(p.x, p.y) >= roseRoom).length;
    if (count >= bestCount) { bestCount = count; nodes = n; }
  }

  // Small roses: the clearest lattice nodes that hold the sprite, each rose of the pack in turn.
  const nodeRank = nodes.map((n) => ({ ...n, c: free(n.x, n.y) })).filter((n) => n.c >= roseRoom).sort((a, b) => b.c - a.c);
  for (const n of nodeRank) {
    if (roseDraws.length >= 4) break;
    const sprite = smallRoses[(roseDraws.length - 1) % smallRoses.length];
    if (free(n.x, n.y) < roseRoom || field.footprintBlocked(n.x, n.y, sprite.sizePx, sprite.sizePx)) continue;
    roseDraws.push({ sprite, x: n.x, y: n.y, size: sprite.sizePx });
    occupied.push({ x: n.x, y: n.y, r: sprite.sizePx / 2 + 10 });
  }

  // Towns, lower scalerank first, >= TUNE.townGap apart. The selected town sprites fall into families
  // by pack and style, and the tower is one when chosen; each town keeps one family, picked by its
  // name, save that the tower, plain at its first size, stands only for the smallest towns (SMALL_TOWN).
  const boxes = [obb(cartouche.x + cw / 2, cartouche.y + ch / 2, 0, cw / 2, ch / 2)];
  for (const r of roseDraws) boxes.push(obb(r.x, r.y, 0, r.size * 0.42, r.size * 0.42));
  const worldNames = placeWorldNames(data, ctx, boxes, { continents: world.continents ?? false, regions: world.regions ?? 'off' });
  const families = [...(sprites.towns ?? []).reduce((m, s) => m.set(`${s.pack}/${s.style}`, [...(m.get(`${s.pack}/${s.style}`) ?? []), s]), new Map()).values()];
  if (sprites.tower ?? !families.length) families.push(null); // null: the tower drawn in code
  const towns = [];
  const sorted = families.length ? [...data.places].sort((a, b) => a.rank - b.rank || b.pop - a.pop) : [];
  // cities first: they are ground, drawn under the ornaments, and their boxes make the icons and names give way
  const cities = new Set(), cityBoxes = new Set();
  for (const p of sorted) {
    const c = cityOf(p, data.proj, data.land);
    if (!c) continue;
    const { x0, y0, x1, y1 } = { x0: Math.max(0, c.box.x0), y0: Math.max(0, c.box.y0), x1: Math.min(W, c.box.x1), y1: Math.min(H, c.box.y1) };
    const box = obb((x0 + x1) / 2, (y0 + y1) / 2, 0, (x1 - x0) / 2, (y1 - y0) / 2);
    towns.push({ x: p.xy[0], y: p.xy[1], size: townScale(p, world.townSize), red: p.rank <= 2, name: p.name, rank: p.rank, labelY: Math.max(40, c.box.y0 - 4), city: c, box });
    boxes.push(box); cityBoxes.add(box);
    cities.add(p);
  }
  for (const p of sorted) {
    const [px, py] = p.xy;
    if (cities.has(p) || px < 8 || py < 8 || px > W - 8 || py > H - 8) continue;
    if (towns.some((t) => !t.city && Math.hypot(t.x - px, t.y - py) < TUNE.townGap)) continue;
    const fit = townGrandeur(p) < SMALL_TOWN || families.every((f) => !f) ? families : families.filter(Boolean);
    // the town's own drawing, whatever the view: its family and variant follow from its name, so a
    // zoom or a pan never redraws it as another (townVariant)
    const pick = seedOf(p.name) >>> 0, family = fit[pick % fit.length], size = townScale(p, world.townSize);
    const sprite = family && townVariant(family, p, pick >>> 8);
    const base = (sprite ? townHeight(sprite) : TOWER_H) * size, ground = footprint(p, data.proj);
    const th = Math.max(base, Math.min(ICON_MAX, ICON_GROW * ground.extent));
    const [x, y] = standOf(p, th, sprite ? ((th / 2) * sprite.img.width) / sprite.img.height : th * 0.3, field, ground.rings);
    const icon = sprite
      ? obb(x, y - th / 2, 0, ((th / 2) * sprite.img.width) / sprite.img.height, th / 2)
      : obb(x, y - th / 2, 0, th * 0.3, th / 2); // tower body and pennant
    if (boxes.some((b) => obbOverlap(b, icon))) continue;
    towns.push({ x, y, size, h: th, family, red: p.rank <= 2, name: p.name, rank: p.rank, labelY: y - th - 6, ...(sprite && { sprite }) });
    boxes.push(icon);
  }

  // Names, lettered by coast-wright: seas, then the metros (a town of size 1 or more, or a city),
  // then countries along their coasts, then the other towns above their towers; a country once, on
  // its longest stretch that fits. Earlier names win an overlap, so a country, which has other
  // stretches to go to, gives way to a metro, which has nowhere else; a name that meets an
  // ornament or leaves the canvas is dropped.
  const named = (n) => ({ ...n, size: n.kind === 'sea' ? (n.rank <= 1 ? 22 : n.rank <= 3 ? 18 : 15) : n.rank <= 2 ? 17 : 14 });
  const townName = (t) => ({ text: t.name, at: data.proj.invert(t.x, t.labelY), size: t.rank <= 1 ? 17 : t.rank <= 2 ? 15 : 13, red: t.red, own: t.box, plate: !!t.city });
  const metro = (t) => t.city || t.size >= 1;
  const lettering = [
    ...data.names.filter((n) => n.kind === 'sea').map(named),
    ...towns.filter(metro).map(townName),
    ...data.names.filter((n) => n.kind !== 'sea').map(named),
    ...towns.filter((t) => !metro(t)).map(townName),
  ];
  const opts = letterOptions(data);
  const names = [];
  for (const n of lettering) {
    if (n.kind === 'coast' && names.some((m) => m.kind === 'coast' && m.text === n.text)) continue; // once a view
    const [p] = place(ctx, [n], data.proj.x, data.proj.y, opts);
    if (!p) continue;
    const [c0, c1, c2] = p.box; // coast-wright's corners, as an oriented box
    const box = obb((c0[0] + c2[0]) / 2, (c0[1] + c2[1]) / 2, Math.atan2(c1[1] - c0[1], c1[0] - c0[0]),
      Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) / 2, Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) / 2);
    // a city's name sits on its own plan; seas and coasts are lettered over any city's water
    if (!obbInside(box) || boxes.some((b) => b !== n.own && !(n.kind && cityBoxes.has(b)) && obbOverlap(b, box))) continue;
    boxes.push(box);
    names.push({ ...n, x: box.cx, y: box.cy, r: Math.max(box.hw, box.hh), box });
  }
  for (const b of boxes.slice(1 + roseDraws.length).filter((b) => !cityBoxes.has(b))) occupied.push({ x: b.cx, y: b.cy, r: Math.max(b.hw, b.hh) * 0.6 });
  const mountains = placeMountains(data, field, boxes, sprites.mountains ?? [], world.scaleBar);

  // Monsters: farthest-first on the open-water field, >= MONSTER_GAP apart, in the view's cast order
  // (heavier sprites tend to come first).
  const monsterSprites = castOrder(sprites.monsters, world.seed);
  const monsters = [];
  for (const sprite of monsterSprites) {
    if (monsters.length >= TUNE.monsterMax) break;
    const aspect = sprite.img.height / sprite.img.width;
    const ranked = field.cells
      .filter((c) => c.land > 0 && monsters.every((mo) => Math.hypot(mo.x - c.x, mo.y - c.y) >= MONSTER_GAP))
      .map((c) => ({ ...c, c: free(c.x, c.y) }))
      .sort((a, b) => b.c - a.c);
    for (const cand of ranked) {
      const size = Math.min(sprite.sizePx, cand.c * 2 * 0.85);
      if (size < sprite.sizePx * 0.65) break; // farthest-first: nothing clearer remains
      if (field.footprintBlocked(cand.x, cand.y, size, size * aspect)) continue;
      if (boxes.some((b) => obbOverlap(b, obb(cand.x, cand.y, 0, size * 0.45, size * aspect * 0.45)))) continue;
      monsters.push({ sprite, x: cand.x, y: cand.y, size, flip: monsters.length % 2 === 1 });
      occupied.push({ x: cand.x, y: cand.y, r: size * 0.5 });
      break;
    }
  }

  // Ships: coastal water, spread out, heading along the nearest coast; in the view's cast order, all alike.
  const shipSprites = castOrder(sprites.ships, world.seed == null ? null : world.seed ^ 0x5eed, () => 1);
  const ships = [];
  for (const sprite of shipSprites) {
    if (ships.length >= TUNE.shipMax) break;
    const cand = field.cells
      .filter((c) => c.land >= 24 && c.land <= 72 && free(c.x, c.y) >= sprite.sizePx * 0.5 &&
        !field.footprintBlocked(c.x, c.y, sprite.sizePx, sprite.sizePx * sprite.img.height / sprite.img.width) &&
        boxes.every((b) => !obbOverlap(b, obb(c.x, c.y, 0, sprite.sizePx / 2, sprite.sizePx / 2))))
      .map((c) => ({ ...c, spread: Math.min(...occupied.map((o) => Math.hypot(o.x - c.x, o.y - c.y) - o.r)) }))
      .sort((a, b) => b.spread - a.spread)[0];
    if (!cand) continue;
    const [gx, gy] = field.grad(cand.x, cand.y);
    let tx = -gy, ty = gx;
    const back = tx < 0;
    if (back) { tx = -tx; ty = -ty; }
    const flip = back !== (sprite.heading === 'left'); // a sprite drawn bow-left is mirrored to sail right
    const tilt = Math.max(-0.26, Math.min(0.26, Math.atan2(ty, tx)));
    ships.push({ sprite, x: cand.x, y: cand.y, size: sprite.sizePx, flip, tilt });
    occupied.push({ x: cand.x, y: cand.y, r: sprite.sizePx * 0.6 + 120 });
  }

  // automatic, the typed title stands in where the view has no name in it
  const title = (world.autoTitle && viewTitle(data, towns.filter((t) => names.some((n) => n.text === t.name)), world.regions === 'english' ? 1 : 0).toUpperCase()) || world.title || 'PORTOLANI';
  return { field, centre, nodes, roseDraws, towns, names, worldNames, monsters, ships, mountains, cartouche: { ...cartouche, sprite: cartoucheSprite, title } };
}

// ---------------------------------------------------------------- drawing

function parchment(seed) {
  const rnd = mulberry32(seed);
  const c = createCanvas(W, H), g = c.getContext('2d');
  g.fillStyle = STYLE.parchment;
  g.fillRect(0, 0, W, H);

  // mottling: two octaves of smoothed value noise, multiplied in
  for (const [cols, alpha] of [[24, 0.22], [90, 0.12]]) {
    const rows = Math.ceil((cols * H) / W);
    const n = createCanvas(cols, rows), ng = n.getContext('2d'), img = ng.createImageData(cols, rows);
    for (let i = 0; i < cols * rows; i++) {
      const v = 200 + rnd() * 55;
      img.data.set([v, v * 0.97, v * 0.9, 255], i * 4);
    }
    ng.putImageData(img, 0, 0);
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = alpha;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(n, 0, 0, W, H);
    g.restore();
  }

  // fibre grain
  const grain = createCanvas(W, H), gg = grain.getContext('2d'), gi = gg.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const v = 235 + rnd() * 20; gi.data.set([v, v, v * 0.98, 255], i * 4); }
  gg.putImageData(gi, 0, 0);
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.drawImage(grain, 0, 0); g.restore();

  // vignette toward the rim
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.55);
  vg.addColorStop(0, hexA(STYLE.rim, 0));
  vg.addColorStop(0.7, hexA(STYLE.rim, 0.45));
  vg.addColorStop(1, hexA('#8a6a3a', 0.75));
  g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = vg; g.fillRect(0, 0, W, H); g.restore();

  // sparse foxing: a few clustered rust spots
  for (let s = 0; s < 11; s++) {
    const x = rnd() * W, y = rnd() * H, r = 3 + rnd() * 9;
    for (let k = 0; k < 3 + Math.floor(rnd() * 4); k++) {
      const sx = x + (rnd() - 0.5) * r * 2.5, sy = y + (rnd() - 0.5) * r * 2.5, sr = r * (0.3 + rnd() * 0.8);
      const fg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      fg.addColorStop(0, 'rgba(150,100,45,0.32)');
      fg.addColorStop(0.6, 'rgba(160,110,50,0.18)');
      fg.addColorStop(1, 'rgba(160,110,50,0)');
      g.fillStyle = fg;
      g.beginPath(); g.arc(sx, sy, sr, 0, Math.PI * 2); g.fill();
    }
  }
  return c;
}

// ---------------------------------------------------------------- culling

// The scene-px rectangle a view paints, padded so strokes and antialiasing at the edge survive.
function viewRect(g, view, pad = 16) {
  const s = view.scale;
  return { x0: view.x - pad, y0: view.y - pad, x1: view.x + g.canvas.width / s + pad, y1: view.y + g.canvas.height / s + pad };
}
const disc = (r, x, y, rad) => x + rad > r.x0 && x - rad < r.x1 && y + rad > r.y0 && y - rad < r.y1;
const meets = (r, b) => b.x1 > r.x0 && b.x0 < r.x1 && b.y1 > r.y0 && b.y0 < r.y1;

function bbox(pts) {
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const [x, y] of pts) { if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; }
  return b;
}

// Coast split into short runs so a view walks only its own.
const COAST_RUN = 64;
function coastRuns(line) {
  const runs = [];
  for (let i = 0; i < line.length - 1; i += COAST_RUN) runs.push(line.slice(i, i + COAST_RUN + 2)); // one shared segment keeps every join
  return runs;
}

// The houses standing in the washes `ws` (a footprint and its ramp in), within the scene-px
// rectangle `r`: one to a cell of a HOUSE_GAP lattice anchored at 0N 0E, so it is fixed to the
// map, set off in its cell by its own hash; standing on land, wholly in a footprint and off every
// city plan.
// x, y, width and seed per house, as drawHouses takes them; a house is as solid as its wash is in.
const HOUSE_GAP = 9;
const housesMemo = new WeakMap();
function housesIn(ws, data, field, plans, r) {
  const [ax, ay] = data.proj.project(0, 0), G = HOUSE_GAP, out = [], seen = new Set();
  const memo = housesMemo.get(data) ?? new Map();
  housesMemo.set(data, memo);
  for (const { u, ramp } of ws) {
    if (ramp < 0.35) continue;
    let rs = memo.get(u.poly);
    if (!rs) memo.set(u.poly, rs = pxRings(u.poly.map((ring) => ring.map(([lon, lat]) => data.proj.project(lon, lat)))));
    const x0 = Math.max(u.box.x0, r.x0 - G), x1 = Math.min(u.box.x1, r.x1 + G), y0 = Math.max(u.box.y0, r.y0 - G), y1 = Math.min(u.box.y1, r.y1 + G);
    for (let j = Math.floor((y0 - ay) / G); j <= Math.ceil((y1 - ay) / G); j++) for (let i = Math.floor((x0 - ax) / G); i <= Math.ceil((x1 - ax) / G); i++) {
      const key = `${i},${j}`;
      if (seen.has(key)) continue;
      const h = seedOf(key) >>> 0, f = (k) => ((h >>> k) & 1023) / 1024;
      const x = ax + (i + 0.15 + 0.7 * f(0)) * G, y = ay + (j + 0.25 + 0.6 * f(10)) * G;
      // the house's box, a stroke and a wobble wide, by its corners and the middles of its sides
      const w = G * (0.5 + 0.2 * f(5)), bx0 = x - w * 0.65 - 1.5, bx1 = x + w * 1.3 + 1.5, by0 = y - w * 1.45 - 1.5, by1 = y + 1.5;
      const rim = [[bx0, by1], [x, by1], [bx1, by1], [bx1, y - w], [bx1, by0], [x, by0], [bx0, by0], [bx0, y - w]];
      if (f(20) > 0.45 + 0.5 * ramp || !field?.isLand(x, y) || !rim.every(([cx, cy]) => insideRings(rs, cx, cy))) continue;
      if (plans.some((t) => insideRings(t.city.px ??= pxRings(t.city.rings), x, y))) continue;
      seen.add(key);
      out.push(x, y, w, f(15));
    }
  }
  return out;
}

// Land and coast runs with px bounding boxes.
const indexes = new WeakMap();
function indexOf(data) {
  let ix = indexes.get(data);
  if (ix) return ix;
  const px = (ring) => ring.map(([lon, lat]) => data.proj.project(lon, lat));
  const land = data.land.map((poly) => ({ poly, box: bbox(px(poly[0])) }));
  const coast = data.coastLL.flatMap(coastRuns).map((run) => ({ run, box: bbox(px(run)) }));
  const urban = (data.urban ?? []).map((poly) => ({ poly, box: bbox(px(poly.flat())) })); // a footprint's pieces are rings of one poly
  ix = { land, coast, urban };
  indexes.set(data, ix);
  return ix;
}

// Each node's rays as rhumb lines in [lon, lat], with px boxes for culling; reaching past the
// scene's far corner from any node.
const lattices = new WeakMap();
function latticeOf(scene, data) {
  let rays = lattices.get(scene);
  if (rays) return rays;
  rays = [];
  // Mercator radians at the equator, in degrees; never past half the world, where a ray would lap itself
  const reach = Math.min(180, (Math.hypot(W, H) * 1.5 / data.proj.k) * 180 / Math.PI);
  for (const n of [scene.centre, ...scene.nodes]) {
    const [lon, lat] = data.proj.invert(n.x, n.y);
    for (let k = 0; k < RHUMB_RAYS; k++) {
      const kind = k % 4 === 0 ? 0 : k % 2 === 1 ? 1 : 2; // wind, quarter (red), half (green)
      const line = rhumb([lon, lat], 90 + (k * 360) / RHUMB_RAYS, reach * Math.cos(lat * Math.PI / 180));
      rays.push({ kind, line, box: bbox(line.map(([a, b]) => data.proj.project(a, b))) });
    }
  }
  lattices.set(scene, rays);
  return rays;
}

// The `plain` rendering: no images, so a rose and a cartouche frame drawn in code, in the ink of the day.
const PLAIN = [
  { id: 'rose-plain-large', kind: 'rose', sizePx: 300 },
  { id: 'rose-plain-small', kind: 'rose', sizePx: 110 },
  { id: 'cartouche-plain', kind: 'cartouche', sizePx: 340, panel: [0.034, 0.665, 0.953, 0.994] },
].map((s) => ({ ...s, pack: 'plain', key: `plain/${s.kind}`, plain: true, anchor: [0.5, 0.5], img: { width: 1031, height: 784 }, weight: 1 }));

function drawPlainRose(g, x, y, size) {
  const R = size / 2, w = Math.max(1, size / 150);
  g.save();
  g.translate(x, y);
  g.lineJoin = 'miter';
  g.strokeStyle = STYLE.ink;
  g.lineWidth = w;
  for (const r of [R, R * 0.86]) { g.beginPath(); g.arc(0, 0, r, 0, 2 * Math.PI); g.stroke(); }
  // 32 points: 4 cardinal, 4 inter-cardinal (red), 8 half-winds (green), 16 quarter-winds
  const ranks = [[4, 0, 0.8, STYLE.ink], [4, 45, 0.62, STYLE.windRed], [8, 22.5, 0.46, STYLE.windGreen], [16, 11.25, 0.32, STYLE.ink]];
  for (const [n, off, len, col] of ranks) {
    for (let i = 0; i < n; i++) {
      const step = 360 / n, a = ((i * step + off) % 360 - 90) * RAD, half = (step / 2) * 0.55 * RAD, r = R * len;
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(Math.cos(a - half) * r * 0.22, Math.sin(a - half) * r * 0.22);
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a + half) * r * 0.22, Math.sin(a + half) * r * 0.22);
      g.closePath(); g.fill();
    }
  }
  g.fillStyle = STYLE.parchment;
  g.beginPath(); g.arc(0, 0, R * 0.05, 0, 2 * Math.PI); g.fill(); g.stroke();
  g.restore();
}

// A double rule round the lettered panel.
function drawPlainFrame(g, c) {
  const [px0, py0, px1, py1] = c.sprite.panel;
  const x = c.x + px0 * c.w, y = c.y + py0 * c.h, w = (px1 - px0) * c.w, h = (py1 - py0) * c.h;
  g.save();
  g.strokeStyle = STYLE.ink;
  g.lineWidth = 2;
  g.strokeRect(x - 4, y - 4, w + 8, h + 8);
  g.lineWidth = 0.75;
  g.strokeRect(x - 8, y - 8, w + 16, h + 16);
  g.restore();
}

function drawSprite(g, s, x, y, size, { flip = false, rot = 0, anchor = s.anchor } = {}) {
  if (s.plain) { if (s.kind === 'rose') drawPlainRose(g, x, y, size); return; }
  const w = size, h = (size * s.img.height) / s.img.width;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  if (flip) g.scale(-1, 1);
  g.globalCompositeOperation = 'multiply';
  g.drawImage(s.tinted, -w * anchor[0], -h * anchor[1], w, h);
  g.restore();
}

const TOWN_H = 30; // px a town sprite stands at size 1, flag to foot, before normalized() sets it from the ink
const townHeight = (s) => s.heightPx ?? TOWN_H;
const TOWER_H = 16.5; // the tower's own height, in its drawing units

function drawTower(g, t) {
  const s = t.h / TOWER_H;
  g.save();
  g.translate(t.x, t.y);
  g.scale(s, s);
  g.lineWidth = 1.1;
  g.strokeStyle = STYLE.ink;
  g.fillStyle = hexA(STYLE.parchment, 0.9);
  // body with three merlons, an arched door, a pennant
  g.beginPath();
  g.moveTo(-4, 0); g.lineTo(-4, -9); g.lineTo(-5, -9); g.lineTo(-5, -12);
  g.lineTo(-3, -12); g.lineTo(-3, -10.5); g.lineTo(-1, -10.5); g.lineTo(-1, -12);
  g.lineTo(1, -12); g.lineTo(1, -10.5); g.lineTo(3, -10.5); g.lineTo(3, -12);
  g.lineTo(5, -12); g.lineTo(5, -9); g.lineTo(4, -9); g.lineTo(4, 0); g.closePath();
  g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-1.5, 0); g.lineTo(-1.5, -3); g.arc(0, -3, 1.5, Math.PI, 0); g.lineTo(1.5, 0); g.stroke();
  g.beginPath(); g.moveTo(0, -12); g.lineTo(0, -16.5); g.stroke();
  g.fillStyle = t.red ? STYLE.windRed : STYLE.ink;
  g.beginPath(); g.moveTo(0, -16.5); g.lineTo(4.5, -15.2); g.lineTo(0, -14); g.closePath(); g.fill();
  g.restore();
}

// Dots a few px seaward of the coast, a stand-in for shoals until there is data for them. Both
// sides of each run get dots; the land is painted over the landward ones.
function paintShoals(g, data, coast) {
  const { x, y, k } = data.proj;
  g.save();
  g.fillStyle = hexA(STYLE.red, 0.85);
  g.beginPath();
  for (const run of coast) {
    let left = 0, prev = null;
    for (const [lon, lat] of run) {
      const p = [x(lon, lat), y(lat, lon)];
      if (prev && Math.abs(p[0] - prev[0]) > Math.PI * k) { prev = null; left = 0; } // across the seam
      if (prev) {
        const dx = p[0] - prev[0], dy = p[1] - prev[1], len = Math.hypot(dx, dy);
        if (len > 0) {
          for (let d = SHOAL_GAP - left; d <= len; d += SHOAL_GAP) {
            const t = d / len, cx = prev[0] + dx * t, cy = prev[1] + dy * t;
            for (const sgn of [1, -1]) {
              const ox = cx - (dy / len) * SHOAL_OFFSET * sgn, oy = cy + (dx / len) * SHOAL_OFFSET * sgn;
              g.moveTo(ox + 1.2, oy); g.arc(ox, oy, 1.2, 0, 2 * Math.PI);
            }
          }
          left = (left + len) % SHOAL_GAP;
        }
      }
      prev = p;
    }
  }
  g.fill();
  g.restore();
}

// The treatment of the land, after the parchment: the Red Sea tint and shoals (both under the land,
// which hides what falls on shore), a flat tint, a landward wash along the coast, and the islands.
function paintLand(g, data, land, coast) {
  const { x, y, lonCenter } = data.proj;
  const mode = STYLE.landMode;
  if (redSeaPolys) {
    trace(g, redSeaPolys, x, y, { lonCenter });
    g.save(); g.fillStyle = hexA(STYLE.red, 0.5); g.fill('evenodd');
    // a hair beyond the polygon, which is generalised and stops short of the shore
    g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = hexA(STYLE.red, 0.5); g.stroke(); g.restore();
  }
  if (mode === 'ochre') paintShoals(g, data, coast);
  fill(g, land, x, y, { color: STYLE.land, lonCenter });
  g.save();
  traceLand(g, data, land);
  g.clip('evenodd');
  const wash = LAND_WASH[mode];
  for (const [wd, a] of [[STYLE.washWidth * 2, 0.3], [STYLE.washWidth * 1.3, 0.3], [STYLE.washWidth * 0.7, 0.35]]) {
    limn(g, coast, x, y, { color: hexA(wash, a), alpha: 1, width: wd, cap: 'round', oneStroke: true, lonCenter });
  }
  if (mode === 'green') limn(g, coast, x, y, { color: STYLE.greenEdge, alpha: 0.8, width: 3.5, cap: 'round', oneStroke: true, lonCenter });
  g.restore();
  if (mode === 'islands') {
    const pigments = [STYLE.red, STYLE.green, STYLE.gold];
    for (const [hue, pigment] of pigments.entries()) {
      const isles = land.filter((p) => p.isl.km2 < ISLAND_KM2 && p.isl.hue === hue);
      if (isles.length) fill(g, isles, x, y, { color: pigment, alpha: 0.92, lonCenter });
    }
  }
  paintWater(g, data);
}

// Rivers, then lakes over them, each in its chosen style, on the land and under the coast's ink.
function paintWater(g, data) {
  const river = RIVERS[STYLE.rivers], lake = LAKES[STYLE.lakes];
  if (!(river || lake) || !water) return;
  const f = frameOf(data.proj, WATER_PX / data.proj.k / RAD), zoom = data.proj.zoom;
  const paint = { proj: data.proj, palette: { ink: STYLE.ink, pigments: [STYLE.red, STYLE.rose, STYLE.green], seedOf } };
  const kept = (list) => list.filter((w) => shown(w, zoom) && meetsLL(f, w.box));
  if (river) river(g, paint, kept(water.rivers).filter((r) => !(lake && r.inLake)));
  if (lake) lake(g, paint, kept(water.lakes));
}
const paintCoast = (g, data, coast) =>
  limn(g, coast, data.proj.x, data.proj.y, { color: STYLE.ink, alpha: 1, width: STYLE.coastWidth, oneStroke: true, lonCenter: data.proj.lonCenter });

// Parchment, land and coast for any view, with no ornaments or lattice: what a drag draws each frame.
function drawGround(g, world, view, bg) {
  const proj = makeProjection(view), data = { proj };
  const f = frameOf(proj, 16 / proj.k / RAD); // 16 px, so strokes at the edge survive
  const land = world.land.filter((l) => meetsLL(f, l.box)).map((l) => l.poly);
  const coast = world.runs.filter((c) => meetsLL(f, c.box)).map((c) => c.run);
  g.drawImage(bg, 0, 0);
  paintLand(g, data, land, coast);
  paintCoast(g, data, coast);
}

// ---------------------------------------------------------------- scale bar

const EARTH_R = 6371008.8, NM = 1852; // metres
const NM_STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
const SCALE_MIN_ZOOM = 3; // below this the Mercator scale varies too much across the view to quote one

// A period ladder, true east-west at the latitude of the view's centre (in any of PROJECTIONS),
// drawn in screen pixels. The styles follow the scales on four charts: SCALE_STYLES.chevron the
// Genoese chart c.1320-50, ribbon Martines 1584, beads Prunes 1559, ruled Beccari 1403, and
// chequer a plain red and green ladder.
const SCALE_BAR_H = 36;
const ring = (g, x, y, r, c) => { g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.strokeStyle = c; g.stroke(); };
const rule = (g, x0, y0, x1, y1, c, w) => { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = c; g.lineWidth = w; g.stroke(); };
const SCALE_STYLES = {
  // two rows of chequered divisions
  chequer(g, x0, y0, n, seg) {
    const bh = SCALE_BAR_H / 4, y = y0 + SCALE_BAR_H / 4;
    for (let i = 0; i < n; i++) for (let row = 0; row < 2; row++) {
      g.fillStyle = (i + row) % 2 ? STYLE.windGreen : STYLE.windRed;
      g.fillRect(x0 + i * seg, y + row * bh, seg, bh);
    }
    g.strokeStyle = STYLE.ink; g.lineWidth = 1.25; g.strokeRect(x0, y, n * seg, 2 * bh);
    rule(g, x0, y + bh, x0 + n * seg, y + bh, STYLE.ink, 0.75);
  },
  // framed ladder: bands of red chevrons and green tufts, red ticks with rings, a dotted line between
  chevron(g, x0, y0, n, seg) {
    const L = n * seg, bandH = 10, cells = n * 2, cw = L / cells, yb = y0 + SCALE_BAR_H - bandH;
    for (const by of [y0, yb]) {
      rule(g, x0, by, x0 + L, by, STYLE.windRed, 1); rule(g, x0, by + bandH, x0 + L, by + bandH, STYLE.windRed, 1);
      for (let i = 0; i < cells; i++) {
        const cx = x0 + i * cw, cy = by + bandH / 2;
        if (i % 2 === 0) {
          g.beginPath(); g.moveTo(cx + cw * 0.1, by + 1); g.lineTo(cx + cw * 0.65, by + 1); g.lineTo(cx + cw * 0.95, cy);
          g.lineTo(cx + cw * 0.65, by + bandH - 1); g.lineTo(cx + cw * 0.1, by + bandH - 1); g.lineTo(cx + cw * 0.4, cy); g.closePath();
          g.fillStyle = STYLE.windRed; g.fill();
        } else {
          g.beginPath(); g.ellipse(cx + cw / 2, cy, cw * 0.38, bandH * 0.36, 0, 0, 2 * Math.PI);
          g.fillStyle = hexA(STYLE.windGreen, 0.55); g.fill();
        }
      }
    }
    const ym = y0 + SCALE_BAR_H / 2;
    g.lineWidth = 1.25;
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * seg;
      rule(g, x, y0 + bandH, x, yb, STYLE.windRed, 1.25);
      if (i % 2 === 0) { g.lineWidth = 1.25; ring(g, x, ym, 3, STYLE.windRed); }
    }
    g.fillStyle = STYLE.ink;
    for (let i = 0; i < n; i++) for (let d = 1; d < 5; d++) { g.beginPath(); g.arc(x0 + i * seg + (seg * d) / 5, ym, 0.9, 0, 2 * Math.PI); g.fill(); }
    rule(g, x0, y0, x0, y0 + SCALE_BAR_H, STYLE.windRed, 1.25); rule(g, x0 + L, y0, x0 + L, y0 + SCALE_BAR_H, STYLE.windRed, 1.25);
  },
  // a scroll: red-ruled strip, ticks and a dotted line, green ribbon tails curling off both ends
  ribbon(g, x0, y0, n, seg) {
    const L = n * seg, top = y0 + 4, bot = y0 + 22, tail = 18;
    for (const side of [-1, 1]) {
      const ex = side < 0 ? x0 : x0 + L;
      g.beginPath(); g.moveTo(ex, top + 4); g.bezierCurveTo(ex + side * tail, top, ex + side * tail, bot + 8, ex, bot + 8);
      g.lineTo(ex, bot - 2); g.bezierCurveTo(ex + side * (tail - 6), bot - 2, ex + side * (tail - 6), top + 8, ex, top + 8); g.closePath();
      g.fillStyle = hexA(STYLE.windGreen, 0.75); g.fill(); g.strokeStyle = STYLE.windRed; g.lineWidth = 1; g.stroke();
    }
    g.beginPath(); g.rect(x0, top, L, bot - top); g.fillStyle = hexA(STYLE.parchment, 0.85); g.fill();
    g.strokeStyle = STYLE.windRed; g.lineWidth = 1.75; g.stroke();
    rule(g, x0, bot + 5, x0 + L, bot + 5, STYLE.windGreen, 3);
    for (let i = 0; i <= n; i++) rule(g, x0 + i * seg, top, x0 + i * seg, bot, STYLE.windRed, i % 2 ? 1 : 1.5);
    for (let i = 0; i < n * 2; i++) rule(g, x0 + (i + 0.5) * (seg / 2) , top, x0 + (i + 0.5) * (seg / 2), top + 5, STYLE.windRed, 1);
    g.fillStyle = STYLE.ink;
    for (let i = 0; i < n; i++) for (let d = 1; d < 5; d++) { g.beginPath(); g.arc(x0 + i * seg + (seg * d) / 5, (top + bot) / 2 + 3, 0.9, 0, 2 * Math.PI); g.fill(); }
  },
  // a thin ladder: two red rails, a ring on every division, a small crenellated cap at each end
  beads(g, x0, y0, n, seg) {
    const L = n * seg, ym = y0 + SCALE_BAR_H / 2, hh = 6;
    rule(g, x0, ym - hh, x0 + L, ym - hh, STYLE.windRed, 1.25); rule(g, x0, ym + hh, x0 + L, ym + hh, STYLE.windRed, 1.25);
    g.lineWidth = 1.25;
    for (let i = 0; i <= n; i++) { const x = x0 + i * seg; rule(g, x, ym - hh, x, ym - 3.6, STYLE.windRed, 1.25); rule(g, x, ym + 3.6, x, ym + hh, STYLE.windRed, 1.25); g.lineWidth = 1.25; ring(g, x, ym, 3.6, STYLE.windRed); }
    for (let i = 0; i < n * 2; i++) { g.lineWidth = 1; ring(g, x0 + (i + 0.5) * (seg / 2), ym, 1.6, STYLE.windRed); }
    for (const [ex, side] of [[x0, -1], [x0 + L, 1]]) {
      g.fillStyle = STYLE.ink;
      g.fillRect(ex + (side < 0 ? -12 : 0), ym - hh - 3, 12, 2 * hh + 6);
      for (let k = 0; k < 3; k++) g.fillRect(ex + (side < 0 ? -12 : 0) + k * 5, ym - hh - 8, 2.5, 5);
      g.fillStyle = STYLE.windRed; g.fillRect(ex + (side < 0 ? -9 : 3), ym - 2, 6, 4);
    }
  },
  // red rules above and below, a ring and dot on each division, hairlines between
  ruled(g, x0, y0, n, seg) {
    const L = n * seg, ym = y0 + SCALE_BAR_H / 2, hh = 12;
    for (const sgn of [-1, 1]) for (let k = 0; k < 3; k++) rule(g, x0, ym + sgn * (hh - k * 2.5), x0 + L, ym + sgn * (hh - k * 2.5), STYLE.windRed, 0.9);
    for (let i = 0; i <= n; i++) {
      const x = x0 + i * seg;
      rule(g, x, ym - hh, x, ym + hh, STYLE.windRed, 1);
      g.beginPath(); g.arc(x, ym, 3.4, 0, 2 * Math.PI); g.fillStyle = STYLE.parchment; g.fill(); g.lineWidth = 1.1; g.strokeStyle = STYLE.windRed; g.stroke();
      g.beginPath(); g.arc(x, ym, 1.1, 0, 2 * Math.PI); g.fillStyle = STYLE.windRed; g.fill();
    }
    for (let i = 0; i < n; i++) for (let d = 1; d < 4; d++) { g.beginPath(); g.arc(x0 + i * seg + (seg * d) / 4, ym, 0.8, 0, 2 * Math.PI); g.fillStyle = STYLE.ink; g.fill(); }
  },
};
// a picture from a pack, its divisions fixed: the pack's `bar` is the run of the divisions across the
// picture, as fractions of its width; it is scaled whole, so its height follows its length
SCALE_STYLES.genoese = (g, x0, y0, n, seg, sprite) => {
  const [b0, b1] = sprite.bar, w = (n * seg) / (b1 - b0), h = (w * sprite.img.height) / sprite.img.width;
  g.save(); g.globalCompositeOperation = 'multiply';
  g.drawImage(sprite.tinted, x0 - b0 * w, y0 + SCALE_BAR_H - h, w, h);
  g.restore();
};
SCALE_STYLES.genoese.height = (n, seg, sprite) => ((n * seg) / (sprite.bar[1] - sprite.bar[0])) * sprite.img.height / sprite.img.width;
const SCALE_PICTURES = { genoese: 'scale-genoese' }; // style -> sprite id in the vivid pack
const SCALE_NAMES = Object.keys(SCALE_STYLES);

function drawScaleBar(g, data, bg, view, w, h, style = 'genoese', sprite = null) {
  const proj = data.proj;
  if (!(style in SCALE_STYLES) || proj.zoom < SCALE_MIN_ZOOM || (style in SCALE_PICTURES && !sprite)) return;
  const lat = proj.invert(view.x + w / 2 / view.scale, view.y + h / 2 / view.scale)[1];
  const pxPerNm = ((proj.k * NM) / (EARTH_R * Math.cos(lat * RAD))) * view.scale;
  const target = Math.min(w * 0.25, 360); // longest bar, px
  const fixed = sprite?.divisions;
  const step = [...NM_STEPS].reverse().find((n) => n * pxPerNm * (fixed ?? 4) <= target) ?? NM_STEPS[0]; // sub-divides a nautical mile when zoomed far in, so the bar stays within `target`
  const seg = step * pxPerNm, n = fixed ?? Math.max(4, Math.min(8, 2 * Math.floor(target / seg / 2)));
  const every = n % 2 ? 1 : 2; // which divisions are numbered
  // a picture taller than the ladder grows upward from the same foot
  const barH = Math.max(SCALE_BAR_H, SCALE_STYLES[style].height?.(n, seg, sprite) ?? 0);
  const x0 = 48, y0 = h - 36 - SCALE_BAR_H, top = y0 + SCALE_BAR_H - barH;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = `22px "${STYLE.font}"`;
  // the chart is blank where a scale sits: the parchment is repainted over the map beneath it
  const pad = 14, px = x0 - pad - 20, py = top - 22 - 5 - pad;
  const pw = n * seg + 24 + g.measureText('nautical miles').width + 2 * pad + 20, ph = barH + 22 + 5 + 2 * pad;
  const sx = Math.max(0, view.x + px / view.scale), sy = Math.max(0, view.y + py / view.scale);
  g.drawImage(bg, sx, sy, Math.min(W - sx, pw / view.scale), Math.min(H - sy, ph / view.scale), px, py, pw, ph);
  g.strokeStyle = hexA(STYLE.windRed, 0.7); g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  g.strokeRect(px + 3.5, py + 3.5, pw - 7, ph - 7);
  SCALE_STYLES[style](g, x0, y0, n, seg, sprite);
  g.fillStyle = STYLE.ink; g.textAlign = 'center'; g.textBaseline = 'bottom';
  for (let i = 0; i <= n; i += every) g.fillText(String(+(i * step).toFixed(2)), x0 + i * seg, top - 5);
  g.textAlign = 'left'; g.fillText('nautical miles', x0 + n * seg + 24, y0 + SCALE_BAR_H);
  g.restore();
}

function drawScene(g, scene, data, bg, view) {
  g.save();
  g.setTransform(view.scale, 0, 0, view.scale, -view.x * view.scale, -view.y * view.scale);
  // Only what meets the view is traced or drawn; a view skips the rest of the scene.
  const r = viewRect(g, view), idx = indexOf(data);
  const land = idx.land.filter((l) => meets(r, l.box)).map((l) => l.poly);
  const coast = idx.coast.filter((c) => meets(r, c.box)).map((c) => c.run);
  const bgPart = (x0, y0, x1, y1) => {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
    if (x1 > x0 && y1 > y0) g.drawImage(bg, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  };

  // 1. parchment
  bgPart(r.x0, r.y0, r.x1, r.y1);

  // 2. land
  paintLand(g, data, land, coast);

  // 3. rhumb lattice: 16 nodes on a circle plus the centre, 32 rhumb lines each, in three inks
  const rays = latticeOf(scene, data);
  const inks = [STYLE.ink, STYLE.windRed, STYLE.windGreen]; // by kind: wind, quarter-wind, half-wind
  const show = scene.show ?? { kinds: new Set(KINDS), names: true, rhumb: true };
  for (const [kind, ink] of show.rhumb ? inks.entries() : []) {
    const lines = rays.filter((ray) => ray.kind === kind && meets(r, ray.box)).map((ray) => ray.line);
    limn(g, lines, data.proj.x, data.proj.y, { color: ink, alpha: STYLE.rhumbAlpha, width: STYLE.rhumbWidth, oneStroke: true, lonCenter: data.proj.lonCenter });
  }

  // 3.5 cities, over their urban footprint and on land only (a lagoon city over its water too),
  // under the coast and the ornaments
  for (const t of scene.towns) {
    if (!t.city || !meets(r, t.city.box)) continue;
    drawCity(g, t.city.plan, r, {
      ink: STYLE.ink, parchment: STYLE.parchment,
      clip: (cg) => {
        cg.beginPath();
        for (const ring of t.city.rings) ring.forEach(([x, y], i) => (i ? cg.lineTo(x, y) : cg.moveTo(x, y)));
        cg.clip('evenodd');
        if (t.city.lagoon) return; // a lagoon city stands over its water
        cg.beginPath();
        traceLand(cg, data, t.city.land);
        cg.clip('evenodd');
      },
    });
  }

  // 4. coast
  paintCoast(g, data, coast);

  // 4.5 town footprints: a city's built-up area, washed terracotta and edged in ink once its long
  // side passes URBAN_PX on screen, the wash coming in over the next half doubling of zoom; on land
  // only, as the footprint is coarser than the coast and would otherwise spill over the water.
  // Under a city plan the wash is light and its edge kept, so the built-up ground still reads as
  // one; elsewhere it is fuller and little houses stand in it, HOUSE_GAP apart on a lattice fixed
  // to the map, so a pan keeps them where they were.
  const plans = scene.towns.filter((t) => t.city), planned = new Set(plans.map((t) => t.city.poly));
  const under = (u) => planned.has(u.poly) || plans.some((t) => u.box.x0 < t.city.box.x1 && u.box.x1 > t.city.box.x0 && u.box.y0 < t.city.box.y1 && u.box.y1 > t.city.box.y0);
  const washes = idx.urban.map((u) => {
    const ramp = Math.min(1, 2 * (Math.max(u.box.x1 - u.box.x0, u.box.y1 - u.box.y0) * view.scale / URBAN_PX - 1)), plan = under(u);
    return { u, ramp, plan, a: ramp * (plan ? 0.3 : 0.62) };
  }).filter(({ u, a }) => a > 0 && meets(r, u.box));
  if (washes.length) {
    g.save(); g.beginPath(); traceLand(g, data, land); g.clip('evenodd');
    for (const { u, a } of washes) {
      fill(g, [u.poly], data.proj.x, data.proj.y, { color: STYLE.terracotta, alpha: a, lonCenter: data.proj.lonCenter });
      g.save(); g.beginPath(); trace(g, [u.poly], data.proj.x, data.proj.y, { lonCenter: data.proj.lonCenter });
      g.globalAlpha = Math.min(1, a * 1.5); g.strokeStyle = STYLE.ink; g.lineWidth = 0.8 / view.scale; g.stroke(); g.restore();
    }
    // clear of the town icons, which stand over them
    const icons = scene.towns.filter((t) => !t.city).map((t) => {
      const hw = (t.sprite ? (t.h * t.sprite.img.width) / t.sprite.img.height : t.h * 0.6) / 2 + 4;
      return { x0: t.x - hw, x1: t.x + hw, y0: t.y - t.h - 4, y1: t.y + 6 };
    });
    const pts = housesIn(washes.filter((w) => !w.plan), data, scene.field, plans, r), clear = [];
    for (let i = 0; i < pts.length; i += 4) if (!icons.some((b) => pts[i] > b.x0 && pts[i] < b.x1 && pts[i + 1] > b.y0 && pts[i + 1] < b.y1)) clear.push(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]);
    drawHouses(g, clear, { ink: STYLE.ink });
    g.restore();
  }

  // 5. roses
  const spriteIn = (s, x, y, size) => disc(r, x, y, Math.hypot(size, (size * s.img.height) / s.img.width));
  for (const d of show.kinds.has('rose') ? scene.roseDraws : []) if (spriteIn(d.sprite, d.x, d.y, d.size)) drawSprite(g, d.sprite, d.x, d.y, d.size, { anchor: [0.5, 0.5] });

  // 5.5 mountains, inland, under the towns and names
  for (const m of show.kinds.has('mountain') ? scene.mountains ?? [] : []) if (spriteIn(m.sprite, m.x, m.y, m.size)) drawSprite(g, m.sprite, m.x, m.y, m.size, { anchor: [0.5, 0.5] });

  // 6. towns
  for (const t of scene.towns) {
    if (t.city) continue;
    if (!t.sprite) { if (disc(r, t.x, t.y - t.h / 2, t.h * 0.75)) drawTower(g, t); continue; }
    const h = t.h, w = (h * t.sprite.img.width) / t.sprite.img.height;
    if (disc(r, t.x, t.y - h / 2, Math.hypot(w, h) / 2)) drawSprite(g, t.sprite, t.x, t.y, w, { anchor: [0.5, 1] });
  }

  // 7. names, in ink, the chief towns in red; the continents and regions first, under them. Those
  // have their own settings, so they are drawn whether or not the other names are.
  g.save();
  g.fillStyle = STYLE.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const w of scene.worldNames) {
    if (!disc(r, w.x, w.y, w.r)) continue;
    g.font = `${w.italic ? 'italic ' : ''}${w.size}px "${STYLE.font}"`;
    g.letterSpacing = `${w.spacing}px`;
    g.fillText(w.text, w.x + w.spacing / 2, w.y); // the trailing space of the last letter, taken back
  }
  g.restore();
  const shown = show.names ? scene.names.filter((n) => disc(r, n.x, n.y, n.r)) : [];
  // a city's name on a parchment plate, so it reads over the roofs
  for (const n of shown.filter((n) => n.plate)) {
    const { cx, cy, hw, hh } = n.box;
    g.fillStyle = hexA(STYLE.parchment, 0.92); g.fillRect(cx - hw - 4, cy - hh - 1, 2 * hw + 8, 2 * hh + 2);
    g.strokeStyle = hexA(STYLE.windRed, 0.7); g.lineWidth = 0.75; g.strokeRect(cx - hw - 4, cy - hh - 1, 2 * hw + 8, 2 * hh + 2);
  }
  const opts = letterOptions(data);
  letter(g, shown.filter((n) => !n.red), data.proj.x, data.proj.y, { ...opts, color: STYLE.ink });
  letter(g, shown.filter((n) => n.red), data.proj.x, data.proj.y, { ...opts, color: STYLE.windRed });

  // 8. monsters, 9. ships
  for (const m of show.kinds.has('monster') ? scene.monsters : []) if (spriteIn(m.sprite, m.x, m.y, m.size)) drawSprite(g, m.sprite, m.x, m.y, m.size, { flip: m.flip, anchor: [0.5, 0.5] });
  for (const s of show.kinds.has('ship') ? scene.ships : []) if (spriteIn(s.sprite, s.x, s.y, s.size)) drawSprite(g, s.sprite, s.x, s.y, s.size, { flip: s.flip, rot: s.flip ? -s.tilt : s.tilt, anchor: [0.5, 0.6] });

  // 10. cartouche, lettered in its cleared panel
  const c = scene.cartouche;
  if (!show.kinds.has('cartouche') || !meets(r, { x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h })) { g.restore(); drawScaleBar(g, data, bg, view, W, H, show.scale, scene.scaleSprite); return; }
  const [px0, py0, px1, py1] = c.sprite.panel;
  const pw = (px1 - px0) * c.w, ph = (py1 - py0) * c.h;
  g.save();
  g.beginPath(); g.rect(c.x + px0 * c.w, c.y + py0 * c.h, pw, ph); g.clip();
  bgPart(c.x + px0 * c.w, c.y + py0 * c.h, c.x + px1 * c.w, c.y + py1 * c.h);
  g.restore();
  if (c.sprite.plain) drawPlainFrame(g, c); else drawSprite(g, c.sprite, c.x, c.y, c.w, { anchor: [0, 0] });
  g.save();
  g.fillStyle = STYLE.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let fpx = ph * 0.62;
  g.font = `${fpx}px "${STYLE.font}"`;
  g.letterSpacing = `${fpx * 0.12}px`;
  while (fpx > 6 && g.measureText(c.title).width > pw * 0.86) { fpx -= 1; g.font = `${fpx}px "${STYLE.font}"`; g.letterSpacing = `${fpx * 0.12}px`; }
  g.fillText(c.title, c.x + (px0 * c.w) + pw / 2 + fpx * 0.06, c.y + py0 * c.h + ph * 0.54);
  g.restore();

  g.restore();
  drawScaleBar(g, data, bg, view, W, H, show.scale, scene.scaleSprite);
}

// ---------------------------------------------------------------- setup

// Load data and packs, place the ornaments, paint the parchment. `opts`: ink and parchment
// colours (hex), density and view; defaults reproduce the committed mockup. `sprites` is the
// selection drawn, a list of keys (listSprites; defaultSprites when left out), and may mix packs,
// families and the shapes drawn in code; the town families it holds take turns among the towns,
// sized by `townSize`, 'area' (the default), 'population' or 'rank' (TOWN_SIZES). The older `rendering` (one of
// RENDERINGS) with the `rose`, `monster` and `town` styles (listStyles; town 'tower' is drawn in code)
// still choose a selection when `sprites` is left out; such a caller keeps rank sizing by default and the
// unshuffled monster and ship order, so old links and callers draw as they did.
// `kinds` (the ornament kinds drawn, of KINDS), `names` and `rhumb` (booleans), `scale` (a SCALE_NAMES entry, or 'off'),
// `continents` (boolean) and `regions` ('off', 'latin' or 'english'); the continents follow the regions' language, Latin when those are off.
// `land`: a LANDS entry, the land treatment ('islands' by default); `redSea` (boolean) tints the Red Sea red.
// `rivers` and `lakes`: a RIVER_STYLES and a LAKE_STYLES entry (water.mjs), each 'off' by default.
// `autoTitle` (boolean, on by default) letters the cartouche with the name the view is about (viewTitle), in capitals;
// `title` is its lettering when that is off, or when the view has no name in it.
// `kinds` defaults to DEFAULT_KINDS, every kind. A kind left out is still
// placed when the lattice needs it (a rose, the cartouche's corner), only not drawn.
export async function createScene(environment, opts = {}) {
  env = environment;
  const { ink = '#3b2a1a', parchment: tone = '#e9d8b4', density = 1, rendering = 'vivid', rose = 'aguiar', monster = 'carta-marina', town = 'tower', townSize, names = true, rhumb: rhumbOn = true, scale = 'genoese', continents = false, regions = 'off', title = 'PORTOLANI', autoTitle = true, land: landMode = 'islands', redSea = false, rivers = 'off', lakes = 'off' } = opts;
  const legacy = ['rendering', 'rose', 'monster', 'town'].some((k) => opts[k] !== undefined);
  const townBy = townSize ?? (legacy ? 'rank' : 'area');
  const show = { kinds: new Set(opts.kinds ?? DEFAULT_KINDS), names, rhumb: rhumbOn, scale };
  const view = clampView(opts.view ?? DEFAULT_VIEW);
  STYLE.ink = ink;
  STYLE.parchment = tone;
  STYLE.landMode = LANDS.includes(landMode) ? landMode : 'islands';
  STYLE.rivers = RIVER_STYLES.includes(rivers) ? rivers : 'off';
  STYLE.lakes = LAKE_STYLES.includes(lakes) ? lakes : 'off';
  TUNE.monsterMax = Math.round(4 * density);
  TUNE.shipMax = Math.round(2 * density);
  TUNE.townGap = 48 / density;
  TUNE.mountainMax = Math.round(3 * density);

  const t0 = performance.now();
  // only the sprites the settings choose are fetched, whichever kinds are shown, never a whole pack;
  // PLAIN stands in for roses and cartouche with shapes drawn in code. A picture scale bar comes
  // from the vivid pack whatever the selection.
  const sprites = readManifests().then(async (manifests) => {
    const chosen = opts.sprites ? selectSprites(manifests, opts.sprites)
      : legacy ? chooseSprites(manifests, { rendering, rose, monster, town })
      : selectSprites(manifests, defaultSprites(spriteList(manifests)));
    const all = (list) => Promise.all(list.map(withImage));
    const picture = scale in SCALE_PICTURES && manifests.vivid.sprites.find((s) => s.id === SCALE_PICTURES[scale]);
    const [roses, monsters, ships, towns, mountains, cartouche, scaleSprite] = await Promise.all([
      all(chosen.roses), all(chosen.monsters), all(chosen.ships), all(chosen.towns), all(show.kinds.has('mountain') ? chosen.mountains : []),
      chosen.cartouche && withImage(chosen.cartouche), picture && withImage({ ...picture, pack: 'vivid', colour: manifests.vivid.colour ?? 'source' }),
    ]);
    return {
      roses: roses.length ? roses : PLAIN.filter((s) => s.kind === 'rose'), cartouche: cartouche || PLAIN.find((s) => s.kind === 'cartouche'),
      monsters, ships, towns, tower: chosen.tower, mountains, scaleSprite: scaleSprite || null,
    };
  });
  const [, coarse, chosen] = await Promise.all([env.loadFont(STYLE.font), loadWorld(), sprites]);
  const { scaleSprite, ...placed } = chosen;
  redSeaPolys = redSea ? geojsonPolygons(await env.readJSON('geo/red-sea-50m.json')) : null;
  if (STYLE.rivers !== 'off' || STYLE.lakes !== 'off') water = await loadWater();
  const world = view.zoom > DETAIL_ZOOM ? await loadDetail(coarse, view) : coarse;
  const tLoad = performance.now();

  const data = viewData(world, view);
  const scene = { ...buildScene(data, placed, createCanvas(10, 10).getContext('2d'), { continents: continents && (regions === 'english' ? 'english' : 'latin'), regions, title, autoTitle,
    scaleBar: scale in SCALE_STYLES && view.zoom >= SCALE_MIN_ZOOM, townSize: townBy, seed: legacy ? null : castSeed(view) }), show, scaleSprite };
  if (!parchments.has(tone)) parchments.set(tone, parchment(1539));
  const bg = parchments.get(tone);
  return { scene, data, bg, proj: data.proj, world, coarse, view, timing: { load: tLoad - t0, place: performance.now() - tLoad } };
}
const parchments = new Map(); // by tone; the same seed paints the same sheet

export const RENDERINGS = ['vivid', 'scanned', 'plain'];
export const REGION_LANGS = ['off', 'latin', 'english'];
export const KINDS = ['rose', 'ship', 'monster', 'cartouche', 'mountain'];
export const DEFAULT_KINDS = KINDS;
export const PROJECTION_NAMES = Object.keys(PROJECTIONS);
export const TOWN_SIZES = ['area', 'population', 'rank'];
export { RIVER_STYLES, LAKE_STYLES };
export { SCALE_NAMES, readManifests, listStyles, listSprites, defaultSprites, selectSprites, chooseSprites, drawScene, drawGround, covers, panView, zoomView, clampView, DEFAULT_VIEW, ZOOM, DETAIL_ZOOM, W, H, DETAIL };
