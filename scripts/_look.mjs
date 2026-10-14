// scratch renderer: node look.mjs name lon lat zoom [name lon lat zoom ...]
const R = '/home/solace/portolani/.claude/worktrees/metro-areas-city-rendering-1a6318/';
const S = '/home/solace/.local/state/claude-tmpdir/claude-1000/-home-solace-portolani--claude-worktrees-metro-areas-city-rendering-1a6318/52560b6b-1693-486b-be61-4e4c77e1b8f3/scratchpad/';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
const { createScene, drawScene, W, H } = await import(R + 'scripts/scene.mjs');
const { coastNames, joinNames } = await import(R + 'scripts/names.mjs');
const { cutCells } = await import(R + 'scripts/detail-cells.mjs');
const { joinUrban } = await import(R + 'scripts/urban.mjs');
const { geojsonPolygons, geojsonRings } = await import(R + 'node_modules/coast-wright/lib/index.js').catch(() => import('coast-wright'));
const GEO = R + 'node_modules/coastlines/data';
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
let names, urban, cells;
const cellsOf = () => cells ??= (() => {
  const c = '/tmp/x';
  const [l, co, mi] = ['ne-land-10m', 'ne-coastline-10m', 'ne-minor-islands-10m'].map((id) => read(join(GEO, id + '.geojson')));
  return cutCells({ land: geojsonPolygons(l), coast: [...geojsonRings(co), ...geojsonPolygons(mi).map((p) => p[0])] }, 5);
})();
const env = {
  createCanvas,
  readJSON: async (p) => {
    if (p === 'geo/names-50m.json') return names ??= joinNames(read(R + 'test/fixtures/sea-names-50m.json'), coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
    if (p === 'geo/urban-10m.json') return urban ??= joinUrban(read(join(GEO, 'ne-populated-places-50m.geojson')), read(R + 'downloads/ne_10m_urban_areas.geojson'));
    if (p === 'geo/10m/index.json') return { cell: 5, cells: [...cellsOf().keys()] };
    let m = /^geo\/10m\/(.*)\.json$/.exec(p); if (m) return cellsOf().get(m[1]);
    if (p.startsWith('geo/h/')) throw new Error('no h');
    if (p.startsWith('geo/')) return read(join(GEO, p.slice(4)));
    return read(R + p);
  },
  loadImage: (p) => loadImage(p.startsWith('geo/') ? join(GEO, p.slice(4)) : R + p),
  loadFont: async (family) => { GlobalFonts.registerFromPath(R + 'test/fixtures/IMFeENrm28P.ttf', family); },
};
const a = process.argv.slice(2);
for (let i = 0; i < a.length; i += 4) {
  const [name, lon, lat, zoom] = [a[i], +a[i + 1], +a[i + 2], +a[i + 3]];
  const { scene, data, bg, timing } = await createScene(env, { view: { lon, lat, zoom } });
  const c = createCanvas(W, H), g = c.getContext('2d');
  drawScene(g, scene, data, bg, { scale: 1, x: 0, y: 0 }); // warm
  globalThis.__T = [];
  const t = performance.now();
  drawScene(g, scene, data, bg, { scale: 1, x: 0, y: 0 });
  const draw = performance.now() - t; console.log(globalThis.__T.map(([k, v], i, a) => i ? k + ":" + (v - a[i - 1][1]).toFixed(0) : "").join(" "));
  if (process.env.PROF) { const sc = { ...scene, towns: scene.towns.filter((t) => !t.city) }; const t2 = performance.now(); drawScene(g, sc, data, bg, { scale: 1, x: 0, y: 0 }); console.log('without cities', (performance.now() - t2).toFixed(0)); }
  writeFileSync(S + 'png/' + name + '.png', c.toBuffer('image/png'));
  const cities = scene.towns.filter((t) => t.city).map((t) => `${t.name}(E ${Math.round(t.city.extent)} ${(t.city.plan.lots.length / 30) | 0} lots s=${t.city.plan.s.toFixed(1)})`);
  console.log(name, 'place', timing.place.toFixed(0), 'draw', draw.toFixed(0), 'cities', cities.join(' '), 'towns', scene.towns.filter((t) => !t.city).map((t) => `${t.name}:${t.size.toFixed(2)}`).join(' '));
}
if (process.env.DBG) { const { scene, data } = await createScene(env, { view: { lon: 2.35, lat: 48.86, zoom: 11 } });
const t = scene.towns.find((t) => t.city); console.log(t.city.land.length, t.city.land.map((p) => p[0].length), JSON.stringify(t.city.land[0][0].slice(0, 8)), data.land.length); }
