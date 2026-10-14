// Land treatments: which islands the cut fills, that an island keeps its colour through the cells
// cut from it, and that the Red Sea tint covers the Gulf of Suez. Offline, from coastlines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geojsonPolygons } from 'coast-wright';
import { islandInfo, ISLAND_KM2 } from '../scripts/island.mjs';
import { cutCells } from '../scripts/detail-cells.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const polys = geojsonPolygons(JSON.parse(readFileSync(join(GEO, 'ne-land-50m.geojson'), 'utf8')));

const inside = (r, x, y) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [a, b] = r[i], [d, e] = r[j];
    if ((b > y) !== (e > y) && x < ((d - a) * (y - b)) / (e - b) + a) c = !c;
  }
  return c;
};
const at = (lon, lat) => islandInfo(polys.find((p) => inside(p[0], lon, lat)));

test('the cut at 5,000 km2 fills the small islands and leaves the big ones', () => {
  for (const [name, lon, lat] of [['Euboea', 23.9, 38.6], ['Mallorca', 2.95, 39.6], ['Malta', 14.4, 35.9], ['Lesbos', 26.3, 39.2]]) {
    assert.ok(at(lon, lat).km2 < ISLAND_KM2, `${name} is filled`);
  }
  for (const [name, lon, lat] of [['Sicily', 14, 37.6], ['Sardinia', 9, 40], ['Corsica', 9.1, 42.2], ['Crete', 24.9, 35.2], ['Cyprus', 33, 35]]) {
    assert.ok(at(lon, lat).km2 >= ISLAND_KM2, `${name} is not`);
  }
  assert.ok(Math.abs(at(14, 37.6).km2 - 25700) < 1500, 'Sicily is about 25,700 km2');
});

test('an island keeps its colour from cell to cell, whatever piece of it a cell holds', () => {
  const sicily = polys.find((p) => inside(p[0], 14, 37.6));
  const cells = cutCells({ land: [sicily], coast: [] }, 5);
  assert.ok(cells.size > 1);
  for (const c of cells.values()) for (const m of c.m) assert.deepEqual(m, [islandInfo(sicily).km2, islandInfo(sicily).hue]);
});

test('the Red Sea tint reaches the Gulf of Suez and the Gulf of Aqaba', () => {
  const fixture = JSON.parse(readFileSync(join(ROOT, 'test', 'fixtures', 'red-sea-50m.json'), 'utf8'));
  const sea = geojsonPolygons(fixture);
  for (const [lon, lat] of [[38, 20], [32.6, 29.7], [34.95, 29.2]]) assert.ok(sea.some((p) => inside(p[0], lon, lat)), `${lon}, ${lat}`);
});
