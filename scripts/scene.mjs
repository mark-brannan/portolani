// Portolani mockup scene: placement (buildScene) and draw order (drawScene), independent of where
// it runs. A host (scripts/render.mjs in Node, public/page.js in a browser) supplies an
// environment: createCanvas(w, h), readJSON(path), loadImage(path), loadFont(). Paths are logical:
// `geo/<id>.geojson`, a coastlines data id, `geo/<band>/<cell>.json`, a detail cell cut by
// scripts/build-preview.mjs (close views only), and `packs/<pack>/<file>`. Land, wash, coast and
// lattice are drawn in lon/lat through coast-wright, so any view or projection draws the same way.
// A view is a centre, zoom and projection, { lon, lat, zoom, projection }, on a W x H canvas; the
// projection is one of PROJECTIONS, Mercator when left out.

import { sheetsFor, inShadow, cutOut, BANDS as ATLAS_BANDS, ROSE as ATLAS_ROSE } from './atlas.mjs';
import { fill, trace, limn, rhumb, place, letter, geojsonPolygons, geojsonRings } from 'coast-wright';
import { bandOf } from './bands.mjs';
import { islandInfo, ISLAND_KM2 } from './island.mjs';
import { islesOf } from './isles.mjs';
import { cityPlan, drawCity, drawHouses, pxRings, insideRings } from './city.mjs';
import { urbanKey } from './urban.mjs';
import { RIVERS, LAKES, RIVER_STYLES, LAKE_STYLES, waterOf, shown } from './water.mjs';
import { RELIEF_STYLES, reliefOf, clearOf, drawRelief } from './relief.mjs';
import { TREES, TREE_STYLES, plantTrees, plantPalms } from './trees.mjs';
import { POIS, POI_ZOOM } from './pois.mjs';
import { BUILDINGS, LESSER_RANK, LESSER_PX, LESSER_LETTER, lesserBuilding } from './buildings.mjs';

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
  relief: [], // the drawn styles of RELIEF_STYLES, mixed per range, set by createScene
  mountainSprites: false, // the Catalan sprites are selected, and stand on the hills; set by createScene
  islands: false, // the small islands washed in the three pigments, set by createScene
  scaleBorder: 'bordered', // one of SCALE_BORDERS, set by createScene
  trees: 'off', // one of TREE_STYLES, set by createScene
  // How much of the map's growth within a band each kind of ornament takes (docs/atlas, "What size an
  // ornament is"): 1 is ink on the map and grows with it, 0 holds a fixed pixel size, 0.5 the square root.
  // A rhumb line's stroke is 0 and its reach 1; the lines are geography. Tuned by eye, a number per kind.
  sizeFactor: { rose: 0.5, monster: 0, ship: 0, town: 0.5, names: 0, mountain: 1 },
  font: 'IM Fell English',
  fonts: ['IM Fell English', 'Georgia', 'serif'], // the stack names are lettered in; the first is loaded
};

const W = 1600, H = 1000;
const FRAME = { lonMin: -6, lonMax: 20, latMin: 34, latMax: 46 };
const MARGIN = 2; // degrees beyond FRAME whose features the scene keeps
const DETAIL = { lon: 8.93, lat: 44.41, scale: 2 }; // Genoa; window clamped to the scene
// Whole world at the far end; 50m data holds to about z9. The bands are read from the catalogue
// (scripts/bands.mjs reads scripts/catalogue.json, a copy of coastlines' catalogue.json until the package publishes it; build-preview.mjs reads the same records to write the cells):
// past a record's `zoom.min` a view draws from its cells (geo/<dir>/<xi>_<yi>.json, `grid.cellDeg`
// degrees square) within `grid.marginDeg` degrees of its frame, a couple of screens at the band's
// first zoom, so a pan stays on loaded cells; a band whose index the site lacks is skipped and the
// one below it drawn instead. Measured vertex spacing (median, m): 50m 7,650; NE 10m 1,574; GSHHG h 707.
const BANDS = ['ne-10m-land', 'gshhg-h-land', 'gshhg-f-land'].map(bandOf);
const ZOOM = { min: 1, max: 15 };
const URBAN_PX = 56; // screen px a built-up area's long side reaches before it is drawn

// Land treatments after the period charts: 'gilt' (today's wash), 'green' (Oliva, c.1590), 'ochre'
// with a dotted shoal line off the coast (Benincasa, 1466) and 'islands' (Beccari, 1403): an ochre
// coast wash and every island under ISLAND_KM2 filled red, green or gold, each keeping its colour.
export const LANDS = ['off', 'islands', 'gilt', 'green', 'ochre'];
export const SCALE_BORDERS = ['bordered', 'blank', 'transparent'];
const LAND_WASH = { gilt: STYLE.gilt, green: STYLE.green, ochre: STYLE.ochre, islands: STYLE.ochre };
const SHOAL_OFFSET = 4, SHOAL_GAP = 6; // px seaward of the coast, and between dots
let tintPolys = null; // the seas to tint, or null
// Rivers and lakes (water.mjs), from the 50m files, loaded once the first style that draws them is
// chosen, and past WATER_ZOOM from Natural Earth 10m with its regional supplements, cut into
// WATER_10M's cells (cutWater), the cells around the view; a site without them keeps the 50m. A
// lake or river is drawn where its box meets the view widened by WATER_PX.
let water = null, waterLoad = null;
const WATER_10M = bandOf('ne-10m-water');
// Where the 10m water takes over from the 50m, two zooms before the 10m land: the 50m lakes file has
// no Lake Washington, Maggiore or Como, and at 5-degree cells a z7 view fetches the cells a z9 one
// does (Seattle 8 cells, 0.7 MB; the Great Lakes 12, 1.7 MB).
const WATER_ZOOM = WATER_10M.zoom;
const WATER_PX = 64; // a lozenge and its tributaries reach past the lake they stand for
const loadWater = () => (waterLoad ??= Promise.all(['ne-rivers-lake-centerlines-50m', 'ne-lakes-50m'].map(loadGeo))
  .then(([r, l]) => waterOf(r, l)).catch((e) => { waterLoad = null; throw e; })); // a failed fetch is tried again
const DETAIL_ZOOM = BANDS[0].zoom;
const waterCells = new Map(); // 'water-10m/<xi>_<yi>' -> waterOf of the cell
async function loadWater10m(view) {
  const known = await loadBandIndex(WATER_10M);
  if (!known) return null;
  const parts = await Promise.all(cellsAround(WATER_10M, view, known).map((k) => {
    if (!waterCells.has(k)) waterCells.set(k, env.readJSON(`geo/${k}.json`).then((c) => waterOf(c.rivers, c.lakes)).catch((e) => { waterCells.delete(k); throw e; }));
    return waterCells.get(k);
  }));
  const once = (list) => [...new Map(list.map((w) => [w.id, w])).values()]; // a feature reaching several cells is in each
  return { rivers: once(parts.flatMap((p) => p.rivers)), lakes: once(parts.flatMap((p) => p.lakes)) };
}

// GSHHG lakes past the h band's zoom, at the h or f resolution as the land is: the lakes no Natural
// Earth file has (Dian Chi at Kunming, Lago Mascardi at Bariloche), cut as land is so a piece fills
// its cell and only the shore is inked. A view adds them to its water and drops each Natural Earth
// lake that is one of them (sameLake), so a lake is not drawn twice.
const LAKE_BANDS = ['gshhg-h-lakes', 'gshhg-f-lakes'].map(bandOf);
const lakeCells = new Map(); // '<dir>/<xi>_<yi>' -> Map(lake id -> { polys, shore, box })
async function loadLakes(view) {
  for (const b of LAKE_BANDS) if (view.zoom > b.zoom) await loadBandIndex(b);
  const band = LAKE_BANDS.filter((b) => view.zoom > b.zoom && bandIndex.get(b.dir)).at(-1);
  if (!band) return [];
  const parts = await Promise.all(cellsAround(band, view, bandIndex.get(band.dir)).map((k) => {
    if (!lakeCells.has(k)) lakeCells.set(k, env.readJSON(`geo/${k}.json`).then((c) => {
      const lakes = new Map(), lake = (id) => lakes.get(id) ?? lakes.set(id, { polys: [], shore: [] }).get(id);
      c.land.forEach((poly, i) => { const [id, x0, y0, x1, y1] = c.m[i], l = lake(id); l.polys.push(poly); l.box = { x0, y0, x1, y1 }; });
      c.coast.forEach((line, i) => lake(c.cm[i]).shore.push(line));
      return lakes;
    }).catch((e) => { lakeCells.delete(k); throw e; }));
    return lakeCells.get(k);
  }));
  // a lake reaching several cells is one feature, its pieces and shores joined
  const joined = new Map();
  for (const p of parts) for (const [id, l] of p) {
    const j = joined.get(id) ?? joined.set(id, { id: `gshhg-${id}`, key: `gshhg-${id}`, polys: [], shore: [], box: l.box, minZoom: 0 }).get(id);
    j.polys.push(...l.polys); j.shore.push(...l.shore);
    if (l.box) j.box = l.box;
  }
  return [...joined.values()].filter((l) => l.box);
}
// A Natural Earth lake is the same lake as a GSHHG one, and dropped, when its box lies inside the
// GSHHG lake's within LAKE_SLACK degrees (about Natural Earth 10m's vertex spacing: its Biwa reaches
// 0.004 past GSHHG's) and a point of it, a ring's centroid or a vertex, lies in the GSHHG water. The
// box alone would drop every lake inside Superior's or the Caspian's box: 151 worldwide, Lake Panache
// by Sudbury among them.
const LAKE_SLACK = 0.02;
const inside = (a, b) => a.x0 >= b.x0 - LAKE_SLACK && a.x1 <= b.x1 + LAKE_SLACK && a.y0 >= b.y0 - LAKE_SLACK && a.y1 <= b.y1 + LAKE_SLACK;
const inRing = ([px, py], ring) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const inWater = (p, polys) => polys.some((poly) => inRing(p, poly[0]) && !poly.slice(1).some((hole) => inRing(p, hole)));
const centroid = (ring) => {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1], w = x0 * y1 - x1 * y0;
    a += w; x += (x0 + x1) * w; y += (y0 + y1) * w;
  }
  return a ? [x / (3 * a), y / (3 * a)] : ring[0];
};
const sameLake = (l, g) => inside(l.box, g.box) && l.polys.some((poly) => inWater(centroid(poly[0]), g.polys) || poly[0].some((p, i) => i % 4 === 0 && inWater(p, g.polys)));
const withLakes = (w, lakes) => (lakes.length ? { ...w, lakes: [...w.lakes.filter((l) => !lakes.some((g) => sameLake(l, g))), ...lakes] } : w);

// Per-run tuning; `density` scales how much ornament is placed (1 = the committed mockup).
// `hillShare`: the share of the hill sprites that fit which stand, all of them from density 1.
const TUNE = { monsterMax: 4, shipMax: 2, townGap: 48, hillShare: 1 };

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

// A projection is cylindrical or azimuthal. Cylindrical: x is longitude, the same in each, and y is
// f(lat) in radians of longitude, with inv its inverse and max the y of the map's top edge. Rhumb
// lines are straight only on Mercator, which is why he drew it; on the others they bow toward the
// poles. Azimuthal: about the view's centre, north up; r(c) is the radius, in radians of longitude at
// the centre, of a point c radians away, inv its inverse, and cap the distance past which a point
// is refused: the globe's far side, the equidistant's antipode (every bearing meets there) and the
// stereographic's far reaches, which run off to infinity. The scale at the centre is the same in all.
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
  orthographic: { r: Math.sin, inv: Math.asin, cap: Math.PI / 2 }, // the globe as seen from afar
  'azimuthal-equidistant': { r: (c) => c, inv: (r) => r, cap: Math.PI - 15 * RAD }, // distance and bearing true from the centre
  stereographic: { r: (c) => 2 * Math.tan(c / 2), inv: (r) => 2 * Math.atan(r / 2), cap: 150 * RAD }, // conformal, the polar chart's
};
const projectionOf = (view) => PROJECTIONS[Object.hasOwn(PROJECTIONS, view.projection) ? view.projection : 'mercator'];
const POLE = 90 - 1e-4; // an azimuthal centre stops a hair short of the pole, where a bearing means nothing

