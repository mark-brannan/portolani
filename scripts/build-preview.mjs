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
// zip in downloads/, so a close view fetches only the cells around it. The islands of "h" that 50m
// lacks ship as an index of points, geo/isles.json (scripts/isles.mjs), so every view can mark
// them. The names the chart
// letters ship as geo/names-50m.json (scripts/names.mjs), and the urban footprints of its towns, the
// Natural Earth 10m urban areas joined to the places, as geo/urban-10m.json (scripts/urban.mjs). The
// Natural Earth 10m rivers and lakes, drawn past z9 (scripts/water.mjs), ship whole-feature in
// 5-degree cells (geo/water-10m/, cutWater); GSHHG lakes, drawn past z10, as its land is (geo/h-lakes/, geo/f-lakes/).

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as coastlines from 'coastlines';
import { geojsonPolygons, geojsonRings } from 'coast-wright';
import { bandOf } from './bands.mjs';
import { cutCells, cutLakes, cutWater, dbfRecords, gshhgLakes, joinWater, WATER_FILES } from './detail-cells.mjs';
import { seaNames, coastNames, joinNames, tintedSeas } from './names.mjs';
import { joinUrban } from './urban.mjs';
import { isleIndex } from './isles.mjs';
import { ATTEMPTS, fetchBytesWithRetry } from './fetch-retry.mjs';
const { find, localUrl } = coastlines;

const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, '_site');
const GEO = ['ne-land-50m', 'ne-coastline-50m', 'ne-populated-places-50m', ...(find('ne-urban-areas-50m') ? ['ne-urban-areas-50m'] : []),
  'ne-rivers-lake-centerlines-50m', 'ne-lakes-50m']; // urban areas from coastlines 0.0.5; rivers and lakes for scripts/water.mjs
const GEO_10M = ['ne-land-10m', 'ne-coastline-10m', 'ne-minor-islands-10m'];
const LAND_10M = bandOf('ne-10m-land'); // the bands scene.mjs reads: each is written to its own dir at its own cell size

const KEEP = { 'ne-populated-places-50m': ['NAME', 'SCALERANK', 'POP_MAX', 'MAX_AREAKM'], 'ne-urban-areas-50m': [],
  'ne-rivers-lake-centerlines-50m': ['name', 'featurecla', 'min_zoom'], 'ne-lakes-50m': ['name', 'min_zoom'] }; // what scripts/water.mjs reads
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
  // cut into geo/water-10m/ below; together 26 MB, too much to fetch whole for one close view. The
  // regional supplements hold what the world file leaves out (Lake Washington, Como, the Snohomish),
  // with no feature in both.
  ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_rivers_lake_centerlines.geojson', 'ne_10m_rivers_lake_centerlines.geojson', 'bb854a900ecbd3b408df46d5e16e3e0f974ba55993f9d8b5c26e855273c0905a', null],
  ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_rivers_north_america.geojson', 'ne_10m_rivers_north_america.geojson', 'dcd2348655a5f3d0ea7be35024073ab24f09115d2e4efb77e7bc0a33567db682', null],
  ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_rivers_europe.geojson', 'ne_10m_rivers_europe.geojson', '90712202ac46985812e90840df9acd5101599a9c649868d5bc55ee96c2fedd4c', null],
  ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_lakes.geojson', 'ne_10m_lakes.geojson', '2d036f53dedec578001c5c30c2959ee7d4eebc1306900fa4367c49929ec8f2d9', null],
  ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_lakes_north_america.geojson', 'ne_10m_lakes_north_america.geojson', '76f49d4b698f3529e690136a989713bcd3c028ade150346f4b358de9815cfc43', null],
  ['https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_lakes_europe.geojson', 'ne_10m_lakes_europe.geojson', 'b4dd9e7a5edd0d07b54768b5404d1ebe77f80b9d579c85fff65f90cf50369769', null],
  // GSHHG "f" land is read from the zip below; at 65 MB it is too big for the coastlines package
  ['https://www.soest.hawaii.edu/pwessel/gshhg/gshhg-shp-2.3.7.zip', 'gshhg-shp-2.3.7.zip', '8dbbe7e071e77e9e75f2d639239099ebca8d5c16d6a07df8169729d49f15cf41', null],
];

