// The vivid pack is drawn as SVG and rasterised in Node by @napi-rs/canvas (resvg): every SVG in
// packs/vivid/ must load to a non-empty image, and every sprite the manifest names must exist and
// put ink on the canvas at its sizePx (a file leaning on a font, a filter or an external reference
// loads but draws nothing); the Martines town vignettes are what scripts/gen-towns.mjs writes, and the
// town sprites and mountains are placed as scene.mjs says. Offline: reads only the repo, node_modules
// and committed fixtures.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadImage, createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { townSVG, VARIANTS, fileOf } from '../scripts/gen-towns.mjs'
import { createScene, listSprites, defaultSprites, KINDS, DEFAULT_KINDS, W, H } from '../scripts/scene.mjs'
import { coastNames, joinNames } from '../scripts/names.mjs'

const VIVID = fileURLToPath(new URL('../packs/vivid/', import.meta.url))
const pack = JSON.parse(readFileSync(`${VIVID}pack.json`, 'utf8'))

for (const file of readdirSync(VIVID).filter((f) => f.endsWith('.svg'))) {
  test(`vivid SVG renders: ${file}`, async () => {
    const img = await loadImage(`${VIVID}${file}`)
    assert.ok(img.width > 0 && img.height > 0, `${file}: ${img.width} x ${img.height}`)
  })
}

test('every vivid pack entry names a file that exists', () => {
  for (const s of pack.sprites) assert.ok(existsSync(`${VIVID}${s.file}`), `${s.id}: ${s.file} missing`)
})

test('every vivid pack entry draws ink at its sizePx', async () => {
  for (const s of pack.sprites) {
    const c = createCanvas(s.sizePx, s.sizePx), g = c.getContext('2d')
    g.drawImage(await loadImage(`${VIVID}${s.file}`), 0, 0, s.sizePx, s.sizePx)
    const px = g.getImageData(0, 0, s.sizePx, s.sizePx).data
    let inked = 0
    for (let i = 3; i < px.length; i += 4) if (px[i]) inked++
    assert.ok(inked > 0, `${s.id}: draws nothing at ${s.sizePx} px`)
  }
})

test('vivid monsters and ships carry their placement fields', () => {
  for (const s of pack.sprites.filter((s) => s.kind === 'monster' || s.kind === 'ship')) {
    assert.ok(s.style && s.after, `${s.id}: style and after`)
    if (s.kind === 'monster') assert.ok(s.weight > 0 && s.minClearancePx > 0, `${s.id}: weight and minClearancePx`)
    else assert.ok(['left', 'right'].includes(s.heading), `${s.id}: heading`)
  }
})

test('vivid roses name their style and what they are after', () => {
  for (const s of pack.sprites.filter((s) => s.kind === 'rose')) {
    assert.match(s.style ?? '', /^[a-z][a-z-]*$/, `${s.id}: style slug`)
    assert.match(s.after ?? '', /^https:\/\//, `${s.id}: after URL`)
  }
})

test('vivid sprites are plain shapes: no text, filter, class or external reference', () => {
  for (const s of pack.sprites) {
    const svg = readFileSync(`${VIVID}${s.file}`, 'utf8')
    assert.ok(!/<text|<filter|\bclass=|href="http/.test(svg), `${s.id}: uses text, a filter, a class or an external ref`)
  }
})

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = join(ROOT, 'packs', 'vivid');
const manifest = pack;

test('the town and mountain sprites carry a style, an `after` page and a size', () => {
  for (const s of manifest.sprites.filter((s) => s.kind === 'mountain' || s.id.startsWith('town-martines-'))) {
    assert.ok(s.style && s.after?.startsWith('https://') && s.sizePx > 0, `${s.id}: style, after or sizePx missing`);
  }
});

test('the Martines vignettes are what gen-towns.mjs writes', () => {
  for (const [name, p] of Object.entries(VARIANTS)) {
    assert.equal(readFileSync(fileOf(name), 'utf8'), townSVG(name, p), `town-martines-${name}.svg differs; run node scripts/gen-towns.mjs`);
    assert.ok(manifest.sprites.some((s) => s.file === `town-martines-${name}.svg`), `${name}: not in pack.json`);
  }
});

const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')));
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p));
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
let made;
const names = () => made ??= joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))));
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names() : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family); },
};
// Oriented boxes { cx, cy, ux, uy, hw, hh } meet unless some axis of either separates them.
function overlap(a, b) {
  const dx = b.cx - a.cx, dy = b.cy - a.cy;
  return [[a.ux, a.uy], [-a.uy, a.ux], [b.ux, b.uy], [-b.uy, b.ux]].every(([ax, ay]) => {
    const ra = a.hw * Math.abs(a.ux * ax + a.uy * ay) + a.hh * Math.abs(-a.uy * ax + a.ux * ay);
    const rb = b.hw * Math.abs(b.ux * ax + b.uy * ay) + b.hh * Math.abs(-b.uy * ax + b.ux * ay);
    return Math.abs(dx * ax + dy * ay) <= ra + rb;
  });
}
const NILE = { lon: 31.6, lat: 31.0, zoom: 7 };
const LIGURIA = { lon: 8.93, lat: 44.41, zoom: 5 };