// Great-circle moves, in degrees: the point `d` radians from (lon, lat) on bearing `az` (radians,
// clockwise from north), and the bearing from one point toward another.
function destination([lon, lat], az, d) {
  const p1 = lat * RAD, sd = Math.sin(d), cd = Math.cos(d);
  const p2 = Math.asin(Math.sin(p1) * cd + Math.cos(p1) * sd * Math.cos(az));
  return [lon + Math.atan2(Math.sin(az) * sd * Math.cos(p1), cd - Math.sin(p1) * Math.sin(p2)) / RAD, p2 / RAD];
}
function bearing([lon1, lat1], [lon2, lat2]) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lon2 - lon1) * RAD;
  return Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl));
}
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// The view's projection centred on it; longitudes are measured from its centre, so any seam is behind
// it. `seam` is what every coast-wright call takes: the centre longitude and, on an azimuthal
// projection, the `visible` predicate that refuses the far side; `rim` is the px radius of what it
// shows, null on a cylindrical projection. `toPx` is the same projection as coast-wright's
// `project([lon, lat])` takes it, returning [px, py].
function makeProjection(view, w = W, h = H) {
  const P = projectionOf(view), k = kOf(view.zoom), lonCenter = view.lon;
  if (!P.cap) {
    const y0 = P.f(view.lat);
    // x(lon) and y(lat), for the cylindrical case
    const x = (lon) => w / 2 + fromCentre(lon - lonCenter) * RAD * k;
    const y = (lat) => h / 2 - (P.f(lat) - y0) * k;
    return {
      k, zoom: view.zoom, lonCenter, lat: view.lat, x, y, seam: { centralMeridian: lonCenter }, rim: null,
      project: (lon, lat) => [x(lon), y(lat)],
      toPx: ([lon, lat]) => [x(lon), y(lat)],
      // a point past the map's top or bottom edge inverts to the edge's latitude
      invert: (px, py) => [lonCenter + (px - w / 2) / k / RAD, P.inv(Math.max(-P.max, Math.min(P.max, y0 - (py - h / 2) / k)))],
    };
  }
  const p1 = view.lat * RAD, sp1 = Math.sin(p1), cp1 = Math.cos(p1), cosCap = Math.cos(P.cap), rimR = P.r(P.cap);
  // the point's offset from the centre, in radians of longitude at the centre, east and north
  const offset = (lon, lat) => {
    const p = lat * RAD, dl = (lon - lonCenter) * RAD, cp = Math.cos(p), sp = Math.sin(p), cdl = Math.cos(dl);
    const cosc = sp1 * sp + cp1 * cp * cdl, sinc = Math.sqrt(Math.max(0, 1 - cosc * cosc));
    const m = sinc < 1e-12 ? 1 : P.r(Math.acos(Math.max(-1, Math.min(1, cosc)))) / sinc;
    return [cp * Math.sin(dl) * m, (cp1 * sp - sp1 * cp * cdl) * m];
  };
  const x = (lon, lat) => w / 2 + offset(lon, lat)[0] * k;
  const y = (lat, lon) => h / 2 - offset(lon, lat)[1] * k;
  const visible = (lon, lat) => {
    const p = lat * RAD;
    return sp1 * Math.sin(p) + cp1 * Math.cos(p) * Math.cos((lon - lonCenter) * RAD) > cosCap;
  };
  return {
    k, zoom: view.zoom, lonCenter, lat: view.lat, x, y, visible, seam: { centralMeridian: lonCenter, visible }, rim: rimR * k, cap: P.cap,
    project: (lon, lat) => { const [ox, oy] = offset(lon, lat); return [w / 2 + ox * k, h / 2 - oy * k]; },
    toPx: ([lon, lat]) => { const [ox, oy] = offset(lon, lat); return [w / 2 + ox * k, h / 2 - oy * k]; },
    // a point past the rim inverts to the rim
    invert: (px, py) => {
      const ox = (px - w / 2) / k, oy = (h / 2 - py) / k, d = Math.hypot(ox, oy);
      if (d < 1e-12) return [lonCenter, view.lat];
      const rho = Math.min(d, rimR), c = P.inv(rho), sc = Math.sin(c), cc = Math.cos(c);
      const lat = Math.asin(Math.max(-1, Math.min(1, cc * sp1 + (oy / d) * sc * cp1)));
      return [lonCenter + Math.atan2((ox / d) * sc, cp1 * cc - sp1 * (oy / d) * sc) / RAD, lat / RAD];
    },
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
// whole map is shorter than the canvas; an azimuthal centre goes anywhere short of the poles.
function clampView({ lon, lat, zoom, projection }) {
  zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, zoom));
  projection = Object.hasOwn(PROJECTIONS, projection) ? projection : 'mercator';
  const P = PROJECTIONS[projection];
  if (P.cap) return { lon: wrapLon(lon), lat: Math.max(-POLE, Math.min(POLE, lat)), zoom, projection };
  const room = Math.max(0, P.max - H / 2 / kOf(zoom));
  return { lon: wrapLon(lon), lat: P.inv(Math.max(-room, Math.min(room, P.f(lat)))), zoom, projection };
}

// The view moved so the map follows a drag of (dx, dy) canvas px. On an azimuthal projection the
// centre rolls along a great circle, a radian per k px; the move is read in the view centred on the
// way's midpoint, so that the reverse drag comes back to the same view (north-up bearings converge
// otherwise). A drag over a pole has no north-up answer, so it stops at the pole.
function panView(view, dx, dy) {
  const P = projectionOf(view), k = kOf(view.zoom);
  if (!P.cap) return clampView({ ...view, lon: view.lon - dx / k / RAD, lat: P.inv(P.f(view.lat) + dy / k) });
  const d = Math.min(Math.PI, Math.hypot(dx, dy) / k), az = Math.atan2(-dx, dy), c = [view.lon, view.lat];
  if (d < 1e-12) return clampView(view);
  let b = az, mid, err = Infinity;
  for (let i = 0; i < 24 && Math.abs(err) > 1e-13; i++) { // the bearing from the centre to the midpoint, from which the centre lies on az + 180
    mid = destination(c, b, d / 2);
    err = wrapAngle(az + Math.PI - bearing(mid, c));
    b += err;
  }
  const [lon, lat] = Math.abs(err) < 1e-9 ? destination(mid, az, d / 2) : destination(c, az, d);
  if (Math.abs(fromCentre(lon - view.lon)) > 90) return clampView({ ...view, lat: Math.sign(view.lat) * POLE }); // past the pole
  return clampView({ ...view, lon, lat });
}

// The view zoomed by `factor` about canvas point (px, py), which keeps its place on the map.
function zoomView(view, factor, px, py) {
  const P = projectionOf(view), k = kOf(view.zoom), ox = px - W / 2, oy = py - H / 2;
  const zoom = Math.min(ZOOM.max, Math.max(ZOOM.min, view.zoom + Math.log2(factor))), k2 = kOf(zoom);
  if (!P.cap) {
    const lon = view.lon + (ox / k - ox / k2) / RAD;
    return clampView({ ...view, lon, lat: P.inv(P.f(view.lat) - oy / k + oy / k2), zoom });
  }
  const proj = makeProjection(view), at = proj.invert(px, py);
  if (Math.hypot(ox, oy) / k >= P.r(P.cap)) return clampView({ ...view, zoom }); // off the map: about the centre
  // the centre that puts `at` back under (px, py): `at` lies c2 from it on the pointer's screen angle, a
  // spherical triangle with the pole solved for the centre's latitude (two roots; the one that lands
  // `at` nearest the pointer wins) and then its longitude
  const ang = Math.atan2(ox, -oy), rho2 = Math.hypot(ox, oy) / k2;
  if (rho2 >= P.r(P.cap)) return clampView({ ...view, zoom });
  const c2 = P.inv(rho2), sc2 = Math.sin(c2), cc2 = Math.cos(c2);
  const R = Math.hypot(cc2, sc2 * Math.cos(ang)), delta = Math.atan2(sc2 * Math.cos(ang), cc2);
  const sArg = Math.max(-1, Math.min(1, Math.sin(at[1] * RAD) / R));
  let c = [view.lon, view.lat], best = Infinity;
  for (const phi of [Math.asin(sArg) - delta, Math.PI - Math.asin(sArg) - delta]) {
    const lat = wrapAngle(phi);
    if (Math.abs(lat) > Math.PI / 2) continue; // a latitude past a pole is the other root
    const dl = Math.atan2(Math.sin(ang) * sc2 * Math.cos(lat), cc2 - Math.sin(lat) * Math.sin(at[1] * RAD));
    const cand = [at[0] - dl / RAD, lat / RAD];
    const [qx, qy] = makeProjection({ ...view, lon: cand[0], lat: cand[1], zoom }).project(...at);
    const e = Math.hypot(qx - px, qy - py);
    if (e < best) { best = e; c = cand; }
  }
  if (best > 1) return clampView({ ...view, zoom }); // no north-up centre keeps it there (it wants a pole): about the centre
  return clampView({ ...view, lon: c[0], lat: c[1], zoom });
}

// The lon/lat frame a projection paints, widened by `margin` degrees. An azimuthal view whose canvas
// holds a pole or the rim takes all it can show; otherwise the canvas edge bounds it.
function frameOf(proj, margin) {
  if (!proj.rim) {
    const half = W / 2 / proj.k / RAD;
    return {
      lonMin: proj.lonCenter - half - margin, lonMax: proj.lonCenter + half + margin,
      latMin: proj.invert(0, H)[1] - margin, latMax: proj.invert(0, 0)[1] + margin,
    };
  }
  const onCanvas = ([x, y]) => x >= 0 && x <= W && y >= 0 && y <= H;
  const pole = [90, -90].some((lat) => proj.visible(0, lat) && onCanvas(proj.project(0, lat)));
  const rimIn = [[0, 0], [W, 0], [0, H], [W, H]].some(([x, y]) => Math.hypot(x - W / 2, y - H / 2) >= proj.rim);
  if (pole || rimIn) {
    const reach = proj.cap / RAD;
    return { lonMin: proj.lonCenter - 180 - margin, lonMax: proj.lonCenter + 180 + margin, latMin: Math.max(-90, proj.lat - reach) - margin, latMax: Math.min(90, proj.lat + reach) + margin };
  }
  let dMin = 0, dMax = 0, latMin = 90, latMax = -90;
  const STEP = 50;
  for (let t = 0; t <= Math.max(W, H); t += STEP) {
    for (const [x, y] of [[Math.min(t, W), 0], [Math.min(t, W), H], [0, Math.min(t, H)], [W, Math.min(t, H)]]) {
      const [lon, lat] = proj.invert(x, y), d = fromCentre(lon - proj.lonCenter);
      if (d < dMin) dMin = d; if (d > dMax) dMax = d; if (lat < latMin) latMin = lat; if (lat > latMax) latMax = lat;
    }
  }
  return { lonMin: proj.lonCenter + dMin - margin, lonMax: proj.lonCenter + dMax + margin, latMin: latMin - margin, latMax: latMax + margin };
}
// Whether a projection shows a point: all of them on a cylindrical one, the near side on an azimuthal.
const shows = (proj, lon, lat) => !proj.visible || proj.visible(lon, lat);
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
// The parchment patch under the scale bar, roughly: what mountains and relief keep clear of.
const SCALE_BAR_BOX = obb(300, H - 90, 0, 270, 70);

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
  // the island index (scripts/isles.mjs) is optional too: without it the islands 50m lacks go unmarked
  const islesIndex = await env.readJSON('geo/isles.json').catch(missing);
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
  // the lesser places, drawn close in as buildings (buildings.mjs)
  const lesser = placesGeo.features.filter((f) => f.properties.SCALERANK > 4 && f.properties.SCALERANK <= LESSER_RANK)
    .map(({ properties: p, geometry: { coordinates: [lon, lat] } }) => ({ name: p.NAME, rank: p.SCALERANK, pop: p.POP_MAX, lon, lat }));
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
  const isles = islesOf(islesIndex).map((i) => ({ ...i, box: { x0: i.lon, x1: i.lon, y0: i.lat, y1: i.lat } }));
  world = { land, lines, runs, places, lesser, names, urban: urbanAreas, isles };
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
// The band's cells, '<dir>/<xi>_<yi>', that meet the view's frame widened by its margin and that the
// band's index (`known`) lists.
function cellsAround(band, view, known) {
  const f = frameOf(makeProjection(view), band.margin), deg = band.cell, n = 360 / deg;
  const keys = new Set();
  for (let xi = Math.floor(f.lonMin / deg); xi <= Math.floor(f.lonMax / deg); xi++) {
    const wx = ((((xi + n / 2) % n) + n) % n) - n / 2; // wrapped across the antimeridian
    for (let yi = Math.max(-90 / deg, Math.floor(f.latMin / deg)); yi <= Math.min(90 / deg - 1, Math.floor(f.latMax / deg)); yi++) {
      if (known.has(cellKey(wx, yi))) keys.add(`${band.dir}/${cellKey(wx, yi)}`);
    }
  }
  return [...keys];
}
async function loadDetail(coarse, view) {
  for (const b of BANDS) if (view.zoom > b.zoom) await loadBandIndex(b);
  const band = bandFor(view.zoom);
  if (!band) return coarse;
  const f = frameOf(makeProjection(view), band.margin);
  const parts = await Promise.all(cellsAround(band, view, bandIndex.get(band.dir)).map((k) => {
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
    places: coarse.places, lesser: coarse.lesser, names: coarse.names, urban: coarse.urban, isles: band.zoom < MARKS_END ? coarse.isles.filter((i) => nearLL(f, i.lon, i.lat)) : [], detail: { ...f, band: band.dir }, // the lon/lat frame the loaded cells cover, and whose
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

// The islands a world's land lacks (scripts/isles.mjs), worked out once per world: an index record
// is drawn where no land polygon holds its centre, nor, for an atoll, an islet within its ring.
// The GSHHG "h" band and those after it hold every island in the index, so a view drawn from them
// marks none (loadDetail).
const MARKS_END = bandOf('gshhg-h-land').zoom;
const lacking = new WeakMap();
function islesLacking(world) {
  if (!lacking.has(world)) {
    const holds = (i) => world.land.some(({ poly, box }) => SHIFTS.some((s) => {
      const lon = i.lon + s;
      if (i.atoll && Math.hypot(((box.x0 + box.x1) / 2 - lon) * Math.cos(i.lat * RAD), (box.y0 + box.y1) / 2 - i.lat) * KM_DEG < i.km) return true;
      return lon > box.x0 && lon < box.x1 && i.lat > box.y0 && i.lat < box.y1 && insideRing(poly[0], lon, i.lat);
    }));
    lacking.set(world, (world.isles ?? []).filter((i) => !holds(i)));
  }
  return lacking.get(world);
}
const KM_DEG = 6371.0088 * RAD;
// Where `proj` draws an island mark: px centre and radius, its true size never under MARK_MIN px
// (a dot) or ATOLL_MIN px (a ring round its lagoon), or null when it is behind the horizon.
const MARK_MIN = 1.5, ATOLL_MIN = 2.5;
function markOf(proj, i) {
  if (!shows(proj, i.lon, i.lat)) return null;
  const [x, y] = proj.project(i.lon, i.lat), r = Math.abs(proj.y(i.lat + i.km / KM_DEG, i.lon) - y);
  return { x, y, r: Math.max(i.atoll ? ATOLL_MIN : MARK_MIN, r), atoll: i.atoll };
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
      const cur = out[out.length - 1];
      if (!shows(proj, lon, lat)) { if (cur.length) out.push([]); continue; }
      const p = proj.project(lon, lat), prev = cur[cur.length - 1];
      if (prev && Math.abs(p[0] - prev[0]) > Math.PI * proj.k) out.push([p]); else cur.push(p);
    }
    return out.filter((l) => l.length > 1);
  });
  const shown = (p) => nearLL(f, p.lon, p.lat) && shows(proj, p.lon, p.lat);
  const places = world.places.filter(shown).map((p) => ({ ...p, xy: proj.project(p.lon, p.lat) }));
  const lesser = [...(view.zoom < POI_ZOOM ? [] : POIS.filter((p) => !world.places.some((q) => Math.hypot((q.lon - p.lon) * Math.cos(p.lat * RAD), q.lat - p.lat) < 0.3)).map((p) => ({ ...p, poi: true, rank: 0, pop: 0 }))),
    ...(view.zoom < DETAIL_ZOOM ? [] : world.lesser)].filter(shown).map((p) => ({ ...p, xy: proj.project(p.lon, p.lat) }));
  // names worth showing at this zoom (Natural Earth's min_label), most important first
  const names = world.names.filter((n) => n.min <= view.zoom + 1 && meetsLL(f, n.box))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'sea' ? -1 : 1) || a.rank - b.rank);
  const urban = world.urban.filter((u) => meetsLL(f, u.box)).map((u) => u.poly);
  const isles = islesLacking(world).filter((i) => nearLL(f, i.lon, i.lat));
  return { proj, land, coastLL, coast, places, lesser, names, urban, isles };
}

