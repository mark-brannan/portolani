#!/usr/bin/env node
// Assembles the browser preview into _site/, the Pages root:
// the page, the shared scene module and coast-wright, the sprite packs, the Natural Earth GeoJSON
// from coastlines (checked against its manifest) and the font, vendored so nothing loads from a
// CDN. The font and Natural Earth's marine polygons come from downloads/, each fetched from its
// pinned URL when missing, then checked against its sha256; the URLs and hashes below duplicate
// the ASSETS.md table: re-pin both together. The 50m GeoJSON ships whole, since the map can be
// moved anywhere in the world; places keep only the properties the scene reads. The 10m land and
// coast, for close views, ship cut into 5-degree cells (geo/10m/<xi>_<yi>.json, listed in
// geo/10m/index.json), GSHHG "h" land into 1-degree cells (geo/h/), when the installed
// coastlines carries it, and GSHHG "f" land into half-degree cells (geo/f/), read from the GSHHG
// zip in downloads/, so a close view fetches only the cells around it. The names the chart
// letters ship as geo/names-50m.json (scripts/names.mjs), and the urban footprints of its towns, the
// Natural Earth 10m urban areas joined to the places, as geo/urban-10m.json (scripts/urban.mjs).

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as coastlines from 'coastlines';
import { geojsonPolygons, geojsonRings } from 'coast-wright';
import { cutCells } from './detail-cells.mjs';
import { seaNames, coastNames, joinNames, redSea } from './names.mjs';
import { joinUrban } from './urban.mjs';
const { find, localUrl } = coastlines;

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, '_site');
const GEO = ['ne-land-50m', 'ne-coastline-50m', 'ne-populated-places-50m', ...(find('ne-urban-areas-50m') ? ['ne-urban-areas-50m'] : [])]; // urban areas from coastlines 0.0.5
const GEO_10M = ['ne-land-10m', 'ne-coastline-10m', 'ne-minor-islands-10m'];
const CELL_DEG = 5; // must match scene.mjs BANDS

const KEEP = { 'ne-populated-places-50m': ['NAME', 'SCALERANK', 'POP_MAX', 'MAX_AREAKM'], 'ne-urban-areas-50m': [] };
const slim = (geo, keys) => ({
  ...geo,
  features: geo.features.map((f) => ({ ...f, properties: Object.fromEntries(keys.map((k) => [k, f.properties[k]])) })),
});

const SOURCES = [
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/IMFeENrm28P.ttf', 'IMFeENrm28P.ttf', 'fe9705bbde51af802719246d4608d08d37bde956ab99d9a590da996a5221a24c', 'font'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/IMFeENit28P.ttf', 'IMFeENit28P.ttf', '47cd75dce54b1f2e0831359d22d5e688f519d68ae45706b664fd310fd0e3ccf7', 'font'],
  ['https://raw.githubusercontent.com/google/fonts/main/ofl/imfellenglish/OFL.txt', 'OFL-IMFellEnglish.txt', '2a3ca501fc4d5efcad9798531e3e06962b1e20c60e464f6cbd6c17630112c773', 'font'],
  // read into geo/names-50m.json below, not shipped as is
  ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_geography_marine_polys.geojson', 'ne_50m_geography_marine_polys.geojson', '6fe58083e0cc5c7fad9e396970e28a8580bbd8770cfa4d1d7b5a34423e912f97', null],
  // read into geo/urban-10m.json below; too big for coastlines, it moves to a coastlines-10m once that exists
  ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_urban_areas.geojson', 'ne_10m_urban_areas.geojson', '5136ffd816a9b28c0f295e6797b4c03eaa421be80d78b90f542db4a932dd4497', null],
  // GSHHG "f" land is read from the zip below; at 65 MB it is too big for the coastlines package
  ['https://www.soest.hawaii.edu/pwessel/gshhg/gshhg-shp-2.3.7.zip', 'gshhg-shp-2.3.7.zip', '8dbbe7e071e77e9e75f2d639239099ebca8d5c16d6a07df8169729d49f15cf41', null],
];

