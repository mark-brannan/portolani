// Checks the voyage records (problems(), checkPerson() and readVoyage() in scripts/voyages.mjs are the schema): that
// every reference resolves, the schema, and that every sample of a sea leg
// (sampled every STEP_KM, 25 km, in scripts/voyages.mjs; a strait needs waypoints that close or closer)
// is at sea on the Natural Earth 50m coast. Prints each problem with the leg and the point, so a
// waypoint can be moved. Offline, from coastlines.
//   node scripts/check-voyages.mjs [id ...]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geojsonPolygons } from 'coast-wright';
import { seaSamples, problems, checkPerson, readVoyage as resolve } from './voyages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const DIR = join(ROOT, 'data', 'voyages');

export function loadLand() {
  return geojsonPolygons(JSON.parse(readFileSync(join(GEO, 'ne-land-50m.geojson'), 'utf8'))).map((poly) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of poly[0]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    return { poly, box: { x0, y0, x1, y1 } };
  });
}
const insideRing = (ring, lon, lat) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i], [d, e] = ring[j];
    if ((b > lat) !== (e > lat) && lon < ((d - a) * (lat - b)) / (e - b) + a) c = !c;
  }
  return c;
};
// the land polygon under a point, outer ring less its holes (a lake is water), or null at sea
export function landAt(land, lon, lat) {
  for (const l of land) {
    if (lat < l.box.y0 || lat > l.box.y1 || lon < l.box.x0 || lon > l.box.x1) continue;
    if (insideRing(l.poly[0], lon, lat) && !l.poly.slice(1).some((h) => insideRing(h, lon, lat))) return l;
  }
  return null;
}

const SHARED = ['index.json', 'people.json', 'sources.json']; // the files in data/voyages/ that are not voyages
export const voyageIds = () => readdirSync(DIR).filter((f) => f.endsWith('.json') && !SHARED.includes(f)).map((f) => f.slice(0, -5));
export const readJSON = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
export const readVoyage = (id) => resolve(id, readJSON);

// [{ what, where }] for a voyage: schema problems, then every sea sample on land
export function checkVoyage(v, land) {
  const out = problems(v).map((what) => ({ what }));
  for (const s of seaSamples(v)) {
    if (landAt(land, s.lon, s.lat)) out.push({ what: `leg ${s.i} (${s.leg.from} → ${s.leg.to}) crosses land`, where: [Number(s.lon.toFixed(2)), Number(s.lat.toFixed(2))] });
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const land = loadLand();
  let bad = 0;
  for (const id of process.argv.length > 2 ? process.argv.slice(2) : voyageIds()) {
    const found = await readVoyage(id).then((v) => checkVoyage(v, land), (e) => [{ what: e.message }]);
    bad += found.length;
    console.log(`${id}: ${found.length ? `${found.length} problems` : 'ok'}`);
    for (const f of found) console.log(`  ${f.what}${f.where ? ` at ${f.where.join(', ')}` : ''}`);
  }
  const people = readJSON('data/voyages/people.json'), sources = readJSON('data/voyages/sources.json');
  const who = Object.entries(people).flatMap(([id, p]) => checkPerson(id, p, { sources }));
  bad += who.length;
  console.log(`people: ${who.length ? `${who.length} problems` : 'ok'}`);
  for (const w of who) console.log(`  ${w}`);
  process.exitCode = bad ? 1 : 0;
}