test('towns are drawn towers by default and Martines vignettes when asked', async () => {
  const plain = (await createScene(env, { view: NILE })).scene;
  assert.ok(plain.towns.length > 0 && plain.towns.every((t) => !t.sprite));
  const { scene } = await createScene(env, { view: NILE, town: 'martines' });
  const by = Object.fromEntries(scene.towns.map((t) => [t.name, t.sprite?.id]));
  assert.equal(by.Cairo, 'town-martines-levant');
  assert.ok(scene.towns.every((t) => t.sprite?.style === 'martines'), 'a town left without a vignette');
  const port = (await createScene(env, { view: LIGURIA, town: 'martines' })).scene.towns.find((t) => t.name === 'Rome');
  assert.equal(port.sprite.id, 'town-martines-port');
});

test('mountains: off by default; on, inland, apart and clear of names', async () => {
  assert.ok(!DEFAULT_KINDS.includes('mountain') && KINDS.includes('mountain'));
  assert.equal((await createScene(env, { view: LIGURIA })).scene.mountains.length, 0);
  assert.equal((await createScene(env, { view: { lon: 10, lat: 30, zoom: 2 }, kinds: KINDS })).scene.mountains.length, 0, 'mountains at z2');
  // zoom 4 with the regions lettered: a range placed without regard to names lands on Budapest, Kyiv and Munich here
  const { scene, data } = await createScene(env, { view: { ...LIGURIA, zoom: 4 }, kinds: KINDS, regions: 'latin' });
  const ms = scene.mountains;
  assert.ok(ms.length > 0 && ms.length <= 3, `${ms.length} mountains`);
  for (const m of ms) {
    const h = (m.size * m.sprite.img.height) / m.sprite.img.width;
    for (const [dx, dy] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5], [0, 0]]) {
      assert.ok(scene.field.isLand(m.x + dx * m.size, m.y + dy * h), `${m.sprite.id} at ${m.x},${m.y} not on land`);
    }
    const drawn = { cx: m.x, cy: m.y, ux: 1, uy: 0, hw: m.size / 2, hh: h / 2 }; // the sprite as drawn
    for (const n of [...scene.names, ...scene.worldNames]) assert.ok(!overlap(n.box, drawn), `${m.sprite.id} meets the name ${n.text}`);
    for (const o of ms) if (o !== m) assert.ok(Math.hypot(o.x - m.x, o.y - m.y) >= 180);
    assert.ok(m.x > 0 && m.x < W && m.y > 0 && m.y < H);
  }
  assert.ok(data.proj.zoom >= 3);
});

test('town families mix: each placed town takes the next family in turn', async () => {
  const sprites = [...manifest.sprites.filter((s) => s.style === 'martines' && s.kind === 'town').map((s) => `vivid/${s.id}`), 'plain/tower'];
  const { scene } = await createScene(env, { view: LIGURIA, sprites });
  assert.ok(scene.towns.length > 4);
  scene.towns.forEach((t, i) => assert.equal(t.sprite?.style ?? 'tower', i % 2 ? 'tower' : 'martines', `${t.name}, town ${i}`));
  assert.equal((await createScene(env, { view: LIGURIA, sprites: ['vivid/serpent-a'] })).scene.towns.length, 0, 'no town family, no towns');
});

test('townSize: by population a great city stands bigger than a small town; by rank, as before', async () => {
  const { scene } = await createScene(env, { view: NILE });
  const by = Object.fromEntries(scene.towns.map((t) => [t.name, t]));
  assert.ok(by.Cairo && by.Suez, scene.towns.map((t) => t.name).join());
  assert.ok(by.Cairo.size > 1.3 && by.Cairo.size > by.Suez.size * 1.4, `Cairo ${by.Cairo.size}, Suez ${by.Suez.size}`);
  const rank = (await createScene(env, { view: NILE, townSize: 'rank' })).scene.towns;
  for (const t of rank) assert.equal(t.size, t.rank <= 2 ? 1.25 : 1, t.name);
});

test('the monster and ship cast is the same for one view, and a big selection shows more of itself across views', async () => {
  const list = await listSprites(env);
  const sprites = [...defaultSprites(list), ...list.filter((s) => s.kind === 'monster').map((s) => s.key)];
  const cast = async (view) => { const { scene } = await createScene(env, { view, sprites, scale: 'off' }); return [...scene.monsters, ...scene.ships].map((m) => `${m.sprite.key}@${Math.round(m.x)},${Math.round(m.y)}`); };
  assert.deepEqual(await cast(LIGURIA), await cast(LIGURIA));
  const seen = new Set();
  for (const view of [LIGURIA, { lon: -30, lat: 40, zoom: 5 }, { lon: -150, lat: 20, zoom: 5 }, { lon: 70, lat: -20, zoom: 5 }]) {
    for (const m of (await createScene(env, { view, sprites, scale: 'off' })).scene.monsters) seen.add(m.sprite.key);
  }
  assert.ok(seen.size > 4, `only ${[...seen]} across four views`);
});
