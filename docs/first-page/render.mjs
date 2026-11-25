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
// The lent set is one list on Dulcert's row (scripts/atlas.mjs); a view sets its roses and ships in place.
const { CURATED } = await import(pathToFileURL(join(ROOT, 'scripts/atlas.mjs')).href);
const HUB = CURATED.find((c) => c.name === DUL), LENT = HUB.ornaments;
const merc = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI, unMerc = (y) => (Math.atan(Math.exp((y * Math.PI) / 180)) * 360) / Math.PI - 90;
const SHIPS = LENT.filter((f) => f.kind === 'ship').map((f) => [f.lon, f.lat]);
const ROSE = LENT.find((f) => f.kind === 'rose'), LENT_SHIPS = LENT.filter((f) => f.kind === 'ship');
// the lent set for a view: a rose at each place of `roses`, the ships at `ships`
function place(roses, ships) { LENT.length = 0; LENT.push(...roses.map(([lon, lat]) => ({ ...ROSE, lon, lat })), ...LENT_SHIPS.map((f, i) => ({ ...f, lon: ships[i][0], lat: ships[i][1] }))); }
// A rose stands only where rhumb lines meet (docs/spec/design.md), and Dulcert's lines meet at his hub and at the
// sixteen nodes of his ring. `node(i)` is the i-th, clockwise from north; of them the Bay of Biscay's (13), the Levant's (5)
// and the Baltic's (0) fall in the sea.
const node = (i) => { const b = (i * Math.PI) / 8, R = HUB.radius / Math.cos((HUB.lat * Math.PI) / 180); return [HUB.lon + R * Math.sin(b), unMerc(merc(HUB.lat) + R * Math.cos(b))]; };
const D = { view: { lon: 14.5, lat: 40.3, zoom: S.DEFAULT_VIEW.zoom }, opts: {}, roseScale: 2 };
// the middle of Dulcert's sheet (its extent's, on the page's Mercator) and the three nodes of his ring that fall in the sea
const SHEET_MID = [(HUB.extent.west + HUB.extent.east) / 2, unMerc((merc(HUB.extent.south) + merc(HUB.extent.north)) / 2)], SEA_NODES = [node(13), node(5), node(0)];
Object.assign(VIEWS, {
  'G-rose-biscay-node': { view: { lon: 4.5, lat: 42.3, zoom: S.DEFAULT_VIEW.zoom }, opts: {}, roseScale: 2, roses: [node(13)], label: 'G  the rose on a node of his ring, in the Bay of Biscay; his hub bare off Italy' },
  'J-today-biscay-node': { view: S.DEFAULT_VIEW, opts: {}, roseScale: 2, roses: [node(13)], label: 'J  the first page as served today (7°E 40.3°N); the rose on the Biscay node' },
  'K-today-hub-small': { view: S.DEFAULT_VIEW, opts: {}, roseScale: 1, label: 'K  the first page as served today; the rose at the hub at half the size' },
  'L-sheet-centre': { view: { lon: SHEET_MID[0], lat: SHEET_MID[1], zoom: S.DEFAULT_VIEW.zoom }, opts: {}, roseScale: 2, roses: SEA_NODES, label: 'L  centred on the middle of Dulcert\'s sheet, at the served zoom' },
  'M-sheet-whole': { view: { lon: SHEET_MID[0], lat: SHEET_MID[1], zoom: S.DEFAULT_VIEW.zoom - Math.log2((HUB.extent.east - HUB.extent.west) / 31) }, opts: {}, roseScale: 2, roses: SEA_NODES, label: 'M  his whole sheet in the window: the page lays de la Cosa\'s here' },
  'I-hub-rose-small': { ...D, roseScale: 1, label: 'I  D with the rose at the hub at half the size' },
});
const picked = only.length ? only : Object.keys(VIEWS);
const done = [];
for (const name of picked) {
  const v = VIEWS[name];
  const t = performance.now();
  S.ROSE_CAP.big = v.cap ?? 0.05;
  place(v.roses ?? [[HUB.lon, HUB.lat]], v.ships ?? SHIPS);
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
