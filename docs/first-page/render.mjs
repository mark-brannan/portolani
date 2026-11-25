// Scratch: render candidate first-page views at 1600 x 1000 with the page's default style, and a labelled strip.
// Usage: node render-home.mjs <worktree> <outdir> [names...]
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [ROOT, OUT, ...only] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const S = await import(pathToFileURL(join(ROOT, 'scripts/scene.mjs')).href);
const { coastNames, joinNames } = await import(pathToFileURL(join(ROOT, 'scripts/names.mjs')).href);
const { rangesFromRegions } = await import(pathToFileURL(join(ROOT, 'scripts/ranges-file.mjs')).href);
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m', pathToFileURL(join(ROOT, 'scripts/scene.mjs')).href)));
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
let made;
const names = () => made ??= joinNames(read(join(ROOT, 'test/fixtures/sea-names-50m.json')), coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const images = new Map();
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names() : p === 'geo/seas-50m.json' ? read(join(ROOT, 'test/fixtures/seas-50m.json')) : p === 'geo/playas-10m.json' ? read(join(ROOT, 'test/fixtures/playas-10m.json')) : p === 'geo/peaks-10m.json' ? read(join(ROOT, 'test/fixtures/peaks-10m.json')) : p === 'geo/ranges-10m.json' ? rangesFromRegions(resolve('geo/ne-geography-regions-polys-10m.geojson')) : read(resolve(p))),
  loadImage: (p) => images.get(p) ?? images.set(p, loadImage(resolve(p))).get(p),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test/fixtures/IMFeENrm28P.ttf'), family); },
};
// the page's DEFAULTS (public/page.js), as applyStyle hands them to createScene
const PAGE = { land: 'ochre', rivers: 'plain', lakes: 'marina', reefs: 'crosses', playas: 'salt', peaks: 'catalan', relief: ['marina'], trees: 'marina', scale: 'genoese', regions: 'latin', regionSet: 'today', regionStyle: 'combination', regionsZoom: 7, continents: true, continentsZoom: S.CONTINENT_ZOOM_END, title: 'PORTOLANI', autoTitle: true, scaleBorder: 'bordered' };

const DUL = 'Europe and the Mediterranean';
const VIEWS = {
  'A-today': { view: S.DEFAULT_VIEW, opts: { historical: false }, label: 'A  the first page today: seeded figures, one ship, no rose in frame' },
  'B-pr416-bare': { view: S.DEFAULT_VIEW, opts: {}, bare: true, label: 'B  PR 416 as it stands: Dulcert read as bare' },
  'C-lent-default-frame': { view: S.DEFAULT_VIEW, opts: {}, roseScale: 2, label: 'C  same frame; Dulcert lent the Catalan Atlas rose (at its hub) and ships' },
  'D-lent-hub-centred': { view: { lon: 14.5, lat: 40.3, zoom: S.DEFAULT_VIEW.zoom }, opts: {}, roseScale: 2, label: 'D  the same, framed on the hub: Italy centred, Sardinia to the Aegean' },
  'E-lent-wide': { view: { lon: 11, lat: 39.5, zoom: 5.25 }, opts: {}, roseScale: 2, label: 'E  the same, a wider frame: Gibraltar to Greece' },
  'F-tyrrhenian-z7': { view: { lon: 12.5, lat: 40.2, zoom: 7.0 }, opts: {}, label: 'F  a closer first page: Italy and the Tyrrhenian on a grid sheet (seeded), z7' },
};
const picked = only.length ? only : Object.keys(VIEWS);
const done = [];
for (const name of picked) {
  const v = VIEWS[name];
  const t = performance.now();
  S.ROSE_CAP.big = v.cap ?? 0.05;
  const { scene, data, bg } = await S.createScene(env, { view: v.view, ...PAGE, ...v.opts });
  if (v.bare) { scene.roseDraws = scene.roseDraws.filter((r) => r.sheet !== DUL); scene.ships = scene.ships.filter((r) => r.sheet !== DUL); scene.monsters = scene.monsters.filter((r) => r.sheet !== DUL); }
  if (v.roseScale) for (const r of scene.roseDraws) if (r.sheet === DUL) { r.size *= v.roseScale; r.sprite = { ...r.sprite, sizePx: r.sprite.sizePx * v.roseScale }; }
  const c = createCanvas(S.W, S.H);
  S.drawScene(c.getContext('2d'), scene, data, bg, { scale: 1, x: 0, y: 0 });
  const f = join(OUT, `${name}.jpg`);
  writeFileSync(f, c.toBuffer('image/jpeg', 85));
  const sheets = (scene.sheets ?? []).map((s) => s.name ?? s.source).join('; ');
  console.log(`${name}: ${((performance.now() - t) / 1000).toFixed(1)}s roses ${scene.roseDraws?.length ?? '?'} ships ${scene.ships?.length} monsters ${scene.monsters?.length} sheets [${sheets}]`);
  done.push({ name, label: v.label, canvas: c });
}
// strip: two columns, each cell 800 x 500 plus a label band
const CW = 800, CH = 500, LH = 34, cols = 2, rows = Math.ceil(done.length / cols);
const strip = createCanvas(CW * cols + 20 * (cols + 1), (CH + LH + 20) * rows + 20);
const g = strip.getContext('2d');
g.fillStyle = '#1d1913'; g.fillRect(0, 0, strip.width, strip.height);
g.imageSmoothingQuality = 'high';
done.forEach((d, i) => {
  const x = 20 + (i % cols) * (CW + 20), y = 20 + Math.floor(i / cols) * (CH + LH + 20);
  g.fillStyle = '#e9d8b4'; g.font = '22px sans-serif'; g.textBaseline = 'middle'; g.fillText(d.label, x, y + LH / 2);
  g.drawImage(d.canvas, x, y + LH, CW, CH);
});
writeFileSync(join(OUT, 'strip.jpg'), strip.toBuffer('image/jpeg', 85));
console.log(join(OUT, 'strip.jpg'));
