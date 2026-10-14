import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seaNames, coastNames } from '../scripts/names.mjs';

const square = (x0, y0, s, cw = false) => {
  const r = [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0]];
  return cw ? r.reverse() : r;
};
// a ring walked with a vertex every 0.1 degrees, so the thinning keeps its shape
const dense = (ring) => ring.slice(1).flatMap(([x, y], i) => {
  const [px, py] = ring[i];
  return Array.from({ length: 10 }, (_, k) => [px + ((x - px) * (k + 1)) / 10, py + ((y - py) * (k + 1)) / 10]);
});

test('a sea is named at a point inside its water, away from its edges', () => {
  const marine = { features: [{ properties: { name: 'Mare', featurecla: 'sea', scalerank: 3, min_label: 4 }, geometry: { type: 'Polygon', coordinates: [square(0, 0, 4)] } }] };
  const [f] = seaNames(marine).features;
  const [lon, lat] = f.geometry.coordinates;
  assert.equal(f.properties.name, 'Mare');
  assert.ok(lon > 1 && lon < 3 && lat > 1 && lat < 3, `${lon}, ${lat}`);
});

test('a country is named along the coast it shares with the coastline, land on the side its ring winds', () => {
  for (const cw of [false, true]) {
    const ring = dense(square(10, 10, 1, cw));
    ring.push(ring[0]);
    const countries = { features: [{ properties: { NAME: 'Isola', LABELRANK: 2, MIN_LABEL: 3 }, geometry: { type: 'Polygon', coordinates: [ring] } }] };
    // the coastline holds every vertex but those of the west side: that side is a land border
    const coastline = { features: [{ geometry: { type: 'LineString', coordinates: ring.filter(([x]) => x > 10.05) } }] };
    const [f] = coastNames(countries, coastline).features;
    assert.equal(f.properties.name, 'Isola');
    assert.equal(f.properties.land, cw ? 'right' : 'left');
    assert.ok(f.geometry.coordinates.every(([x]) => x > 10.05));
  }
});
