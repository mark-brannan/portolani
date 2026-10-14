// Urban footprints (scripts/urban.mjs) and the city plans drawn over them (scripts/city.mjs). The
// join and the plan are pure and run on small made-up shapes; the scene test reads the Natural
// Earth urban areas download (npm run build:preview fetches it) and is skipped without it.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { joinUrban, simplifyRing, urbanKey } from '../scripts/urban.mjs'
import { cityPlan } from '../scripts/city.mjs'
import { createScene, drawScene, W, H } from '../scripts/scene.mjs'
import { coastNames, joinNames } from '../scripts/names.mjs'

const square = (x, y, d) => [[x - d, y - d], [x + d, y - d], [x + d, y + d], [x - d, y + d], [x - d, y - d]]
const place = (NAME, lon, lat, box, SCALERANK = 2) => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { NAME, SCALERANK, ...(box && { MAX_BBXMIN: box[0], MAX_BBYMIN: box[1], MAX_BBXMAX: box[2], MAX_BBYMAX: box[3] }) },
})
const poly = (ring) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } })

test('joinUrban: a place takes the pieces in its metro box and the one holding it; a shared piece goes to the nearer', () => {
  const places = { features: [
    place('Big', 0, 0, [-0.5, -0.5, 0.5, 0.5]),
    place('Near', 0.6, 0, [0.3, -0.2, 0.9, 0.2]),
    place('Minor', 5, 5, null, 6), // past the rank the chart draws
    place('Boxless', 9, 9, null),
  ] }
  const urban = { features: [
    poly(square(0, 0, 0.1)), // holds Big
    poly(square(-0.4, 0.3, 0.05)), // in Big's box only
    poly(square(0.45, 0, 0.04)), // in both boxes, nearer Near
    poly(square(3, 3, 0.1)), // nobody's
    poly(square(5, 5, 0.1)), // Minor's, but Minor is not drawn
    poly(square(9, 9, 0.1)), // holds Boxless
  ] }
  const j = joinUrban(places, urban)
  assert.deepEqual(Object.keys(j).sort(), [urbanKey('Big', 0, 0), urbanKey('Boxless', 9, 9), urbanKey('Near', 0.6, 0)].sort())
  assert.equal(j[urbanKey('Big', 0, 0)].length, 2)
  assert.equal(j[urbanKey('Near', 0.6, 0)].length, 1)
  assert.deepEqual(j[urbanKey('Near', 0.6, 0)][0].map(([x]) => x).sort((a, b) => a - b)[0], 0.41)
})

test('simplifyRing keeps the corners of a shape, drops points on its edges, rounds to 4 decimals', () => {
  const ring = [[0, 0], [0.5, 0.00001], [1, 0], [1, 1], [0.5, 1.00002], [0, 1], [0, 0]]
  assert.deepEqual(simplifyRing(ring).map((p) => p.join()).sort(), ['0,0', '0,1', '1,0', '1,1'])
  assert.deepEqual(simplifyRing([[0.123456, 1], [2, 1], [1, 3]])[0], [0.1235, 1])
  assert.equal(simplifyRing([[0, 0], [1e-5, 0], [0, 1e-5]]), null)
})