// Two packs draw the same designs two ways: `vivid` as vectors, `scanned` as crops of the scans.
// A third, `debry`, is one hand-coloured plate's own ships, monster, trees and villages. A
// sprite's `style` names its design family; a scene picks a rendering, then a style for each kind.
const PACK_NAMES = ['vivid', 'scanned', 'debry'];
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
    towers: ['tower'],
  };
}

// The share of a big rose's width that the best clear sea must reach, or the roses may stand on open land.
const LAND_ROSE = 0.25, LAND_ROSE_TOWN = 60; // and how far, px, a rose on land keeps from a place
const POI_ROOM = 90; // px a rose or a beast keeps clear of a point of interest
const TOWER_H = 16.5; // a tower's own height, in its drawing units, foot at y = 0

// The towers drawn in code, for the smallest towns: each a list of layers in SVG path data (absolute
// M L H V Q Z only), painted in order, `p` filled with parchment, `r` with the wind red, `k` with
// ink, `s` stroked only; every layer but `k` is stroked in ink. `w` is the half-width, for the icon's
// box. The same layers draw the page's picker glyphs (towerGlyph). The pennant (`f`) is red for a
// chief town, ink otherwise.
const TOWERS = [
  // square, three merlons, an arched door, a pennant
  { id: 'tower', w: 5, layers: [
    ['p', 'M-4 0V-9H-5V-12H-3V-10.5H-1V-12H1V-10.5H3V-12H5V-9H4V0Z'],
    ['s', 'M-1.5 0V-3Q-1.5 -4.5 0 -4.5Q1.5 -4.5 1.5 -3V0M0 -12V-16.5'],
    ['f', 'M0 -16.5L4.5 -15.2L0 -14Z'],
  ] },
  // a round drum under a hat band and a red cone, a slit window
  { id: 'tower-round', w: 4.4, layers: [
    ['p', 'M-3.5 0.4Q0 1.3 3.5 0.4V-9.4H-3.5Z'],
    ['p', 'M-4.2 -9.4H4.2V-10.6H-4.2Z'],
    ['r', 'M-4.2 -10.6L0 -16.5L4.2 -10.6Z'],
    ['s', 'M-1.2 0.7V-1.6Q-1.2 -2.8 0 -2.8Q1.2 -2.8 1.2 -1.6V0.7M0 -5V-7.2'],
  ] },
  // a gate between two towers under red cones, a pennant on the left
  { id: 'tower-gate', w: 8, layers: [
    ['p', 'M-4 0V-6.6H-2.9V-5.6H-1.6V-6.6H-0.5V-5.6H0.5V-6.6H1.6V-5.6H2.9V-6.6H4V0Z'],
    ['k', 'M-2 0V-2.6Q-2 -4.4 0 -4.4Q2 -4.4 2 -2.6V0Z'],
    ['p', 'M-8 0V-10H-4V0Z'], ['p', 'M4 0V-10H8V0Z'],
    ['r', 'M-8.6 -10L-6 -14.4L-3.4 -10Z'], ['r', 'M3.4 -10L6 -14.4L8.6 -10Z'],
    ['s', 'M-6 -5V-7M6 -5V-7M-6 -14.4V-16.5'],
    ['f', 'M-6 -16.5L-2.6 -15.5L-6 -14.6Z'],
  ] },
  // a church: the nave under a red roof, a belfry and its needle spire
  { id: 'tower-spire', w: 6.8, layers: [
    ['p', 'M-6.4 0V-6H1V0Z'],
    ['r', 'M-6.8 -6L-5.2 -8.8H1V-6Z'],
    ['p', 'M1 0V-10.2H5.2V0Z'],
    ['r', 'M0.6 -10.2L3.1 -16.5L5.6 -10.2Z'],
    ['s', 'M-4.6 -1.2V-3.6M-2.4 -1.2V-3.6M2.3 -6.2V-7.8Q3.1 -8.8 3.9 -7.8V-6.2M2.4 0V-2Q3.1 -3 3.8 -2V0'],
  ] },
  // a square keep, a drum and a red dome under a finial, Levantine
  { id: 'tower-dome', w: 4.8, layers: [
    ['p', 'M-4.4 0V-8H4.4V0Z'],
    ['p', 'M-4.8 -8H4.8V-8.9H-4.8Z'],
    ['p', 'M-3 -8.9V-10.4H3V-8.9Z'],
    ['r', 'M-3.5 -10.4Q-3.5 -14.6 0 -15.2Q3.5 -14.6 3.5 -10.4Z'],
    ['s', 'M0 -15.2V-16.5M-1.3 0V-2.4Q-1.3 -3.6 0 -3.6Q1.3 -3.6 1.3 -2.4V0M-2.6 -5V-6.4M2.6 -5V-6.4'],
  ] },
  ...BUILDINGS, // the Carta Marina's house, church, castle, round tower and tent (buildings.mjs)
];
const TOWER_BY_ID = new Map(TOWERS.map((t) => [t.id, t]));