await mkdir(path.join(root, 'downloads'), { recursive: true });
for (const [url, name, sha, dir] of SOURCES) {
  const file = path.join(root, 'downloads', name);
  if (!existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  const got = createHash('sha256').update(await readFile(file)).digest('hex');
  if (got !== sha) throw new Error(`${name}: sha256 ${got} does not match ASSETS.md (${sha})`);
  if (!dir) continue;
  await mkdir(path.join(out, dir), { recursive: true });
  await cp(file, path.join(out, dir, name));
}
async function readGeo(id) {
  const entry = find(id), bytes = await readFile(localUrl(entry));
  const got = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (got !== entry.sha256) throw new Error(`${id}: ${got} does not match the coastlines manifest (${entry.sha256})`);
  return bytes;
}
await mkdir(path.join(out, 'geo', '10m'), { recursive: true });
let placesGeo;
for (const id of GEO) {
  const bytes = await readGeo(id);
  if (id === 'ne-populated-places-50m') placesGeo = JSON.parse(bytes);
  await writeFile(path.join(out, 'geo', `${id}.geojson`), id in KEEP ? JSON.stringify(slim(JSON.parse(bytes), KEEP[id])) : bytes);
}
// Names the chart letters: seas from the download, countries along their 50m coast.
const marine = JSON.parse(await readFile(path.join(root, 'downloads', 'ne_50m_geography_marine_polys.geojson'), 'utf8'));
const [countries, coast50] = await Promise.all(['ne-admin-0-countries-50m', 'ne-coastline-50m'].map(async (id) => JSON.parse(await readGeo(id))));
const seas = seaNames(marine);
// the golden test reads its seas from this fixture, offline: it must stay what the download gives
const fixture = await readFile(path.join(root, 'test', 'fixtures', 'sea-names-50m.json'), 'utf8');
if (JSON.stringify(JSON.parse(fixture)) !== JSON.stringify(seas)) throw new Error('test/fixtures/sea-names-50m.json is stale: write seaNames() of the marine download to it');
// likewise the Red Sea the chart can tint (test/fixtures/red-sea-50m.json)
const red = redSea(marine);
if (JSON.stringify(JSON.parse(await readFile(path.join(root, 'test', 'fixtures', 'red-sea-50m.json'), 'utf8'))) !== JSON.stringify(red)) throw new Error('test/fixtures/red-sea-50m.json is stale: write redSea() of the marine download to it');
await writeFile(path.join(out, 'geo', 'red-sea-50m.json'), JSON.stringify(red));
await writeFile(path.join(out, 'geo', 'names-50m.json'), JSON.stringify(joinNames(seas, coastNames(countries, coast50))));
const urban = JSON.stringify(joinUrban(placesGeo, JSON.parse(await readFile(path.join(root, 'downloads', 'ne_10m_urban_areas.geojson'), 'utf8'))));
await writeFile(path.join(out, 'geo', 'urban-10m.json'), urban);
console.log(`urban footprints: ${(urban.length / 1e6).toFixed(2)} MB`);
// A band of detail cells: geo/<dir>/<xi>_<yi>.json and geo/<dir>/index.json.
async function writeBand(dir, cellDeg, geometry) {
  const cells = cutCells(geometry, cellDeg);
  await mkdir(path.join(out, 'geo', dir), { recursive: true });
  // in batches: "f" has some 70,000 cells, past a CI runner's open-file limit if written at once
  const all = [...cells];
  for (let i = 0; i < all.length; i += 512) await Promise.all(all.slice(i, i + 512).map(([k, c]) => writeFile(path.join(out, 'geo', dir, `${k}.json`), JSON.stringify(c))));
  await writeFile(path.join(out, 'geo', dir, 'index.json'), JSON.stringify({ cell: cellDeg, cells: [...cells.keys()] }));
  return cells.size;
}
// 10m coast is the coastline file plus the minor islands' outlines, which 10m land fills but the
// coastline file mostly leaves out.
const [land10, coast10, minor10] = await Promise.all(GEO_10M.map(async (id) => JSON.parse(await readGeo(id))));
await writeBand('10m', CELL_DEG, { land: geojsonPolygons(land10), coast: [...geojsonRings(coast10), ...geojsonPolygons(minor10).map((p) => p[0])] });
// GSHHG "h" ships polygons only, as a shapefile: the coast is every ring's outline, split at cell
// edges by cutCells. A coastlines without the entry (before 0.0.4) builds a site without the band,
// and the scene then stays on 10m cells past z10.
const H_ID = 'gshhg-land-h', H_CELL_DEG = 1; // must match scene.mjs
if (find(H_ID) && coastlines.shapefilePolygons) {
  const landH = coastlines.shapefilePolygons(await readGeo(H_ID));
  const n = await writeBand('h', H_CELL_DEG, { land: landH, coast: landH.flat() });
  console.log(`GSHHG h: ${landH.length} polygons into ${n} cells of ${H_CELL_DEG} degree`);
} else console.warn(`${H_ID} is not in this coastlines (${coastlines.manifest.sources?.gshhg ? 'entry' : 'source'} missing); the h band is skipped`);
// GSHHG "f", the full resolution, the same way, from the zip coastlines pins for "h". Its zip reader
// is not a package export, so it is loaded by file next to coastlines' entry point.
const F_MEMBER = 'GSHHS_shp/f/GSHHS_f_L1.shp', F_CELL_DEG = 0.5; // must match scene.mjs
if (coastlines.shapefilePolygons) {
  const { zipMember } = await import(new URL('zip.js', import.meta.resolve('coastlines')));
  const landF = coastlines.shapefilePolygons(zipMember(await readFile(path.join(root, 'downloads', 'gshhg-shp-2.3.7.zip')), F_MEMBER));
  const n = await writeBand('f', F_CELL_DEG, { land: landF, coast: landF.flat() });
  console.log(`GSHHG f: ${landF.length} polygons into ${n} cells of ${F_CELL_DEG} degree`);
}
// LGPL: the GSHHG notice and licence travel with the cells cut from it
for (const id of ['gshhg-licence', 'gshhg-copying-lesser']) if (find(id)) await writeFile(path.join(out, 'geo', `${id}.txt`), await readGeo(id));
await cp(path.join(root, 'node_modules', 'coast-wright', 'lib'), path.join(out, 'coast-wright'), { recursive: true });
await cp(path.join(root, 'public'), out, { recursive: true });
await cp(path.join(root, 'scripts', 'scene.mjs'), path.join(out, 'scene.mjs'));
for (const f of ['island.mjs', 'city.mjs', 'urban.mjs']) await cp(path.join(root, 'scripts', f), path.join(out, f));
await cp(path.join(root, 'packs'), path.join(out, 'packs'), { recursive: true });
console.log(`preview assembled in ${path.relative(root, out)}/`);