await mkdir(path.join(root, 'downloads'), { recursive: true });
for (const [url, name, sha, dir] of SOURCES) {
  const file = path.join(root, 'downloads', name);
  if (!existsSync(file)) {
    const bytes = await fetchBytesWithRetry(url, {
      onRetry: (error, attempt, wait) => console.error(`${url}: ${error.cause?.code ?? error.message}; attempt ${attempt} of ${ATTEMPTS} failed, retrying in ${wait / 1000} s`),
    });
    await writeFile(file, bytes);
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
await mkdir(path.join(out, 'geo', LAND_10M.dir), { recursive: true });
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
// likewise the seas the chart can tint (test/fixtures/seas-50m.json)
const red = tintedSeas(marine);
if (JSON.stringify(JSON.parse(await readFile(path.join(root, 'test', 'fixtures', 'seas-50m.json'), 'utf8'))) !== JSON.stringify(red)) throw new Error('test/fixtures/seas-50m.json is stale: write tintedSeas() of the marine download to it');
await writeFile(path.join(out, 'geo', 'seas-50m.json'), JSON.stringify(red));
await writeFile(path.join(out, 'geo', 'names-50m.json'), JSON.stringify(joinNames(seas, coastNames(countries, coast50))));
const urban = JSON.stringify(joinUrban(placesGeo, JSON.parse(await readFile(path.join(root, 'downloads', 'ne_10m_urban_areas.geojson'), 'utf8'))));
await writeFile(path.join(out, 'geo', 'urban-10m.json'), urban);
console.log(`urban footprints: ${(urban.length / 1e6).toFixed(2)} MB`);
// A band of detail cells: geo/<dir>/<xi>_<yi>.json and geo/<dir>/index.json.
async function writeBand(dir, cellDeg, geometry, cells = cutCells(geometry, cellDeg)) {
  await mkdir(path.join(out, 'geo', dir), { recursive: true });
  // in batches: "f" has some 70,000 cells, past a CI runner's open-file limit if written at once
  const all = [...cells];
  for (let i = 0; i < all.length; i += 512) await Promise.all(all.slice(i, i + 512).map(([k, c]) => writeFile(path.join(out, 'geo', dir, `${k}.json`), JSON.stringify(c))));
  await writeFile(path.join(out, 'geo', dir, 'index.json'), JSON.stringify({ cell: cellDeg, cells: [...cells.keys()] }));
  return cells.size;
}
// 10m rivers and lakes with their regional supplements (detail-cells.mjs WATER_FILES), whole features
// in the cells they reach
const WATER = bandOf('ne-10m-water'), WATER_CELL_DEG = WATER.cell;
const geo = async (f) => JSON.parse(await readFile(path.join(root, 'downloads', f), 'utf8'));
const [rivers10, lakes10] = await Promise.all([WATER_FILES.rivers, WATER_FILES.lakes].map(async (fs) => joinWater(await Promise.all(fs.map(geo)))));
const waterCells = cutWater(rivers10, lakes10, { size: WATER_CELL_DEG });
await mkdir(path.join(out, 'geo', WATER.dir), { recursive: true });
let waterBytes = 0;
for (const [k, c] of waterCells) { const json = JSON.stringify(c); waterBytes += json.length; await writeFile(path.join(out, 'geo', WATER.dir, `${k}.json`), json); }
await writeFile(path.join(out, 'geo', WATER.dir, 'index.json'), JSON.stringify({ cell: WATER_CELL_DEG, cells: [...waterCells.keys()] }));
console.log(`10m water: ${waterCells.size} cells of ${WATER_CELL_DEG} degree, ${(waterBytes / 1e6).toFixed(2)} MB`);
// 10m coast is the coastline file plus the minor islands' outlines, which 10m land fills but the
// coastline file mostly leaves out.
const [land10, coast10, minor10] = await Promise.all(GEO_10M.map(async (id) => JSON.parse(await readGeo(id))));
await writeBand(LAND_10M.dir, LAND_10M.cell, { land: geojsonPolygons(land10), coast: [...geojsonRings(coast10), ...geojsonPolygons(minor10).map((p) => p[0])] });
// GSHHG "h" ships polygons only, as a shapefile: the coast is every ring's outline, split at cell
// edges by cutCells. A coastlines without the entry (before 0.0.4) builds a site without the band,
// and the scene then stays on 10m cells past z10.
const H_ID = 'gshhg-land-h', H = bandOf('gshhg-h-land'), H_CELL_DEG = H.cell;
if (find(H_ID) && coastlines.shapefilePolygons) {
  const landH = coastlines.shapefilePolygons(await readGeo(H_ID));
  const n = await writeBand(H.dir, H_CELL_DEG, { land: landH, coast: landH.flat() });
  console.log(`GSHHG h: ${landH.length} polygons into ${n} cells of ${H_CELL_DEG} degree`);
  // the islands 50m leaves out, marked at every zoom before the h band (scripts/isles.mjs)
  const isles = JSON.stringify(isleIndex(landH, geojsonPolygons(JSON.parse(await readGeo('ne-land-50m')))));
  await writeFile(path.join(out, 'geo', 'isles.json'), isles);
  console.log(`island index: ${isles.length / 1e3} kB`);
} else console.warn(`${H_ID} is not in this coastlines (${coastlines.manifest.sources?.gshhg ? 'entry' : 'source'} missing); the h band is skipped`);
// GSHHG "f", the full resolution, the same way, from the zip coastlines pins for "h". Its zip reader
// is not a package export, so it is loaded by file next to coastlines' entry point.
const F_MEMBER = 'GSHHS_shp/f/GSHHS_f_L1.shp', F = bandOf('gshhg-f-land'), F_CELL_DEG = F.cell;
const { zipMember } = await import(new URL('zip.js', import.meta.resolve('coastlines')));
const gshhg = await readFile(path.join(root, 'downloads', 'gshhg-shp-2.3.7.zip'));
if (coastlines.shapefilePolygons) {
  const landF = coastlines.shapefilePolygons(zipMember(gshhg, F_MEMBER));
  const n = await writeBand(F.dir, F_CELL_DEG, { land: landF, coast: landF.flat() });
  console.log(`GSHHG f: ${landF.length} polygons into ${n} cells of ${F_CELL_DEG} degree`);
} else console.warn('this coastlines has no shapefilePolygons; the f band is skipped');
// GSHHG lakes (level 2, with river-lakes) and their islands (level 3) at "h" and "f", from the same
// zip, cut as the land bands are (cutLakes) into geo/h-lakes/ and geo/f-lakes/, for scene.mjs
// LAKE_BANDS: the lakes no Natural Earth file has, Dian Chi at Kunming among them.
if (coastlines.shapefilePolygons) {
  for (const [res, id] of [['h', 'gshhg-h-lakes'], ['f', 'gshhg-f-lakes']]) {
    const { dir, cell: cellDeg } = bandOf(id);
    const member = (level, ext) => zipMember(gshhg, `GSHHS_shp/${res}/GSHHS_${res}_L${level}.${ext}`);
    const lakes = gshhgLakes(...[2, 3].flatMap((level) => [coastlines.shapefilePolygons(member(level, 'shp')), dbfRecords(member(level, 'dbf'))]));
    const n = await writeBand(dir, cellDeg, null, cutLakes(lakes, cellDeg));
    console.log(`GSHHG ${res} lakes: ${lakes.length} lakes into ${n} cells of ${cellDeg} degree`);
  }
}
// LGPL: the GSHHG notice and licence travel with the cells cut from it, read from the pinned zip
for (const [id, member] of [['gshhg-licence', 'LICENSE.TXT'], ['gshhg-copying-lesser', 'COPYING.LESSERv3']]) {
  await writeFile(path.join(out, 'geo', `${id}.txt`), zipMember(gshhg, member));
}
await cp(path.join(root, 'node_modules', 'coast-wright', 'lib'), path.join(out, 'coast-wright'), { recursive: true });
await cp(path.join(root, 'public'), out, { recursive: true });
await cp(path.join(root, 'scripts', 'scene.mjs'), path.join(out, 'scene.mjs'));
for (const f of ['bands.mjs', 'catalogue.json', 'island.mjs', 'city.mjs', 'urban.mjs', 'water.mjs', 'buildings.mjs', 'trees.mjs', 'relief.mjs']) await cp(path.join(root, 'scripts', f), path.join(out, f));
await cp(path.join(root, 'packs'), path.join(out, 'packs'), { recursive: true });
console.log(`preview assembled in ${path.relative(root, out)}/`);
