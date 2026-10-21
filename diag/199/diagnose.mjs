// Diagnosis dump for #199, run from a checkout: node diag/199/diagnose.mjs [view numbers or zoom/lat/lon ...]
// Diagnosis dump for portolani#199: per view, band, sheets, nodes, emitted roses, ray origins; PNG via drawScene.
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createScene, drawScene, W, H } from '../../scripts/scene.mjs';
import { viewBounds, bandFor, inShadow, territory, ROSE, BANDS } from '../../scripts/atlas.mjs';
import { seaNames, coastNames, joinNames } from '../../scripts/names.mjs';
import { isleIndex } from '../../scripts/isles.mjs';
import * as coastlines from 'coastlines';
import { geojsonPolygons } from 'coast-wright';
const ROOT = fileURLToPath(new URL('../..', import.meta.url)), DL = join(ROOT, 'downloads');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
let made, isles;
const islesIndex = () => isles ??= isleIndex(coastlines.shapefilePolygons(readFileSync(coastlines.localUrl(coastlines.find('gshhg-land-h')))), geojsonPolygons(read(join(GEO, 'ne-land-50m.geojson'))));
const names = () => made ??= joinNames(seaNames(read(join(DL, 'ne_50m_geography_marine_polys.geojson'))), coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names() : p === 'geo/urban-10m.json' ? Promise.reject(new Error('no urban')) : p === 'geo/isles.json' ? islesIndex() : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(DL, 'IMFeENrm28P.ttf'), family); GlobalFonts.registerFromPath(join(DL, 'IMFeENit28P.ttf'), family); },
};
const VIEWS = { 1: [3.17, -18.526, -111.901], 2: [4.33, 39.525, -26.502], 3: [4.33, 36.013, -0.489], 4: [6.14, 40.474, 7.400], 5: [1.00, 4.215, 10.000], 6: [2.00, 40.899, 173.403], 7: [6.00, -9.000, -140.000], 8: [5.67, -9.238, -139.742], 9: [4.40, 39.0, 16.0] };
for (const a of process.argv.slice(2)) if (a.includes('/')) VIEWS[a] = a.split('/').map(Number);
const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS);
const f1 = (n) => Number(n).toFixed(1);
const RAD = Math.PI / 180, mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / RAD;
const out = join(dirname(fileURLToPath(import.meta.url)), 'png'); mkdirSync(out, { recursive: true });
for (const k of which) {
  const [zoom, lat, lon] = VIEWS[k], view = { zoom, lat, lon };
  const b = viewBounds(view), band = bandFor(zoom), world = zoom < BANDS[0].from;
  const inView = (p) => p.lon >= b.west && p.lon <= b.east && p.lat >= b.south && p.lat <= b.north;
  console.log(`\n## view ${k}  #map=${zoom}/${lat}/${lon}`);
  console.log(`band: ${world ? 'WORLD (curated only, no grid)' : `${band.band} ${band.name} (${band.height} deg cells)`}; window ${f1(b.west)}..${f1(b.east)} lon x ${f1(b.south)}..${f1(b.north)} lat = ${f1(b.east - b.west)} x ${f1(mercY(b.north) - mercY(b.south))} page-deg`);
  const { scene, data, bg } = await createScene(env, { view });
  const sheets = scene.sheets ?? [];
  console.log(`sheets in view: ${sheets.length}`);
  for (const sh of sheets) {
    const c = sh.circle, nodesIn = c.nodes.filter(inView).length, shadowed = c.nodes.filter((n) => inShadow(sh, n.lon, n.lat)).length;
    const e = sh.extent, Rpage = mercY(c.nodes[0].lat) - mercY(c.lat);
    const roses = scene.roseDraws.filter((r) => r.sheet === sh.name).length;
    console.log(`  ${sh.curated ? 'CURATED' : 'grid   '} ${sh.name.padEnd(30)} extent ${f1(e.west)}..${f1(e.east)} x ${f1(e.south)}..${f1(e.north)} (${f1(e.east - e.west)} x ${f1(mercY(e.north) - mercY(e.south))} page-deg); centre ${f1(c.lon)},${f1(c.lat)} ${inView(c) ? 'IN' : 'out'}; ring radius ${f1(Rpage)} page-deg; nodes in view ${nodesIn}/16, in shadow ${shadowed}; own-figures ${sh.ornaments ? sh.ornaments.length : 'none(seeded)'}; shadows ${sh.shadow?.length ?? 0}; territory ${territory(sh, sh.from).toFixed(2)} win; roses emitted ${roses}`);
  }
  const rays = scene.sheets ? sheets.flatMap((sh) => [sh.circle, ...sh.circle.nodes].filter((n) => !inShadow(sh, n.lon, n.lat)).map((n) => ({ ...n, sheet: sh.name, reach: sh.reach }))) : [];
  console.log(`ray origins: ${rays.length} sheet nodes (${rays.filter(inView).length} inside the window) + the Catalan rose at ${ROSE.lon},${ROSE.lat} (${inView(ROSE) ? 'IN' : 'out'}, reach 180); x32 rays each`);
  for (const sh of sheets) { const r = rays.filter((o) => o.sheet === sh.name); if (r.length) console.log(`  ${sh.name}: ${r.length} origins, reach ${f1(r[0].reach)} deg`); }
  console.log(`roses emitted: ${scene.roseDraws.length}` + scene.roseDraws.map((r) => { const [lo, la] = data.proj.invert(r.x, r.y); return `\n  ${r.sheet} ${r.sprite.id} size ${Math.round(r.size)}px at ${f1(lo)},${f1(la)}`; }).join(''));
  const canvas = createCanvas(W, H); drawScene(canvas.getContext('2d'), scene, data, bg, { scale: 1, x: 0, y: 0 });
  writeFileSync(join(out, `view${String(k).replace(/\//g, '_')}.png`), canvas.toBuffer('image/png'));
}