// Sprites by key, `<pack>/<id>`, since ids repeat across packs (scanned/serpent-a, vivid/serpent-a).
// The shapes drawn in code are the pseudo-pack `plain`: its rose set, its cartouche frame, the tower.
const PLAIN_SPRITES = [
  { id: 'rose', kind: 'rose', style: 'plain' },
  { id: 'cartouche', kind: 'cartouche', style: 'plain' },
  ...TOWERS.map((t) => ({ id: t.id, kind: 'town', style: t.style ?? 'tower' })),
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
// the drawn heraldic one, every ship, every town (the towers and the Carta Marina's buildings included),
// every rose and every mountain. A decoration added to the packs is on unless the rule says otherwise.
const DEFAULT_RULES = [
  (s) => s.kind === 'rose',
  (s) => s.pack === 'vivid' && s.kind === 'cartouche',
  (s) => s.kind === 'monster' && ((s.pack === 'scanned' && (s.style === 'carta-marina' || s.style === 'pare')) || s.pack === 'debry' || (s.pack === 'vivid' && s.style === 'heraldic')),
  (s) => s.kind === 'ship',
  (s) => s.kind === 'town',
  (s) => s.kind === 'mountain',
];
function defaultSprites(list) {
  const keys = list.filter((s) => DEFAULT_RULES.some((rule) => rule(s))).map((s) => s.key);
  const cartouche = keys.find((k) => list.find((s) => s.key === k).kind === 'cartouche');
  return keys.filter((k) => list.find((s) => s.key === k).kind !== 'cartouche' || k === cartouche); // one cartouche
}

// What a selection of keys draws, in chooseSprites's shape; unknown keys are ignored. `towers` are
// the ids of the towers drawn in code it takes, `tower` whether it takes any.
// The first selected cartouche is the one; plain/rose and plain/cartouche are the PLAIN shapes.
function selectSprites(manifests, keys) {
  const want = new Set(keys), chosen = spriteList(manifests).filter((s) => want.has(s.key));
  const of = (kind) => chosen.filter((s) => s.kind === kind).flatMap((s) => (s.pack !== 'plain' ? [s] : kind === 'rose' ? PLAIN.filter((p) => p.kind === 'rose') : []));
  return {
    roses: of('rose'),
    cartouche: chosen.find((s) => s.kind === 'cartouche' && s.pack !== 'plain') ?? (want.has('plain/cartouche') ? PLAIN.find((s) => s.kind === 'cartouche') : null),
    monsters: of('monster'), ships: of('ship'), towns: of('town'), mountains: of('mountain'),
    tower: TOWERS.some((t) => want.has(`plain/${t.id}`)),
    towers: TOWERS.filter((t) => want.has(`plain/${t.id}`)).map((t) => t.id),
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

const traceLand = (g, data, polys = data.land) => trace(g, polys, data.proj.toPx, { ...data.proj.seam });
// The canvas outside an azimuthal projection's rim, as a path (even-odd); nothing on a cylindrical one.
function beyondRim(g, proj) {
  g.beginPath();
  if (!proj.rim) return;
  g.rect(-W, -H, 3 * W, 3 * H);
  g.arc(W / 2, H / 2, proj.rim, 0, 2 * Math.PI);
}

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

// Px from every point of the canvas to the nearest of `polys` (lon/lat, each filled even-odd), 0
// inside one, at CELL px as the clearance field is.
function distanceTo(data, polys) {
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const g = createCanvas(cols, rows).getContext('2d');
  g.scale(1 / CELL, 1 / CELL);
  for (const poly of polys) fill(g, [poly], data.proj.toPx, { color: '#000', ...data.proj.seam });
  const px = g.getImageData(0, 0, cols, rows).data;
  const d = chamfer(cols, rows, (i) => px[i * 4 + 3] > 40);
  return (x, y) => d[Math.min(rows - 1, Math.max(0, Math.floor(y / CELL))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(x / CELL)))];
}

// The island marks as circles, each MARK_CLEAR px wider than drawn and at least `min` px in radius.
const MARK_CLEAR = 4;
function traceMarks(g, data, min) {
  g.beginPath();
  for (const i of data.isles ?? []) {
    const m = markOf(data.proj, i);
    if (m) { const r = Math.max(min, m.r + MARK_CLEAR); g.moveTo(m.x + r, m.y); g.arc(m.x, m.y, r, 0, 2 * Math.PI); }
  }
}

// Land rasterised at CELL px, the island marks with it; chamfer distance (1, sqrt2) from every sea cell to land, in px.
function clearanceField(data) {
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const c = createCanvas(cols, rows);
  const g = c.getContext('2d');
  g.scale(1 / CELL, 1 / CELL);
  g.fillStyle = '#000';
  traceLand(g, data);
  g.fill('evenodd');
  beyondRim(g, data.proj); g.fill('evenodd');
  g.strokeStyle = '#000';
  g.lineWidth = CELL; // keeps islands smaller than a cell
  for (const line of data.coast) { g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
  traceMarks(g, data, CELL * 0.6); g.fill(); // an island mark is land too, kept like an island smaller than a cell
  const px = g.getImageData(0, 0, cols, rows).data;

  const d = chamfer(cols, rows, (i) => px[i * 4 + 3] > 40);
  // px from each land cell to the sea; past an azimuthal rim, which counts as land above so nothing
  // stands at sea there, is no ground to stand on either, so it counts as sea here
  const rim = data.proj.rim, beyond = (i) => rim && Math.hypot(((i % cols) + 0.5) * CELL - W / 2, (Math.floor(i / cols) + 0.5) * CELL - H / 2) > rim;
  const inland = chamfer(cols, rows, (i) => px[i * 4 + 3] <= 40 || beyond(i));

  const cellAt = (x, y) => Math.min(cols - 1, Math.max(0, Math.floor(y / CELL))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(x / CELL)));
  const at = (x, y) => d[cellAt(x, y)];
  const depth = (x, y) => inland[cellAt(x, y)];
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
  beyondRim(fg, data.proj); fg.fill('evenodd');
  traceMarks(fg, data, 0); fg.fill();
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
  return { at, depth, cells, grad, isLand, footprintBlocked };
}

// ---------------------------------------------------------------- placement

// How names are lettered, the same when placed and when drawn so both lay them out alike: a
// coast is lettered along its stretch inside the canvas.
const letterOptions = (data) => ({
  fonts: STYLE.fonts, ...data.proj.seam,
  visible: (lon, lat) => { if (!shows(data.proj, lon, lat)) return false; const x = data.proj.x(lon, lat), y = data.proj.y(lat, lon); return x >= 0 && x <= W && y >= 0 && y <= H; },
});

// World-view lettering, hand-set: [Latin, English, lon, lat]. Zoom levels are whole: continents are
// spaced capitals below zoom 5.5, regions italic below zoom 7.
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
const CONTINENT_ZOOM_END = 5.5, REGION_ZOOM_END = 7; // continents: zoom < CONTINENT_ZOOM_END, regions overlap them to there; regions: zoom < REGION_ZOOM_END (they meet a continent's box and make way)

// The continent and region names to letter, each with the box it reserves: measured with the font and
// spacing they are drawn in, so later names and towns make way. A name off the canvas or meeting an
// earlier box is dropped. `continents` is 'latin', 'english' or false; `regions` 'latin', 'english' or 'off'.
function placeWorldNames(data, ctx, boxes, { continents, regions, continentsEnd = CONTINENT_ZOOM_END, regionsEnd = REGION_ZOOM_END }) {
  const z = data.proj.zoom, out = [];
  const lang = regions === 'latin' ? 0 : 1;
  const put = (text, lon, lat, size, spacing, italic) => {
    if (!shows(data.proj, lon, lat)) return;
    const [x, y] = data.proj.project(lon, lat);
    ctx.font = `${italic ? 'italic ' : ''}${size}px "${STYLE.font}"`;
    ctx.letterSpacing = `${spacing}px`;
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = '0px'; // left set, every later name would measure too wide
    // a name whose anchor is in frame but whose letters run past the edge slides in; one whose anchor is out stays out
    const hw = w / 2, hh = size * 0.5, m = 4;
    if (x < m || x > W - m || y < m || y > H - m || 2 * hw > W - 2 * m) return;
    const box = obb(Math.min(W - m - hw, Math.max(m + hw, x)), Math.min(H - m - hh, Math.max(m + hh, y)), 0, hw, hh);
    if (boxes.some((b) => obbOverlap(b, box))) return;
    boxes.push(box);
    out.push({ text, x: box.cx, y: box.cy, size, spacing, italic, r: Math.max(box.hw, box.hh), box });
  };
  if (continents && z < continentsEnd) {
    for (const c of CONTINENTS) { const text = c[continents === 'latin' ? 0 : 1], size = text.length > 12 ? 22 : 30; put(text, c[2], c[3], size, size * 0.6, false); }
  }
  if (regions !== 'off' && z < regionsEnd) {
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
function viewTitle(data, towns, lang, pois = []) {
  const z = data.proj.zoom, half = Math.hypot(W, H) / 2;
  const fit = (s) => Math.exp(-(((z - s) / 1.6) ** 2));
  const central = ([x, y]) => (x < 0 || y < 0 || x > W || y > H ? 0 : 1 - Math.hypot(x - W / 2, y - H / 2) / half);
  const at = (lon, lat) => (shows(data.proj, lon, lat) ? central(data.proj.project(lon, lat)) : 0);
  const scored = [
    ...CONTINENTS.map((c) => ({ text: c[lang], score: at(c[2], c[3]) * fit(2) })),
    ...REGIONS.map((r) => ({ text: r[lang], score: at(r[2], r[3]) * fit(4.6) })),
    ...towns.map((t) => ({ text: t.name, score: central([t.x, t.y]) * fit(7 + t.rank) })),
    ...pois.map((t) => ({ text: t.name, score: 1.5 * central([t.x, t.y]) * fit(7) })), // a curated place outweighs a sea round it
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
// FNV-1a leaves its low bits poor (bit 0 is just the parity of the letters), so towns pick by a
// murmur3-finalised hash: every bit of the name reaches every bit of the pick.
const townPick = (text) => {
  let h = seedOf(text);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
};
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
const kmPxAt = (proj, lon, lat) => {
  const d = 1e-4, [ax, ay] = proj.project(lon - d, lat), [bx, by] = proj.project(lon + d, lat);
  return (Math.hypot(bx - ax, by - ay) / (2 * d * RAD)) * 1000 / (EARTH_R * Math.cos(lat * RAD));
};
function footprint(p, proj) {
  if (!p.urban) {
    if (!(p.area > 0)) return { extent: 0 };
    const d = 1e-4, ns = (proj.project(p.lon, p.lat - d)[1] - proj.project(p.lon, p.lat + d)[1]) / (2 * d * RAD) * 1000 / EARTH_R;
    return { extent: Math.sqrt(p.area * kmPxAt(proj, p.lon, p.lat) * Math.abs(ns)) };
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
  const kmPx = kmPxAt(proj, p.lon, p.lat);
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

// The Catalan sprites, stood on the hills relief.mjs found: each at most a few of the hump's heights
// wide, so smaller than a mountain, starting one further along the set each time so a cluster mixes
// them; only where the box clears `blocked` (names, towns, roses, the cartouche, the scale bar,
// built-up land) and the sprites already stood, and the land round it holds (half its width and a
// margin from the sea and the frame's edge). Under density 1 only TUNE.hillShare of them stand, the
// first in the humps' seeded order, so the clusters thin out whole; none at density 0.
const HILL_MARGIN = 16, HILL_SIZE = 4.5;
function placeHillSprites(humps, sprites, blocked, field) {
  if (!sprites.length || TUNE.hillShare <= 0) return [];
  const out = [];
  humps.forEach((hump, n) => {
    const cap = hump.h * HILL_SIZE;
    for (let k = 0; k < sprites.length; k++) {
      const sprite = sprites[(n + k) % sprites.length], w = Math.min(sprite.sizePx, cap), h = (w * sprite.img.height) / sprite.img.width, x = hump.x, y = hump.y - h / 2;
      const box = { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
      if (x < w / 2 + HILL_MARGIN || y < h / 2 + HILL_MARGIN || x > W - w / 2 - HILL_MARGIN || y > H - h / 2 - HILL_MARGIN || field.depth(x, y) < w / 2 + HILL_MARGIN || [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].some(([dx, dy]) => !field.isLand(x + dx * w, y + dy * h)) || blocked(box.x0, box.y0, box.x1, box.y1) || out.some((o) => meets(box, o.box))) continue;
      out.push({ sprite, x, y, size: w, box });
      break;
    }
  });
  return out.slice(0, Math.round(out.length * TUNE.hillShare)).map(({ box, ...m }) => m);
}

// A name coast-wright placed, as an oriented box from its corners.
const placedBox = ({ box: [c0, c1, c2] }) => obb((c0[0] + c2[0]) / 2, (c0[1] + c2[1]) / 2, Math.atan2(c1[1] - c0[1], c1[0] - c0[0]),
  Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) / 2, Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) / 2);

// The lesser places (buildings.mjs), after every other name: each a church or a house LESSER_PX tall
// whatever the zoom, standing on its land (standOf, on the clearance field), its name small above it;
// kept only where the building and its name both clear the towns, names and ornaments placed before.
// The points of interest (pois.mjs) are placed first of all the names (`poi`), so no sea or country takes their ground.
function placeLesser(data, field, boxes, ctx, towns, names, poi) {
  const out = [], opts = letterOptions(data), k = poi ? 1.7 : 1, s = (LESSER_PX * k) / TOWER_H; // a point of interest stands bigger
  for (const p of data.lesser.filter((l) => !!l.poi === poi).sort((a, b) => a.rank - b.rank || b.pop - a.pop)) {
    const [px, py] = p.xy;
    if (px < 8 || py < 8 || px > W - 8 || py > H - 8 || towns.some((t) => Math.hypot(t.x - px, t.y - py) < TUNE.townGap / 2)) continue;
    const shape = TOWER_BY_ID.get(p.building ?? lesserBuilding(p.rank, seedOf(p.name))), top = (shape.top ?? TOWER_H) * s, hw = shape.w * s;
    const [x, y] = standOf(p, top, hw, field);
    const icon = obb(x, y - top / 2, 0, hw, top / 2);
    if (!obbInside(icon) || boxes.some((b) => obbOverlap(b, icon))) continue;
    const n = { text: p.name, at: data.proj.invert(x, y - top - 5), size: Math.round(LESSER_LETTER * (poi ? 1.4 : 1)) };
    const [q] = place(ctx, [n], data.proj.toPx, opts);
    const box = q && placedBox(q);
    if (!box || !obbInside(box) || boxes.some((b) => obbOverlap(b, box))) continue;
    boxes.push(icon, box);
    names.push({ ...n, x: box.cx, y: box.cy, r: Math.max(box.hw, box.hh), box });
    out.push({ x, y, h: LESSER_PX * k, tower: shape.id, name: p.name, rank: p.rank, label: box, ...(p.poi && { poi: true }) });
  }
  return out;
}

// The roses of the atlas's sheets (docs/atlas/README.md, "An atlas of sheets"): each sheet's big rose on
// its circle's centre, then small roses on its nodes, the cardinal ones first, up to three, each where
// the sea round it is clear. Which sprite a sheet takes is picked by the sheet's name, so a sheet draws
// the same roses from any view. Returns what buildScene's window placement does: roseDraws, centre, nodes.
// a sheet with fewer than this many of its 17 sites in clear sea is land's, and its roses may stand on land
const SHEET_SEA_SITES = 4, SHEET_SMALL_ROSES = 3, SHEET_NODE_ORDER = [0, 4, 8, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15];
function placeSheetRoses(data, world, { bigSizePx, smallSize, roses }) {
  const roseDraws = [], at = (n) => { const [x, y] = data.proj.project(n.lon, n.lat); return { x, y }; };
  for (const sh of world.sheets) {
    const fp = sheetFrame(sh), seed = seedOf(sh.name);
    // `onLand`: a sheet with no clear sea to hold its big rose lets its roses stand on land, clear of the places
    const clear = (lon, lat, size, onLand = false) => {
      const [x, y] = fp.project(lon, lat), r = size * 0.46;
      if (onLand && world.placesLL.some((p) => Math.hypot(...fp.project(p.lon, p.lat).map((v, i) => v - [x, y][i])) < LAND_ROSE_TOWN)) return false;
      if ((!onLand && !world.seaAt(lon, lat)) || POIS.some((p) => Math.hypot(...fp.project(p.lon, p.lat).map((v, i) => v - [x, y][i])) < POI_ROOM)) return false;
      for (let i = 0; i < 8; i++) {
        const [a, b] = fp.invert(x + r * Math.cos((i * Math.PI) / 4), y + r * Math.sin((i * Math.PI) / 4));
        if (!(Math.abs(a) <= 540) || (!onLand && !world.seaAt(a, b))) return false;
      }
      return true;
    };
    const picked = world.seed == null ? roses.find((s) => s.sizePx === bigSizePx) : castOrder(roses, seed, () => 1)[0];
    const big = { ...picked, sizePx: bigSizePx };
    const rest = roses.filter((s) => s !== picked), small = rest.filter((s) => s.sizePx < bigSizePx);
    const smallRoses = small.length ? small : rest.length ? rest.map((s) => ({ ...s, sizePx: 110 })) : [{ ...big, sizePx: 110 }];
    const ring = world.seed == null ? smallRoses : castOrder(smallRoses, seed ^ 0x5bd1e995, () => 1);
    const c = sh.circle;
    const sites = [c, ...c.nodes];
    const onLand = sites.filter((q, i) => clear(q.lon, q.lat, i ? smallSize : big.sizePx)).length < SHEET_SEA_SITES;
    // what is kept is decided in the frame; the page's projection only says where it falls and whether it is seen
    const put = (sprite, n) => { if (shows(data.proj, n.lon, n.lat)) { const [fx, fy] = fp.project(n.lon, n.lat); roseDraws.push({ sprite, ...at(n), fx, fy, size: sprite.sizePx, sheet: sh.name }); } };
    if (ownSet(world, sh)) {
      for (const f of ownFigures(sh, 'rose')) put(figureSprite(sh, roses, ring, f), f);
      continue;
    }
    // a curated sheet's network is not drawn where a smaller curated sheet lies
    const clear2 = (lon, lat, size, land) => !inShadow(sh, lon, lat) && clear(lon, lat, size, land);
    if (clear2(c.lon, c.lat, big.sizePx, onLand)) put(big, c);
    let n = 0;
    for (const i of SHEET_NODE_ORDER) {
      const node = c.nodes[i], sprite = ring[n % ring.length];
      if (n < SHEET_SMALL_ROSES && clear2(node.lon, node.lat, sprite.sizePx, onLand)) { put(sprite, node); n++; }
    }
  }
  const pts = world.sheets.flatMap((sh) => [sh.circle, ...sh.circle.nodes]).map(at);
  return { roseDraws, centre: pts[0], nodes: pts.slice(1) };
}

// Where a sheet is placed: Mercator at its band's first zoom, centred on the sheet, whatever the page's
// projection, zoom or window. Placement is a function of the sheet and the land alone.
const sheetFrame = (sh) => makeProjection({ lon: sh.circle.lon, lat: sh.circle.lat, zoom: ATLAS_BANDS.find((b) => b.band === sh.band).from });
// A sheet's beasts are placed at the zoom that paces them (`from`), so the room they are given is the room
// they take where they are spaced; in the world band that is the zoom at which the sheet is one window wide.
const beastFrame = (sh) => makeProjection({ lon: sh.circle.lon, lat: sh.circle.lat, zoom: sh.from });

// The monsters and ships of the atlas's sheets (docs/atlas/README.md): each sheet seeds a jittered grid of
// sites over its own extent, ranks them by the open sea round them, and takes its beasts from the top,
// the cast picked by the sheet's name, so a sheet draws the same beasts from any view. Monsters stand in
// the clearest water; ships in coastal water, heading along the coast. The sea they are placed against is the 50m land, whatever the view has loaded.
const SHEET_BEAST_PROBE = 24; // px between the rings a site's clearance is read at
function placeSheetBeasts(data, world, sprites, roseDraws) {
  const monsters = [], ships = [];
  // each sheet is placed against its own roses alone: a neighbour in the view must not change what it holds
  for (const sh of world.sheets) {
    // its roses, placed in the sheet's frame, as discs in the beasts' frame; a size is screen px in either
    const rf = sheetFrame(sh), bf = beastFrame(sh);
    const avoid = roseDraws.filter((r) => r.sheet === sh.name).map((r) => { const [x, y] = bf.project(...rf.invert(r.fx, r.fy)); return { x, y, r: r.size / 2 + (r.size > 200 ? 0 : 10) }; });
    const mine = ownSet(world, sh) ? ownBeastsOf(sh, world, sprites) : placeBeastsOf(sh, world, sprites, avoid);
    // the page's projection only says where a beast falls and whether it is seen
    const at = (b) => { const [x, y] = data.proj.project(b.lon, b.lat); return { ...b, x, y }; };
    for (const m of mine.monsters) if (shows(data.proj, m.lon, m.lat)) monsters.push(at(m));
    for (const m of mine.ships) if (shows(data.proj, m.lon, m.lat)) ships.push(at(m));
  }
  return { monsters, ships };
}
// Historical accuracy (on unless `historical: false`): a curated sheet whose chart has been read draws that
// chart's own figures (docs/atlas/ornaments.md) in place of the seeded ones, each where the chart puts it,
// on the sheet's own ground: inside its extent, out of a smaller sheet's shadow. A sheet with an empty set
// draws none.
const ownSet = (world, sh) => world.historical !== false && !!sh.ornaments;
const ownFigures = (sh, kind) => sh.ornaments.filter((f) => f.kind === kind && f.lon >= sh.extent.west && f.lon <= sh.extent.east && f.lat >= sh.extent.south && f.lat <= sh.extent.north && !inShadow(sh, f.lon, f.lat));
// A figure's own sprite where the chosen sprites hold it; with none cropped (or not chosen), a stand-in of
// the same kind in the sheet's style, by the figure's place among its chart's figures of that kind, so a
// figure keeps its stand-in from any view; a style with none of that kind
// stands in the chosen sprites of the kind.
const figureSprite = (sh, chosen, fallback, f) => {
  const own = f.sprite && chosen.find((s) => s.id === f.sprite);
  if (own) return own;
  const styled = chosen.filter((s) => s.style === sh.style), standIns = styled.length ? styled : fallback;
  return standIns[sh.ornaments.filter((o) => o.kind === f.kind).indexOf(f) % standIns.length];
};
// One sheet's own beasts and ships, each in the sea where its chart draws it; one the fit puts on land is left out.
function ownBeastsOf(sh, world, sprites) {
  const take = (kind, set) => !set.length ? [] : ownFigures(sh, kind).map((f) => ({ f, sprite: figureSprite(sh, set, set, f) })).filter(({ f }) => world.seaAt(f.lon, f.lat))
    .map(({ f, sprite }) => ({ sprite, lon: f.lon, lat: f.lat, size: sprite.sizePx, flip: false, ...(kind === 'ship' && { tilt: 0 }), sheet: sh.name }));
  return { monsters: take('monster', sprites.monsters), ships: take('ship', sprites.ships) };
}
// One sheet's beasts, in the sheet's frame. `avoid` are its roses as discs {x, y, r} in frame px.
function placeBeastsOf(sh, world, sprites, avoid) {
  const fp = beastFrame(sh), seaAt = world.seaAt, monsters = [], ships = [];
  const ringClear = (x, y, r, rx = r, ry = r) => {
    for (let i = 0; i < 8; i++) {
      const [a, b] = fp.invert(x + rx * Math.cos((i * Math.PI) / 4), y + ry * Math.sin((i * Math.PI) / 4));
      if (!(Math.abs(a) <= 540) || !seaAt(a, b)) return false;
    }
    return true;
  };
  const clearance = (x, y, max) => {
    for (let r = SHEET_BEAST_PROBE; r <= max; r += SHEET_BEAST_PROBE) if (!ringClear(x, y, r)) return r - SHEET_BEAST_PROBE;
    return max;
  };
  const taken = [...avoid];
  const free = (x, y, r) => taken.every((o) => Math.hypot(o.x - x, o.y - y) >= o.r + r) && !POIS.some((p) => Math.hypot(...fp.project(p.lon, p.lat).map((v, i) => v - [x, y][i])) < POI_ROOM);
  const e = sh.extent, rnd = mulberry32(seedOf(sh.name));
  const [y0, y1] = [e.south, e.north].map((v) => Math.log(Math.tan(Math.PI / 4 + (v * RAD) / 2)) / RAD);
  // sites a monster-gap apart at the sheet's pacing zoom, one window of 360 / 2^z * 3.125 degrees across
  const win = 1125 / 2 ** sh.from, step = win * (MONSTER_GAP / W);
  const cols = Math.max(1, Math.round((e.east - e.west) / step)), rows = Math.max(1, Math.round((y1 - y0) / step));
  const sites = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const lon = e.west + ((c + 0.2 + 0.6 * rnd()) * (e.east - e.west)) / cols, my = y0 + ((r + 0.2 + 0.6 * rnd()) * (y1 - y0)) / rows;
    const lat = (2 * Math.atan(Math.exp(my * RAD)) - Math.PI / 2) / RAD;
    // a smaller curated sheet's ground is its own: no beast of this sheet stands there
    if (!seaAt(lon, lat) || inShadow(sh, lon, lat)) continue;
    const [x, y] = fp.project(lon, lat);
    sites.push({ lon, lat, x, y, c: clearance(x, y, 240) });
  }
  sites.sort((a, b) => b.c - a.c);
  const windows = Math.max(1, ((e.east - e.west) / win) * ((y1 - y0) / ((win * H) / W))), seed = world.seed == null ? null : seedOf(sh.name);
  const mine = [];
  for (const sprite of castOrder(sprites.monsters, seed)) {
    if (mine.length >= Math.round(TUNE.monsterMax * windows)) break;
    const aspect = sprite.img.height / sprite.img.width;
    for (const s of sites) {
      const size = Math.min(sprite.sizePx, s.c * 2 * 0.85);
      if (size < sprite.sizePx * 0.65) break;
      if (!free(s.x, s.y, size * 0.5) || !ringClear(s.x, s.y, size * 0.46, size * 0.46, size * aspect * 0.46)) continue;
      monsters.push({ sprite, lon: s.lon, lat: s.lat, size, flip: mine.length % 2 === 1, sheet: sh.name }); mine.push(s);
      taken.push({ x: s.x, y: s.y, r: size * 0.5 }); sites.splice(sites.indexOf(s), 1);
      break;
    }
  }
  let shipsHere = 0;
  for (const sprite of castOrder(sprites.ships, seed == null ? null : seed ^ 0x5eed, () => 1)) {
    if (shipsHere >= Math.round(TUNE.shipMax * windows)) break;
    const half = sprite.sizePx / 2, aspect = sprite.img.height / sprite.img.width;
    // coastal: clear sea for the hull, land within 72 px but none within 24
    const s = sites.find((q) => q.c >= half && free(q.x, q.y, half) && ringClear(q.x, q.y, half, half, half * aspect) && !ringClear(q.x, q.y, 72));
    if (!s) continue;
    // along the coast: perpendicular to the mean direction of the land at 72 px
    let lx = 0, ly = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8, [p, q] = fp.invert(s.x + 72 * Math.cos(a), s.y + 72 * Math.sin(a));
      if (!seaAt(p, q)) { lx += Math.cos(a); ly += Math.sin(a); }
    }
    let tx = -ly, ty = lx;
    const back = tx < 0;
    if (back) { tx = -tx; ty = -ty; }
    const flip = back !== (sprite.heading === 'left');
    ships.push({ sprite, lon: s.lon, lat: s.lat, size: sprite.sizePx, flip, tilt: Math.max(-0.26, Math.min(0.26, Math.atan2(ty, tx))), sheet: sh.name });
    taken.push({ x: s.x, y: s.y, r: half }); sites.splice(sites.indexOf(s), 1); shipsHere++;
  }
  return { monsters, ships };
}

// `sprites`: what chooseSprites chose, with pictures.
function buildScene(data, sprites, ctx, world = {}) {
  const field = clearanceField(data);
  // a rose set: the biggest is the centre rose, the rest the ring's; a set of one serves both, small at 110 px
  const roses = sprites.roses;
  // the view's seed picks the centre rose from the whole set, so a selection shows each of its roses
  // across the map; drawn at the biggest size in the set, the rest ring it. No seed (an older caller):
  // the biggest, as before
  const bigSizePx = Math.max(...roses.map((s) => s.sizePx));
  const picked = world.seed == null ? roses.find((s) => s.sizePx === bigSizePx) : castOrder(roses, world.seed, () => 1)[0];
  const bigRose = { ...picked, sizePx: bigSizePx };
  const rest = roses.filter((s) => s !== picked), small = rest.filter((s) => s.sizePx < bigSizePx);
  // taken in set order, one per node; mixed sets ring the smaller roses, a set of big ones rings them at 110 px
  const smallRoses = small.length ? small : rest.length ? rest.map((s) => ({ ...s, sizePx: 110 })) : [{ ...bigRose, sizePx: 110 }];
  const smallSize = Math.max(...smallRoses.map((s) => s.sizePx));
  // the ring takes its roses in a seeded order too, so a selection of many shows more of itself
  const ringRoses = world.seed == null ? smallRoses : castOrder(smallRoses, world.seed ^ 0x5bd1e995, () => 1);
  const cartoucheSprite = sprites.cartouche;
  const occupied = []; // discs {x, y, r} that later ornaments keep clear of
  // From the zoom the atlas has sheets for, the roses and the lines belong to the sheets the view overlaps,
  // not to the window: a sheet's big rose stands on its circle's centre, small roses on its nodes, wherever
  // the window is. A site is kept or dropped by the sea round it, never by what the window shows.
  const sheetRoses = world.sheets ? placeSheetRoses(data, world, { bigSizePx, smallSize, roses }) : null;
  const sheetBeasts = sheetRoses ? placeSheetBeasts(data, world, sprites, sheetRoses.roseDraws) : null;
  const edge = (x, y) => Math.min(x, y, W - x, H - y);
  // Roses stand in open water. Where the water is heavily constrained (no clear sea in the middle of the
  // frame to hold half a big rose) they may stand on open land, clear of the coast by the same measure.
  // `built`, while they are placed there, is the px to the nearest built-up area.
  let landOk = false, built = null;
  const open = (x, y) => (landOk ? Math.max(field.at(x, y), field.depth(x, y)) : field.at(x, y));
  const free = (x, y) => Math.min(open(x, y), edge(x, y), built ? built(x, y) : Infinity, ...occupied.map((o) => Math.hypot(x - o.x, y - o.y) - o.r));
  const roseBlocked = (x, y, size) => (landOk ? x - size * 0.46 < 0 || y - size * 0.46 < 0 || x + size * 0.46 > W || y + size * 0.46 > H : field.footprintBlocked(x, y, size, size));

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
    const rosy = [...(sheetRoses?.roseDraws ?? []), ...(sheetBeasts?.monsters ?? []), ...(sheetBeasts?.ships ?? [])].filter((r) => Math.abs(r.x - (x + cw / 2)) < cw / 2 + r.size * 0.42 && Math.abs(r.y - (y + ch / 2)) < ch / 2 + r.size * 0.42).length;
    return { x, y, w: cw, h: ch, coast, land, rosy };
  });
  const cartouche = corners.sort((a, b) => a.rosy - b.rosy || a.coast - b.coast || a.land - b.land)[0];
  occupied.push({ x: cartouche.x + cw / 2, y: cartouche.y + ch / 2, r: Math.hypot(cw, ch) / 2 });

  let centre, nodes, roseDraws;
  // Lattice centre: the clearest open-sea cell in the middle of the frame; the big rose sits on it.
  if (!sheetRoses) {
    const central = field.cells.filter((c) => c.x > W * 0.25 && c.x < W * 0.75 && c.y > H * 0.25 && c.y < H * 0.8);
    landOk = Math.max(...central.map((c) => free(c.x, c.y))) < bigRose.sizePx * LAND_ROSE;
  }
  // the built-up areas whose long side on screen is at least half the URBAN_PX that washes them: roses on
  // land and the relief keep clear of them
  const urban = landOk || reliefWanted() ? indexOf(data).urban.filter((u) => Math.max(u.box.x1 - u.box.x0, u.box.y1 - u.box.y0) * 2 >= URBAN_PX) : [];
  // on land the towns are still to be placed, so the roses keep clear of their places for now, and of
  // the built-up areas, whose city plans and washes they would cover
  const places = new Set();
  if (landOk) for (const { xy: [x, y] } of data.places) if (x > -LAND_ROSE_TOWN && x < W + LAND_ROSE_TOWN && y > -LAND_ROSE_TOWN && y < H + LAND_ROSE_TOWN) { const o = { x, y, r: LAND_ROSE_TOWN }; places.add(o); occupied.push(o); }
  // a point of interest is lettered whatever the view, so the roses and the beasts keep clear of it, on sea too
  for (const { xy: [x, y] } of data.lesser.filter((l) => l.poi)) occupied.push({ x, y, r: POI_ROOM });
  if (landOk && urban.length) built = distanceTo(data, urban.map((u) => u.poly));
  if (sheetRoses) {
    ({ centre, nodes, roseDraws } = sheetRoses);
    for (const r of roseDraws) occupied.push({ x: r.x, y: r.y, r: r.size / 2 + (r.size > 200 ? 0 : 10) });
  } else {
    const central = field.cells.filter((c) => c.x > W * 0.25 && c.x < W * 0.75 && c.y > H * 0.25 && c.y < H * 0.8);
    centre = central.reduce((a, b) => (free(b.x, b.y) > free(a.x, a.y) ? b : a));
    const bigSize = Math.min(bigRose.sizePx, 2 * 0.95 * free(centre.x, centre.y));
    roseDraws = [{ sprite: bigRose, x: centre.x, y: centre.y, size: bigSize }];
    occupied.push({ x: centre.x, y: centre.y, r: bigSize / 2 });

    // Circle radius: the one that puts the most nodes in water clear enough for a small rose.
    const ring = (R) => Array.from({ length: RHUMB_NODES }, (_, i) => {
      const a = (i * 2 * Math.PI) / RHUMB_NODES;
      return { x: centre.x + R * Math.cos(a), y: centre.y + R * Math.sin(a) };
    });
    const roseRoom = smallSize / 2 + 6;
    nodes = []; let bestCount = -1;
    for (let R = Math.round(H * 0.36); R <= H * 0.62; R += 8) {
      const n = ring(R), count = n.filter((p) => free(p.x, p.y) >= roseRoom).length;
      if (count >= bestCount) { bestCount = count; nodes = n; }
    }

    // Small roses: the clearest lattice nodes that hold the sprite, each rose of the pack in turn.
    const nodeRank = nodes.map((n) => ({ ...n, c: free(n.x, n.y) })).filter((n) => n.c >= roseRoom).sort((a, b) => b.c - a.c);
    for (const n of nodeRank) {
      if (roseDraws.length >= 4) break;
      const sprite = ringRoses[(roseDraws.length - 1) % ringRoses.length];
      if (free(n.x, n.y) < roseRoom || roseBlocked(n.x, n.y, sprite.sizePx)) continue;
      roseDraws.push({ sprite, x: n.x, y: n.y, size: sprite.sizePx });
      occupied.push({ x: n.x, y: n.y, r: sprite.sizePx / 2 + 10 });
    }

  }

  if (places.size) occupied.splice(0, occupied.length, ...occupied.filter((o) => !places.has(o)));
  built = null;

  // Towns, lower scalerank first, >= TUNE.townGap apart. The selected town sprites fall into families
  // by pack and style, and the tower is one when chosen; each town keeps one family, picked by its
  // name, save that the tower, plain at its first size, stands only for the smallest towns (SMALL_TOWN).
  // A sprite whose manifest names towns (`only`: Venice's halo of rays) is kept out of its family's
  // pool and drawn for those towns alone.
  const boxes = [obb(cartouche.x + cw / 2, cartouche.y + ch / 2, 0, cw / 2, ch / 2)];
  for (const r of roseDraws) boxes.push(obb(r.x, r.y, 0, r.size * 0.42, r.size * 0.42));
  // the sheets' beasts were fixed before the lettering, so names and towns give way to them
  for (const m of sheetBeasts?.monsters ?? []) boxes.push(obb(m.x, m.y, 0, m.size * 0.45, m.size * (m.sprite.img.height / m.sprite.img.width) * 0.45));
  for (const sh of sheetBeasts?.ships ?? []) boxes.push(obb(sh.x, sh.y, 0, sh.size / 2, sh.size / 2));
  const worldNames = placeWorldNames(data, ctx, boxes, { continents: world.continents ?? false, regions: world.regions ?? 'off', continentsEnd: world.continentsEnd, regionsEnd: world.regionsEnd });
  const special = new Map((sprites.towns ?? []).flatMap((s) => (s.only ?? []).map((name) => [name, s])));
  const families = [...(sprites.towns ?? []).filter((s) => !s.only).reduce((m, s) => m.set(`${s.pack}/${s.style}`, [...(m.get(`${s.pack}/${s.style}`) ?? []), s]), new Map()).values()];
  if (sprites.tower ?? !families.length) families.push(null); // null: the towers drawn in code
  const towerIds = sprites.towers?.length ? sprites.towers : ['tower'];
  const towns = [];
  const sorted = families.length || special.size ? [...data.places].sort((a, b) => a.rank - b.rank || b.pop - a.pop) : [];
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
    if (!families.length && !special.has(p.name)) continue; // only the named towns' own drawings chosen
    const fit = townGrandeur(p) < SMALL_TOWN || families.every((f) => !f) ? families : families.filter(Boolean);
    // the town's own drawing, whatever the view: its family and variant follow from its name, so a
    // zoom or a pan never redraws it as another (townVariant)
    const pick = townPick(p.name), family = fit[pick % fit.length], size = townScale(p, world.townSize);
    const sprite = special.get(p.name) ?? (family && townVariant(family, p, pick >>> 8)), tower = !sprite && TOWER_BY_ID.get(towerIds[(pick >>> 8) % towerIds.length]);
    const base = (sprite ? townHeight(sprite) : TOWER_H) * size, ground = footprint(p, data.proj);
    const th = Math.max(base, Math.min(ICON_MAX, ICON_GROW * ground.extent));
    const [x, y] = standOf(p, th, sprite ? ((th / 2) * sprite.img.width) / sprite.img.height : (th * tower.w) / TOWER_H, field, ground.rings);
    const icon = sprite
      ? obb(x, y - th / 2, 0, ((th / 2) * sprite.img.width) / sprite.img.height, th / 2)
      : obb(x, y - th / 2, 0, (th * tower.w) / TOWER_H, th / 2); // the tower, its widest part
    if (boxes.some((b) => obbOverlap(b, icon))) continue;
    towns.push({ x, y, size, h: th, family, red: p.rank <= 2, name: p.name, rank: p.rank, labelY: y - th - 6, ...(sprite ? { sprite } : { tower: tower.id }) });
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
  const pois = placeLesser(data, field, boxes, ctx, towns, names, true);
  for (const n of lettering) {
    if (n.kind === 'coast' && names.some((m) => m.kind === 'coast' && m.text === n.text)) continue; // once a view
    const [p] = place(ctx, [n], data.proj.toPx, opts);
    if (!p) continue;
    const box = placedBox(p); // coast-wright's corners, as an oriented box
    // a city's name sits on its own plan; seas and coasts are lettered over any city's water
    if (!obbInside(box) || boxes.some((b) => b !== n.own && !(n.kind && cityBoxes.has(b)) && obbOverlap(b, box))) continue;
    boxes.push(box);
    names.push({ ...n, x: box.cx, y: box.cy, r: Math.max(box.hw, box.hh), box });
  }
  const lesser = [...pois, ...(families.length ? placeLesser(data, field, boxes, ctx, towns, names, false) : [])];
  for (const b of boxes.slice(1 + roseDraws.length + (sheetBeasts ? sheetBeasts.monsters.length + sheetBeasts.ships.length : 0)).filter((b) => !cityBoxes.has(b))) occupied.push({ x: b.cx, y: b.cy, r: Math.max(b.hw, b.hh) * 0.6 });
  // hills and mountains (relief.mjs), seeded once: each range takes one of the mountain styles selected
  // and the Catalan sprites stand on the hills; all clear of what is placed so far and of the built-up
  // areas washed on the land
  const bar = world.scaleBar ? SCALE_BAR_BOX : null;
  const blocked = (x0, y0, x1, y1) => {
    const b = obb((x0 + x1) / 2, (y0 + y1) / 2, 0, (x1 - x0) / 2, (y1 - y0) / 2);
    return boxes.some((o) => obbOverlap(o, b)) || (bar && obbOverlap(bar, b)) || urban.some((u) => meets({ x0, y0, x1, y1 }, u.box));
  };
  const relief = reliefWanted() ? clearOf(reliefFor(data.proj, data.land), blocked) : null;
  const mountains = relief ? placeHillSprites(relief.humps, sprites.mountains ?? [], blocked, field) : [];

  // Monsters: farthest-first on the open-water field, >= MONSTER_GAP apart, in the view's cast order
  // (heavier sprites tend to come first).
  const monsterSprites = castOrder(sprites.monsters, world.seed);
  const monsters = sheetBeasts ? sheetBeasts.monsters : [];
  for (const sprite of sheetBeasts ? [] : monsterSprites) {
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
  const ships = sheetBeasts ? sheetBeasts.ships : [];
  for (const sprite of sheetBeasts ? [] : shipSprites) {
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
  const title = world.pinTitle?.toUpperCase() || (world.autoTitle && viewTitle(data, towns.filter((t) => names.some((n) => n.text === t.name)), world.regions === 'english' ? 1 : 0, lesser.filter((l) => l.poi)).toUpperCase()) || world.title || 'PORTOLANI';
  return { field, centre, nodes, sheets: world.sheets, roseDraws, towns, lesser, names, worldNames, monsters, ships, mountains, relief, cartouche: { ...cartouche, sprite: cartoucheSprite, title } };
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
  // a sheet's lines reach its extent plus half a sheet; a window's, past the scene's far corner
  const origins = scene.sheets
    ? scene.sheets.flatMap((sh) => [sh.circle, ...sh.circle.nodes].filter((n) => !inShadow(sh, n.lon, n.lat)).map((n) => ({ lon: n.lon, lat: n.lat, reach: sh.reach, shadow: sh.shadow })))
    : [scene.centre, ...scene.nodes].map((n) => { const [lon, lat] = data.proj.invert(n.x, n.y); return { lon, lat, reach }; });
  // The Catalan Atlas rose's lines run at every zoom, beside the network of the sheets or the window
  // (docs/atlas/README.md, "Zoom bands"): the same lines through every view and every band.
  origins.push({ lon: ATLAS_ROSE.lon, lat: ATLAS_ROSE.lat, reach: 180 });
  // A curated sheet's lines stop where a smaller curated sheet lies, whose network holds that ground.
  for (const { lon, lat, reach, shadow } of origins) {
    for (let k = 0; k < RHUMB_RAYS; k++) {
      const kind = k % 4 === 0 ? 0 : k % 2 === 1 ? 1 : 2; // wind, quarter (red), half (green)
      const ray = rhumb([lon, lat], 90 + (k * 360) / RHUMB_RAYS, reach * Math.cos(lat * Math.PI / 180));
      for (const line of cutOut(ray, shadow)) rays.push({ kind, line, box: bbox(line.map(([a, b]) => data.proj.project(a, b))) });
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
// Path data onto a canvas path, for the commands TOWERS use.
function tracePath(g, d) {
  const tok = d.match(/[MLHVQZ]|-?[\d.]+/g);
  let i = 0, x = 0, y = 0, cmd = '';
  const num = () => +tok[i++];
  g.beginPath();
  while (i < tok.length) {
    if (/[MLHVQZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { x = num(); y = num(); g.moveTo(x, y); cmd = 'L'; }
    else if (cmd === 'L') { x = num(); y = num(); g.lineTo(x, y); }
    else if (cmd === 'H') { x = num(); g.lineTo(x, y); }
    else if (cmd === 'V') { y = num(); g.lineTo(x, y); }
    else if (cmd === 'Q') { const cx = num(), cy = num(); x = num(); y = num(); g.quadraticCurveTo(cx, cy, x, y); }
    else if (cmd === 'Z') g.closePath();
  }
}

function drawTower(g, t) {
  const s = t.h / TOWER_H, shape = TOWER_BY_ID.get(t.tower) ?? TOWERS[0];
  const fills = { p: hexA(STYLE.parchment, 0.9), r: STYLE.windRed, k: STYLE.ink, f: t.red ? STYLE.windRed : STYLE.ink };
  g.save();
  g.translate(t.x, t.y);
  g.scale(s, s);
  g.lineWidth = 1.1; g.lineJoin = 'round';
  g.strokeStyle = STYLE.ink;
  for (const [kind, d] of shape.layers) {
    tracePath(g, d);
    if (kind !== 's') { g.fillStyle = fills[kind]; g.fill(); }
    if (kind !== 'k' && kind !== 'f') g.stroke();
  }
  g.restore();
}

// A tower as an SVG glyph for a page's picker, the parchment and red as the default chart's.
function towerGlyph(id) {
  const shape = TOWER_BY_ID.get(id);
  if (!shape) return '';
  const fill = { p: '#e9d8b4', r: '#8c2f1e', k: 'currentColor', f: '#8c2f1e', s: 'none' };
  const paths = shape.layers.map(([kind, d]) => `<path d="${d}" fill="${fill[kind]}"${kind === 'k' || kind === 'f' ? '' : ' stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"'}/>`);
  const w = Math.max(...TOWERS.map((t) => t.w)) + 1;
  return `<svg viewBox="${-w} -17.5 ${2 * w} 19">${paths.join('')}</svg>`;
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
      if (!shows(data.proj, lon, lat)) { prev = null; left = 0; continue; } // behind the horizon
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
function paintLand(g, data, land, coast, relief) {
  const { toPx, seam } = data.proj;
  const mode = STYLE.landMode;
  if (tintPolys) {
    trace(g, tintPolys, toPx, { ...seam });
    g.save(); g.fillStyle = hexA(STYLE.red, 0.5); g.fill('evenodd');
    // a hair beyond the polygon, which is generalised and stops short of the shore
    g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = hexA(STYLE.red, 0.5); g.stroke(); g.restore();
  }
  if (mode === 'ochre') paintShoals(g, data, coast);
  fill(g, land, toPx, { color: STYLE.land, ...seam });
  g.save();
  traceLand(g, data, land);
  g.clip('evenodd');
  const wash = LAND_WASH[mode];
  for (const [wd, a] of wash ? [[STYLE.washWidth * 2, 0.3], [STYLE.washWidth * 1.3, 0.3], [STYLE.washWidth * 0.7, 0.35]] : []) {
    limn(g, coast, toPx, { color: hexA(wash, a), alpha: 1, width: wd, lineCap: 'round', oneStroke: true, ...seam });
  }
  if (mode === 'green') limn(g, coast, toPx, { color: STYLE.greenEdge, alpha: 0.8, width: 3.5, lineCap: 'round', oneStroke: true, ...seam });
  g.restore();
  if (STYLE.islands) {
    const pigments = [STYLE.red, STYLE.green, STYLE.gold];
    for (const [hue, pigment] of pigments.entries()) {
      const isles = land.filter((p) => p.isl.km2 < ISLAND_KM2 && p.isl.hue === hue);
      if (isles.length) fill(g, isles, toPx, { color: pigment, alpha: 0.92, ...seam });
    }
  }
  paintMarks(g, data);
  paintWater(g, data);
  paintRelief(g, data, relief);
  const palette = { ink: STYLE.ink, parchment: STYLE.parchment };
  if (data.trees) TREES[STYLE.trees]?.(g, { proj: data.proj, palette }, data.trees); // a drag's frame has none
  if (data.palms?.length) (TREES[STYLE.trees] ?? TREES.marina)(g, { proj: data.proj, palette }, data.palms); // the points of interest's own, whatever the trees
}

// The islands the drawn land lacks, the way period charts drew those too small to draw: an ink dot
// for an island, an ink ring round parchment for an atoll.
function paintMarks(g, data) {
  const marks = (data.isles ?? []).map((i) => markOf(data.proj, i)).filter(Boolean);
  if (!marks.length) return;
  g.save();
  g.fillStyle = STYLE.ink; g.beginPath();
  for (const m of marks) if (!m.atoll) { g.moveTo(m.x + m.r, m.y); g.arc(m.x, m.y, m.r, 0, 2 * Math.PI); }
  g.fill();
  g.beginPath();
  for (const m of marks) if (m.atoll) { g.moveTo(m.x + m.r, m.y); g.arc(m.x, m.y, m.r, 0, 2 * Math.PI); }
  g.fillStyle = STYLE.parchment; g.fill();
  g.strokeStyle = STYLE.ink; g.lineWidth = 1.2; g.stroke();
  g.restore();
}

// Rivers, then lakes over them, each in its chosen style, on the land and under the coast's ink.
function paintWater(g, data) {
  const river = RIVERS[STYLE.rivers], lake = LAKES[STYLE.lakes];
  if (!(river || lake) || !water) return;
  const paint = { proj: data.proj, palette: { ink: STYLE.ink, pigments: [STYLE.red, STYLE.rose, STYLE.green], seedOf } };
  const kept = keptWater(data);
  if (river) river(g, paint, kept.rivers.filter((r) => !(lake && r.inLake)));
  if (lake) lake(g, paint, kept.lakes);
}
// The rivers and lakes a view draws: those worth showing at its zoom whose box meets it.
export function keptWater(data) {
  if (!water) return { rivers: [], lakes: [] };
  const f = frameOf(data.proj, WATER_PX / data.proj.k / RAD), zoom = data.proj.zoom;
  const kept = (list) => list.filter((w) => shown(w, zoom) && meetsLL(f, w.box));
  return { rivers: kept(water.rivers), lakes: kept(water.lakes) };
}
// Hills and mountains (relief.mjs) for a view's land, and drawn over the water in the chosen style.
// Mountains in the style chosen, hills where the Catalan sprites are selected. A drag draws neither:
// they return with the ornaments when it stops.
const reliefWanted = () => STYLE.relief.length > 0 || STYLE.mountainSprites;
const reliefFor = (proj, land) => reliefOf({ proj, land, createCanvas, w: W, h: H, styles: STYLE.relief, hills: STYLE.mountainSprites });
function paintRelief(g, data, relief) {
  if (relief) drawRelief(g, { proj: data.proj, palette: { ink: STYLE.ink, land: STYLE.land } }, relief);
}
const paintCoast = (g, data, coast) =>
  limn(g, coast, data.proj.toPx, { color: STYLE.ink, alpha: 1, width: STYLE.coastWidth, oneStroke: true, ...data.proj.seam });

// Parchment, land, water and coast for any view: what a drag draws each frame. The ornaments, the
// lattice, the relief and the trees wait for the stop, which places and draws the scene whole
// (drawScene); the relief, placed and hatched afresh, is too slow for a frame.
function drawGround(g, world, view, bg) {
  const proj = makeProjection(view);
  const f = frameOf(proj, 16 / proj.k / RAD); // 16 px, so strokes at the edge survive
  const data = { proj, isles: islesLacking(world).filter((i) => nearLL(f, i.lon, i.lat)) };
  const land = world.land.filter((l) => meetsLL(f, l.box)).map((l) => l.poly);
  const coast = world.runs.filter((c) => meetsLL(f, c.box)).map((c) => c.run);
  g.drawImage(bg, 0, 0);
  paintLand(g, data, land, coast, null);
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
  const border = STYLE.scaleBorder; // blank: the parchment alone; transparent: the map shows through; bordered: parchment and a double rule
  if (border !== 'transparent') g.drawImage(bg, sx, sy, Math.min(W - sx, pw / view.scale), Math.min(H - sy, ph / view.scale), px, py, pw, ph);
  if (border === 'bordered') {
    g.strokeStyle = hexA(STYLE.windRed, 0.7); g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
    g.strokeRect(px + 3.5, py + 3.5, pw - 7, ph - 7);
  }
  SCALE_STYLES[style](g, x0, y0, n, seg, sprite);
  g.fillStyle = STYLE.ink; g.textAlign = 'center'; g.textBaseline = 'bottom';
  for (let i = 0; i <= n; i += every) g.fillText(String(+(i * step).toFixed(2)), x0 + i * seg, top - 5);
  g.textAlign = 'left'; g.fillText('nautical miles', x0 + n * seg + 24, y0 + SCALE_BAR_H);
  g.restore();
}

// The cartouche, lettered in its cleared panel. `bgPart` repaints the parchment (x0, y0, x1, y1) under the panel.
function drawCartouche(g, c, bgPart) {
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
  paintLand(g, data, land, coast, scene.relief && { ...scene.relief, humps: [] });

  // 3. rhumb lattice: 16 nodes on a circle plus the centre, 32 rhumb lines each, in three inks
  const rays = latticeOf(scene, data);
  const inks = [STYLE.ink, STYLE.windRed, STYLE.windGreen]; // by kind: wind, quarter-wind, half-wind
  const show = scene.show ?? { kinds: new Set(KINDS), names: true, rhumb: true };
  for (const [kind, ink] of show.rhumb ? inks.entries() : []) {
    const lines = rays.filter((ray) => ray.kind === kind && meets(r, ray.box)).map((ray) => ray.line);
    limn(g, lines, data.proj.toPx, { color: ink, alpha: STYLE.rhumbAlpha, width: STYLE.rhumbWidth, oneStroke: true, ...data.proj.seam });
  }

  // 3.2 an azimuthal projection's rim: the horizon, or where the chart stops
  if (data.proj.rim) {
    g.save(); g.beginPath(); g.arc(W / 2, H / 2, data.proj.rim, 0, 2 * Math.PI);
    g.strokeStyle = STYLE.ink; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, data.proj.rim + 5, 0, 2 * Math.PI); g.lineWidth = 0.8; g.stroke(); g.restore();
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
      fill(g, [u.poly], data.proj.toPx, { color: STYLE.terracotta, alpha: a, ...data.proj.seam });
      g.save(); g.beginPath(); trace(g, [u.poly], data.proj.toPx, { ...data.proj.seam });
      g.globalAlpha = Math.min(1, a * 1.5); g.strokeStyle = STYLE.ink; g.lineWidth = 0.8 / view.scale; g.stroke(); g.restore();
    }
    // clear of the town icons, which stand over them
    const icons = [...scene.towns.filter((t) => !t.city), ...(scene.lesser ?? [])].map((t) => {
      const hw = (t.sprite ? (t.h * t.sprite.img.width) / t.sprite.img.height : t.h * 0.6) / 2 + 4;
      return { x0: t.x - hw, x1: t.x + hw, y0: t.y - t.h - 4, y1: t.y + 6 };
    }).concat((scene.lesser ?? []).map(({ label: b }) => ({ x0: b.cx - b.hw - 3, x1: b.cx + b.hw + 3, y0: b.cy - b.hh - 3, y1: b.cy + b.hh + 3 }))); // and a lesser place's name
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
  for (const t of scene.lesser ?? []) if (disc(r, t.x, t.y - t.h / 2, t.h * 0.75)) drawTower(g, t);

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
  letter(g, shown.filter((n) => !n.red), data.proj.toPx, { ...opts, color: STYLE.ink });
  letter(g, shown.filter((n) => n.red), data.proj.toPx, { ...opts, color: STYLE.windRed });

  // 8. monsters, 9. ships
  for (const m of show.kinds.has('monster') ? scene.monsters : []) if (spriteIn(m.sprite, m.x, m.y, m.size)) drawSprite(g, m.sprite, m.x, m.y, m.size, { flip: m.flip, anchor: [0.5, 0.5] });
  for (const s of show.kinds.has('ship') ? scene.ships : []) if (spriteIn(s.sprite, s.x, s.y, s.size)) drawSprite(g, s.sprite, s.x, s.y, s.size, { flip: s.flip, rot: s.flip ? -s.tilt : s.tilt, anchor: [0.5, 0.6] });

  // 10. cartouche, lettered in its cleared panel
  const c = scene.cartouche;
  if (!show.kinds.has('cartouche') || !meets(r, { x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h })) { g.restore(); drawScaleBar(g, data, bg, view, W, H, show.scale, scene.scaleSprite); return; }
  drawCartouche(g, c, bgPart);
  g.restore();
  drawScaleBar(g, data, bg, view, W, H, show.scale, scene.scaleSprite);
}

// ---------------------------------------------------------------- anchored to the earth

// A placed scene's ornaments as longitude and latitude, so a moving frame can draw them through the
// live projection. Placement is unchanged: once a view, at release. A city's plan and the continent
// and region names are left out of a moving frame; the release draws them.
function anchorScene(scene, data) {
  const ll = (o) => ({ o, at: data.proj.invert(o.x, o.y) });
  return {
    k: data.proj.k, show: scene.show, scaleSprite: scene.scaleSprite, cartouche: scene.cartouche,
    rays: latticeOf(scene, data),
    roses: scene.roseDraws.map(ll), mountains: (scene.mountains ?? []).map(ll),
    towns: [...scene.towns.filter((t) => !t.city), ...(scene.lesser ?? [])].map(ll),
    monsters: scene.monsters.map(ll), ships: scene.ships.map(ll),
    names: scene.names.filter((n) => !n.plate),
  };
}

// One moving frame of the anchored ornaments over the ground, through `view`'s projection; the
// cartouche and the scale bar stay on the window.
function drawAnchored(g, a, bg, view) {
  const proj = makeProjection(clampView(view)), grow = proj.k / a.k, f = STYLE.sizeFactor, show = a.show;
  const scaled = (kind) => grow ** f[kind];
  const at = ([lon, lat], pad) => {
    if (proj.visible && !proj.visible(lon, lat)) return null;
    const [x, y] = proj.project(lon, lat);
    return x > -pad && x < W + pad && y > -pad && y < H + pad ? [x, y] : null;
  };
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const inks = [STYLE.ink, STYLE.windRed, STYLE.windGreen];
  for (const [kind, ink] of show.rhumb ? inks.entries() : []) {
    limn(g, a.rays.filter((ray) => ray.kind === kind).map((ray) => ray.line), proj.toPx, { color: ink, alpha: STYLE.rhumbAlpha, width: STYLE.rhumbWidth, oneStroke: true, ...proj.seam });
  }
  if (proj.rim) {
    g.beginPath(); g.arc(W / 2, H / 2, proj.rim, 0, 2 * Math.PI);
    g.strokeStyle = STYLE.ink; g.lineWidth = 2; g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, proj.rim + 5, 0, 2 * Math.PI); g.lineWidth = 0.8; g.stroke();
  }
  if (show.kinds.has('rose')) for (const { o, at: ll } of a.roses) {
    const size = o.size * scaled('rose'), p = at(ll, size);
    if (p) drawSprite(g, o.sprite, p[0], p[1], size, { anchor: [0.5, 0.5] });
  }
  if (show.kinds.has('mountain')) for (const { o, at: ll } of a.mountains) {
    const size = o.size * scaled('mountain'), p = at(ll, size);
    if (p) drawSprite(g, o.sprite, p[0], p[1], size, { anchor: [0.5, 0.5] });
  }
  for (const { o: t, at: ll } of a.towns) {
    const h = t.h * scaled('town'), p = at(ll, h * 2);
    if (!p) continue;
    if (t.sprite) drawSprite(g, t.sprite, p[0], p[1], (h * t.sprite.img.width) / t.sprite.img.height, { anchor: [0.5, 1] });
    else drawTower(g, { ...t, x: p[0], y: p[1], h });
  }
  if (show.names) {
    const onMap = (n) => (Array.isArray(n.at[0]) ? n.at.some((p) => at(p, 200)) : at(n.at, 200)); // a coast name's `at` is a run of points, a sea name's one
    const shown = a.names.filter(onMap), opts = letterOptions({ proj });
    letter(g, shown.filter((n) => !n.red), proj.toPx, { ...opts, color: STYLE.ink });
    letter(g, shown.filter((n) => n.red), proj.toPx, { ...opts, color: STYLE.windRed });
  }
  if (show.kinds.has('monster')) for (const { o: m, at: ll } of a.monsters) {
    const size = m.size * scaled('monster'), p = at(ll, size);
    if (p) drawSprite(g, m.sprite, p[0], p[1], size, { flip: m.flip, anchor: [0.5, 0.5] });
  }
  if (show.kinds.has('ship')) for (const { o: s, at: ll } of a.ships) {
    const size = s.size * scaled('ship'), p = at(ll, size);
    if (p) drawSprite(g, s.sprite, p[0], p[1], size, { flip: s.flip, rot: s.flip ? -s.tilt : s.tilt, anchor: [0.5, 0.6] });
  }
  g.restore();
  if (show.kinds.has('cartouche')) drawCartouche(g, a.cartouche, (x0, y0, x1, y1) => g.drawImage(bg, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0));
  drawScaleBar(g, { proj }, bg, { scale: 1, x: 0, y: 0 }, W, H, show.scale, a.scaleSprite);
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
// `land`: a LANDS entry, the land treatment ('islands' by default); `seaTint` (boolean) tints the Red Sea, the Persian Gulf and the Black and Caspian Seas red.
// `rivers` and `lakes`: a RIVER_STYLES and a LAKE_STYLES entry (water.mjs), each 'off' by default; `trees` a TREE_STYLES entry (trees.mjs), 'off' too.
// `relief`: a RELIEF_STYLES entry or a list of them (relief.mjs), none by default; with several each range takes one, by its seed.
// The mountain sprites in the selection join them: one more style, stood along the ranges that take it.
// `autoTitle` (boolean, on by default) letters the cartouche with the name the view is about (viewTitle), in capitals;
// `title` is its lettering when that is off, or when the view has no name in it. `pinTitle` is a name the caller says
// the view is about (a place flown to), lettered in capitals whatever the scoring finds.
// `kinds` defaults to DEFAULT_KINDS, every kind. A kind left out is still
// placed when the lattice needs it (a rose, the cartouche's corner), only not drawn.
// A sheet's hidden circle reaches 0.4 of its height, so a node never lands on the edge a neighbour shares.
const SHEET_RADIUS = 0.4;
// Degrees of rhumb line from a node: the sheet's extent plus half a sheet, over its diagonal on the page.
const sheetReach = (e) => Math.min(180, 1.5 * Math.hypot(e.east - e.west, mercatorDeg(e.north) - mercatorDeg(e.south)));
const mercatorDeg = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;
// Whether a point of the earth is sea, by the world's land and not the window's.
function seaAtOf(world) {
  return (lon, lat) => !world.land.some(({ poly, box }) => lat > box.y0 && lat < box.y1 && SHIFTS.some((s) => lon + s > box.x0 && lon + s < box.x1 && insideRing(poly[0], lon + s, lat)));
}
export async function createScene(environment, opts = {}) {
  env = environment;
  const { ink = '#3b2a1a', continentsZoom, regionsZoom, scaleBorder = 'bordered', parchment: tone = '#e9d8b4', density = 1, rendering = 'vivid', rose = 'aguiar', monster = 'carta-marina', town = 'tower', townSize, names = true, rhumb: rhumbOn = true, scale = 'genoese', continents = false, regions = 'off', title = 'PORTOLANI', autoTitle = true, pinTitle, land: landMode = 'islands', islands, seaTint = false, rivers = 'off', lakes = 'off', relief = [], trees = 'off', historical = true } = opts;
  const legacy = ['rendering', 'rose', 'monster', 'town'].some((k) => opts[k] !== undefined);
  const townBy = townSize ?? (legacy ? 'rank' : 'area');
  const show = { kinds: new Set(opts.kinds ?? DEFAULT_KINDS), names, rhumb: rhumbOn, scale };
  const view = clampView(opts.view ?? DEFAULT_VIEW);
  STYLE.ink = ink;
  STYLE.parchment = tone;
  STYLE.landMode = LANDS.includes(landMode) ? landMode : 'islands';
  STYLE.islands = islands ?? STYLE.landMode === 'islands'; // the islands are their own choice; left out, 'islands' as the land treatment still means them
  STYLE.scaleBorder = SCALE_BORDERS.includes(scaleBorder) ? scaleBorder : 'bordered';
  STYLE.rivers = RIVER_STYLES.includes(rivers) ? rivers : 'off';
  STYLE.lakes = LAKE_STYLES.includes(lakes) ? lakes : 'off';
  STYLE.relief = [relief].flat().filter((r) => r !== 'off' && RELIEF_STYLES.includes(r));
  STYLE.trees = TREE_STYLES.includes(trees) ? trees : 'off';
  TUNE.monsterMax = Math.round(4 * density);
  TUNE.shipMax = Math.round(2 * density);
  TUNE.townGap = 48 / density;
  TUNE.hillShare = Math.min(1, density);

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
      monsters, ships, towns, tower: chosen.tower, towers: chosen.towers, mountains, scaleSprite: scaleSprite || null,
    };
  });
  const [, coarse, chosen] = await Promise.all([env.loadFont(STYLE.font), loadWorld(), sprites]);
  const { scaleSprite, ...placed } = chosen;
  STYLE.mountainSprites = placed.mountains.length > 0;
  tintPolys = seaTint ? geojsonPolygons(await env.readJSON('geo/seas-50m.json')) : null;
  if (STYLE.rivers !== 'off' || STYLE.lakes !== 'off') water = (view.zoom > WATER_ZOOM && await loadWater10m(view)) || await loadWater();
  if (STYLE.lakes !== 'off') water = withLakes(water, await loadLakes(view));
  const world = view.zoom > DETAIL_ZOOM ? await loadDetail(coarse, view) : coarse;
  const tLoad = performance.now();

  const data = viewData(world, view);
  // the atlas's sheets at every zoom: the curated sheets alone in the world band, then curated and grid sheets.
  // `from` paces a sheet's beasts: the first zoom of its band, or in the world band, where the earth is one page,
  // the zoom at which the sheet is one window wide.
  const worldBand = view.zoom < ATLAS_BANDS[0].from;
  const sheets = sheetsFor(view, { radius: SHEET_RADIUS, curated: true }).map((sh) => ({ ...sh, reach: sheetReach(sh.extent),
    from: worldBand ? Math.log2(1125 / (sh.extent.east - sh.extent.west)) : ATLAS_BANDS.find((b) => b.band === sh.band).from }));
  const scene = { ...buildScene(data, placed, createCanvas(10, 10).getContext('2d'), { sheets, historical, seaAt: sheets && seaAtOf(coarse), placesLL: world.places, continents: continents && (regions === 'english' ? 'english' : 'latin'), regions, title, autoTitle, pinTitle,
    continentsEnd: zoomEnd(continentsZoom, CONTINENT_ZOOM_END), regionsEnd: zoomEnd(regionsZoom, REGION_ZOOM_END),
    scaleBar: scale in SCALE_STYLES && view.zoom >= SCALE_MIN_ZOOM, townSize: townBy, seed: legacy ? null : castSeed(view) }), show, scaleSprite };
  data.trees = TREES[STYLE.trees] ? plantTrees({ proj: data.proj, isLand: scene.field.isLand, scene, lakes: STYLE.lakes !== 'off' && water ? water.lakes : [], w: W, h: H }) : [];
  data.palms = plantPalms({ proj: data.proj, isLand: scene.field.isLand, scene, w: W, h: H,
    pois: scene.lesser.filter((l) => l.poi).map((l) => ({ x: l.x, y: l.y, palms: POIS.find((p) => p.name === l.name)?.palms ?? 0 })) });
  if (!parchments.has(tone)) parchments.set(tone, parchment(1539));
  const bg = parchments.get(tone);
  return { scene, data, bg, proj: data.proj, world, coarse, view, timing: { load: tLoad - t0, place: performance.now() - tLoad } };
}
// A zoom slider's value as the zoom a name stops at: unset keeps `dflt`, 0 or less is off, the top is always, N draws at zoom N and out
const zoomEnd = (n, dflt) => (n == null ? dflt : n <= 0 ? -Infinity : n >= ZOOM.max ? Infinity : n + 0.5);
const parchments = new Map(); // by tone; the same seed paints the same sheet

export const RENDERINGS = ['vivid', 'scanned', 'plain'];
export const REGION_LANGS = ['off', 'latin', 'english'];
export const KINDS = ['rose', 'ship', 'monster', 'cartouche', 'mountain'];
export const DEFAULT_KINDS = KINDS;
export const PROJECTION_NAMES = Object.keys(PROJECTIONS);
export const viewProjection = (view) => makeProjection(clampView(view));
export const TOWN_SIZES = ['area', 'population', 'rank'];
export { RIVER_STYLES, LAKE_STYLES, TREE_STYLES, RELIEF_STYLES };
export const MAX_ZOOM = ZOOM.max;
export { anchorScene, drawAnchored, towerGlyph, SCALE_NAMES, readManifests, listStyles, listSprites, defaultSprites, selectSprites, chooseSprites, drawScene, drawGround, covers, panView, zoomView, clampView, viewOfFrame, DEFAULT_VIEW, ZOOM, DETAIL_ZOOM, W, H, DETAIL };