test('cityPlan: the same seed lays out the same city; lots stay inside the footprint and under the cap', () => {
  const ring = Array.from({ length: 24 }, (_, i) => [400 + 300 * Math.cos(i / 24 * 2 * Math.PI), 300 + 220 * Math.sin(i / 24 * 2 * Math.PI)])
  const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const plan = (zoom) => cityPlan({ rings: [ring], x: 400, y: 300, extent: 460, zoom, kmPx: 38, rnd: seeded(42), w: 800, h: 600 })
  const a = plan(11), b = plan(11)
  assert.deepEqual([...a.lots], [...b.lots])
  assert.ok(a.lots.length / 30 > 200, `${a.lots.length / 30} lots`)
  assert.ok(a.churches.length > 1 && a.towers.length >= 3 * 6)
  for (let i = 0; i < a.lots.length; i += 30) {
    const dx = (a.lots[i] - 400) / 300, dy = (a.lots[i + 1] - 300) / 220
    assert.ok(dx * dx + dy * dy < 1.1, `lot at ${a.lots[i]},${a.lots[i + 1]}`)
  }
  const huge = cityPlan({ rings: [[[-100, -100], [900, -100], [900, 700], [-100, 700]]], x: 400, y: 300, extent: 4000, zoom: 9, kmPx: 10, rnd: seeded(1), w: 800, h: 600 })
  assert.ok(huge.lots.length / 30 <= 20000 * 1.2, `${huge.lots.length / 30} lots`)
})

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const URBAN = join(ROOT, 'downloads', 'ne_10m_urban_areas.geojson')
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')))
const read = (file) => JSON.parse(readFileSync(file, 'utf8'))
let urban
const env = {
  createCanvas,
  readJSON: async (p) => p === 'geo/names-50m.json'
    ? joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')), coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))))
    : p === 'geo/urban-10m.json' ? (urban ??= joinUrban(read(join(GEO, 'ne-populated-places-50m.geojson')), read(URBAN)))
    : read(p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p)),
  loadImage: (p) => loadImage(p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family) },
}

test('a city close in is drawn as a plan over its footprint, on land only, its name lettered', { skip: !existsSync(URBAN) && 'no urban areas download' }, async () => {
  const { scene, data, bg } = await createScene(env, { view: { lon: -122.33, lat: 47.6, zoom: 9 }, scale: 'off' })
  const seattle = scene.towns.find((t) => t.name === 'Seattle')
  assert.ok(seattle?.city, 'Seattle is not a city at z9')
  assert.ok(scene.names.some((n) => n.text === 'Seattle'), 'no Seattle lettered')
  const L = seattle.city.plan.lots
  assert.ok(L.length / 30 > 100, `${L.length / 30} lots`)
  const c = createCanvas(W, H), g = c.getContext('2d')
  drawScene(g, scene, data, bg, { scale: 1, x: 0, y: 0 })
  const without = createCanvas(W, H)
  drawScene(without.getContext('2d'), { ...scene, towns: scene.towns.filter((t) => !t.city) }, data, bg, { scale: 1, x: 0, y: 0 })
  const a = g.getImageData(0, 0, W, H).data, b = without.getContext('2d').getImageData(0, 0, W, H).data
  // every pixel the plan changed is on land, a coast stroke's width aside
  let changed = 0, wet = 0
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const i = (y * W + x) * 4
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) < 30) continue
    changed++
    if (scene.field.at(x, y) > 8) wet++
  }
  assert.ok(changed > 2000, `${changed} px changed`)
  assert.ok(wet / changed < 0.01, `${wet} of ${changed} changed px are at sea`)
})

test('a town keeps its drawing across zooms and its icon never shrinks until the city plan takes over', { skip: !existsSync(URBAN) && 'no urban areas download' }, async () => {
  for (const [name, lon, lat, zooms] of [['Victoria', -123.37, 48.43, [7, 7.5, 8, 8.5, 9]], ['Seattle', -122.33, 47.6, [5, 6, 7]]]) {
    const seen = []
    for (const zoom of zooms) {
      const { scene } = await createScene(env, { view: { lon, lat, zoom }, scale: 'off' })
      const t = scene.towns.find((x) => x.name === name)
      if (t?.city) break // the plan has taken over; it is not an icon
      assert.ok(t?.sprite, `${name} has no drawing at z${zoom}`)
      seen.push({ zoom, drawing: `${t.family?.[0]?.pack ?? ''}|${t.sprite.pack}|${t.sprite.style}|${t.sprite.img.width}x${t.sprite.img.height}`, h: t.h })
    }
    assert.ok(seen.length >= 2, `${name}: fewer than two icon zooms`)
    assert.equal(new Set(seen.map((s) => s.drawing)).size, 1, `${name} changes drawing: ${JSON.stringify(seen)}`)
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i].h >= seen[i - 1].h, `${name} shrinks z${seen[i - 1].zoom} -> z${seen[i].zoom}: ${seen[i - 1].h} -> ${seen[i].h}`)
    assert.ok(seen.at(-1).h > seen[0].h, `${name} does not grow: ${JSON.stringify(seen)}`)
  }
})
