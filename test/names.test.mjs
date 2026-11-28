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

test('a sea set in capitals is lettered like the rest', () => {
  const sea = (name, featurecla) => ({ properties: { name, featurecla, scalerank: 0, min_label: 1 }, geometry: { type: 'Polygon', coordinates: [square(0, 0, 4)] } });
  const marine = { features: [sea('INDIAN OCEAN', 'ocean'), sea('Golfe du Lion', 'gulf')] };
  assert.deepEqual(seaNames(marine).features.map((f) => f.properties.name), ['Indian Ocean', 'Golfe du Lion']);
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

test('a country is named along its mainland, not along a small island of its own', () => {
  const closed = (r) => [...r, r[0]];
  const main = closed(dense(square(0, 40, 4))), isle = closed(dense(square(8, 41, 1))), big = closed(dense(square(0, 30, 3)));
  const countries = { features: [{ properties: { NAME: 'Terra', LABELRANK: 2, MIN_LABEL: 3 }, geometry: { type: 'MultiPolygon', coordinates: [[main], [isle], [big]] } }] };
  const coastline = { features: [main, isle, big].map((coordinates) => ({ geometry: { type: 'LineString', coordinates } })) };
  const xs = coastNames(countries, coastline).features.flatMap((f) => f.geometry.coordinates.map(([x, y]) => [x, y]));
  assert.ok(xs.length > 0);
  assert.ok(xs.every(([x]) => x < 8 - 0.05), 'nothing lettered on the island a sixteenth of the mainland');
  assert.ok(xs.some(([, y]) => y < 34), 'the part over half the mainland keeps its lettering');
});
