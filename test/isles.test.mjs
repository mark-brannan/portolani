// The island index (scripts/isles.mjs) and its marks: a z5 view of the eastern Pacific draws
// Pukapuka (Tuamotu), Pitcairn and Nuku Hiva, and no ornament stands on any of them (#126). The
// index is built from the installed GSHHG "h" shapefile, as scripts/render.mjs builds it, in some
// seconds. The view is written to out/isles-pacific-z5.png.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import * as coastlines from 'coastlines';
import { geojsonPolygons } from 'coast-wright';
import { createScene, drawScene, W, H } from '../scripts/scene.mjs';
import { isleIndex, islesOf, isleLand } from '../scripts/isles.mjs';
import { POIS } from '../scripts/pois.mjs';
import { coastNames, joinNames } from '../scripts/names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));

const land50 = geojsonPolygons(read(join(GEO, 'ne-land-50m.geojson')));
const outlines = isleLand(geojsonPolygons(read(join(GEO, 'ne-land-10m.geojson'))), land50);
const index = isleIndex(coastlines.shapefilePolygons(readFileSync(coastlines.localUrl(coastlines.find('gshhg-land-h')))),
  geojsonPolygons(read(join(GEO, 'ne-land-50m.geojson'))));
const names = joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names : p === 'geo/isles.json' ? index : p === 'geo/isles-land.json' ? outlines
    : p === 'geo/seas-50m.json' ? read(join(ROOT, 'test', 'fixtures', 'seas-50m.json')) : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};

const ISLANDS = { pukapuka: [-138.81, -14.82], pitcairn: [-130.10, -25.07], nukuHiva: [-140.10, -8.86] };
const RANGIROA = [-147.65, -15.13]; // 80 km of rim, its motus often more than JOIN_KM apart
const near = ([lon, lat], km) => islesOf(index).filter((i) => Math.hypot((i.lon - lon) * Math.cos(lat * Math.PI / 180), i.lat - lat) * 111.2 < km);

test('the index holds the islands 50m lacks, an atoll as an atoll, and not those it holds', () => {
  assert.deepEqual(near(ISLANDS.pukapuka, 10).map((i) => i.atoll), [true]);
  assert.deepEqual(near(ISLANDS.pitcairn, 10).map((i) => i.atoll), [false]);
  assert.equal(near(ISLANDS.nukuHiva, 20).length, 0); // 50m draws it
  assert.deepEqual(near(RANGIROA, 30).map((i) => i.atoll), [true]); // one ring, its arcs folded in
});

test('a z5 view of the eastern Pacific draws Pukapuka, Pitcairn and Nuku Hiva, and no ornament covers them', async () => {
  const { scene, data, bg, proj } = await createScene(env, { view: { lon: -135, lat: -16, zoom: 5 }, scale: 'off' });
  const canvas = createCanvas(W, H), g = canvas.getContext('2d');
  drawScene(g, scene, data, bg, { scale: 1, x: 0, y: 0 });
  mkdirSync(join(ROOT, 'out'), { recursive: true });
  writeFileSync(join(ROOT, 'out', 'isles-pacific-z5.png'), canvas.toBuffer('image/png'));
  const px = g.getImageData(0, 0, W, H).data;
  // ink: the darkest pixel within 4 px of the island
  const darkest = (x, y) => {
    let min = 255;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const i = (Math.round(y + dy) * W + Math.round(x + dx)) * 4;
      min = Math.min(min, 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]);
    }
    return min;
  };
  // every ornament as its whole sprite box
  const box = (x, y, w, h, ax = 0.5, ay = 0.5) => ({ x0: x - w * ax, x1: x + w * (1 - ax), y0: y - h * ay, y1: y + h * (1 - ay) });
  const sized = (o, ay) => box(o.x, o.y, o.size, (o.size * o.sprite.img.height) / o.sprite.img.width, 0.5, ay);
  const ornaments = [
    ...scene.roseDraws.map((o) => ['rose', sized(o)]), ...scene.monsters.map((o) => ['monster', sized(o)]),
    ...scene.ships.map((o) => ['ship', sized(o, 0.6)]), ...(scene.mountains ?? []).map((o) => ['mountain', sized(o)]),
    ['cartouche', box(scene.cartouche.x, scene.cartouche.y, scene.cartouche.w, scene.cartouche.h, 0, 0)],
  ];
  for (const [name, ll] of Object.entries(ISLANDS)) {
    const [x, y] = proj.project(...ll);
    assert.ok(x > 0 && x < W && y > 0 && y < H, `${name} is in the view`);
    assert.ok(darkest(x, y) < 100, `${name} is inked at (${x.toFixed(0)}, ${y.toFixed(0)})`);
    for (const [kind, b] of ornaments) assert.ok(!(x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1), `${name} is under a ${kind}`);
  }
});

// The remote islands 50m drops are drawn from their 10m outlines (isleLand): the Pitcairn Islands
// are Henderson in 50m and all four in 10m.
const inside = (ring, [x, y]) => {
  let n = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < xj + ((y - yj) * (xi - xj)) / (yi - yj)) n = !n;
  }
  return n;
};
// the point within the outline's box: an atoll's middle is its lagoon
const boxed = (ring, [x, y]) => Math.min(...ring.map((p) => p[0])) < x && x < Math.max(...ring.map((p) => p[0])) && Math.min(...ring.map((p) => p[1])) < y && y < Math.max(...ring.map((p) => p[1]));
const poi = (name) => { const p = POIS.find((q) => q.name === name); return [p.lon, p.lat]; };
test('the outlines hold Pitcairn, Oeno and Ducie, each round its point of interest, and not Henderson, which 50m holds', () => {
  for (const name of ['Pitcairn', 'Oeno', 'Ducie']) assert.ok(outlines.land.some((poly) => boxed(poly[0], poi(name))), `${name} is outlined`);
  assert.ok(!outlines.land.some((poly) => inside(poly[0], poi('Henderson'))), 'Henderson is not outlined twice');
  assert.ok(land50.some((poly) => inside(poly[0], poi('Henderson'))), 'Henderson is in 50m');
});

test('the Pitcairn Islands view letters all four, each tent beside its island and not over it', async () => {
  const { scene, proj } = await createScene(env, { view: { lon: -127.75, lat: -24.52, zoom: 7.31 }, scale: 'off' });
  for (const name of ['Pitcairn', 'Henderson', 'Ducie', 'Oeno']) {
    const t = scene.lesser.find((l) => l.poi && l.name === name);
    assert.ok(t, `${name} is lettered`);
    const [x, y] = proj.project(...poi(name));
    assert.ok(!(Math.abs(x - t.x) < t.h / 3 && y > t.y - t.h && y < t.y), `${name}'s tent at (${t.x.toFixed(0)}, ${t.y.toFixed(0)}) stands over it at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }
});
