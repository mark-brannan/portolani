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
import { fill, limn } from 'coast-wright'
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

test('cityPlan: a great city on land is a bastioned fort with a moat; one mostly over water is a lagoon city, unwalled', () => {
  const ring = Array.from({ length: 24 }, (_, i) => [400 + 380 * Math.cos(i / 24 * 2 * Math.PI), 300 + 380 * Math.sin(i / 24 * 2 * Math.PI)])
  const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const plan = (onLand) => cityPlan({ rings: [ring], x: 400, y: 300, extent: 670, zoom: 10, kmPx: 12, rnd: seeded(7), w: 800, h: 600, onLand })
  const fort = plan(() => true) // 670 px at 12 px/km: a 56 km footprint, past FORT_KM
  assert.ok(fort.walled && fort.bastioned && !fort.lagoon)
  assert.ok(fort.moat.length > 0 && fort.bastions.star.length > 0)
  assert.ok(fort.lots.length / 30 > 200 && fort.lots.length / 30 <= 20000 * 1.2, `${fort.lots.length / 30} lots`)
  const lagoon = plan((x, y) => x < 100) // the footprint mostly over water
  assert.ok(lagoon.lagoon && !lagoon.walled && !lagoon.bastioned)
  assert.equal(lagoon.roads.length, 0)
  assert.equal(lagoon.moat.length, 0)
  assert.ok(lagoon.lots.length / 30 > 200, `${lagoon.lots.length / 30} lots`)
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
  const { scene, data, bg } = await createScene(env, { view: { lon: -122.33, lat: 47.6, zoom: 10 }, scale: 'off' })
  const seattle = scene.towns.find((t) => t.name === 'Seattle')
  assert.ok(seattle?.city, 'Seattle is not a city at z10')
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

// The icon floor (scene.mjs ICON_GROW, ICON_MAX): a town's drawing is fixed by its name, and its icon
// stands at least 0.75 of its ground tall, to 96 px, so it grows as the view closes in. The area-only
// run (no urban footprints, so no download) pins the floor itself; the urban run, the drawing and growth.
const ICON_GROW = 0.75, ICON_MAX = 96
const areaEnv = { ...env, readJSON: async (p) => (p === 'geo/urban-10m.json' ? {} : env.readJSON(p)) }
const iconRun = async (e, name, lon, lat, zooms) => {
  const seen = []
  for (const zoom of zooms) {
    const { scene, data } = await createScene(e, { view: { lon, lat, zoom }, scale: 'off' })
    const t = scene.towns.find((x) => x.name === name)
    if (t?.city) break // the plan has taken over; it is not an icon
    assert.ok(t?.sprite, `${name} has no drawing at z${zoom}`)
    const p = data.places.find((x) => x.name === name)
    const extent = Math.sqrt(p.area) * (data.proj.k * 1000) / (6371008.8 * Math.cos(p.lat * Math.PI / 180))
    seen.push({ zoom, drawing: t.sprite.key, family: `${t.sprite.pack}/${t.sprite.style}`, h: t.h, floor: Math.min(ICON_MAX, ICON_GROW * extent) })
  }
  assert.ok(seen.length >= 2, `${name}: fewer than two icon zooms`)
  assert.equal(new Set(seen.map((s) => s.drawing)).size, 1, `${name} changes drawing: ${JSON.stringify(seen)}`)
  assert.equal(new Set(seen.map((s) => s.family)).size, 1, `${name} changes family: ${JSON.stringify(seen)}`)
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i].h >= seen[i - 1].h, `${name} shrinks z${seen[i - 1].zoom} -> z${seen[i].zoom}: ${JSON.stringify(seen)}`)
  assert.ok(seen.at(-1).h > seen[0].h, `${name} does not grow: ${JSON.stringify(seen)}`)
  return seen
}

test('a town keeps its drawing and its icon is floored at ICON_GROW of its metro area, to ICON_MAX', async () => {
  const seen = await iconRun(areaEnv, 'Victoria', -123.37, 48.43, [7, 8, 9, 10])
  for (const s of seen.filter((s) => s.h > seen[0].h)) assert.ok(Math.abs(s.h - s.floor) < 1e-6, `z${s.zoom}: h ${s.h}, floor ${s.floor}`)
  assert.ok(seen.every((s) => s.h >= s.floor - 1e-6), JSON.stringify(seen))
})

test('the metro-area floor takes the north-south scale from the projection, so plate-carree does not overstate it', async () => {
  const lon = -123.37, lat = 48.43, zoom = 9
  const at = async (projection) => {
    const { scene, data } = await createScene(areaEnv, { view: { lon, lat, zoom, projection }, scale: 'off' })
    return { h: scene.towns.find((x) => x.name === 'Victoria').h, lat: data.places.find((x) => x.name === 'Victoria').lat }
  }
  const merc = await at('mercator'), plate = await at('plate-carree')
  // plate-carree's north-south scale is cos(lat) of its east-west one; Mercator's are equal
  assert.ok(Math.abs(plate.h - merc.h * Math.sqrt(Math.cos(merc.lat * Math.PI / 180))) < 1e-6, `mercator ${merc.h}, plate-carree ${plate.h}`)
})

test('a town with an urban footprint keeps its drawing and its icon grows until the city plan takes over', { skip: !existsSync(URBAN) && 'no urban areas download' }, async () => {
  await iconRun(env, 'Victoria', -123.37, 48.43, [7, 7.5, 8, 8.5, 9])
  await iconRun(env, 'Seattle', -122.33, 47.6, [5, 6, 7])
})

// the GSHHG "h" cells npm run build:preview cuts into _site/, where the ship canal and the lakes are drawn
const SITE = join(ROOT, '_site')
const cellEnv = { ...env, readJSON: (p) => (/^geo\/(h|10m)\//.test(p) ? Promise.resolve(read(join(SITE, p))) : env.readJSON(p)) }

test('a built-up area is washed over its town\'s footprint and on land only, though the footprint is coarser than the coast', { skip: !existsSync(join(SITE, 'geo', 'h', 'index.json')) && 'no _site cells' }, async () => {
  const { scene, data, bg } = await createScene(cellEnv, { view: { lon: -122.35, lat: 47.648, zoom: 11 }, scale: 'off' })
  assert.ok(data.urban.length > 0, 'no 50m urban areas about Seattle')
  const draw = (d) => { const c = createCanvas(W, H); drawScene(c.getContext('2d'), { ...scene, towns: [] }, d, bg, { scale: 1, x: 0, y: 0 }); return c.getContext('2d').getImageData(0, 0, W, H).data }
  const a = draw(data), b = draw({ ...data, urban: [] })
  // the land as a mask, grown by the coast stroke, which the clip's antialiasing touches
  const m = createCanvas(W, H), mg = m.getContext('2d')
  fill(mg, data.land, data.proj.x, data.proj.y, { color: '#ffffff', lonCenter: data.proj.lonCenter })
  limn(mg, data.coastLL, data.proj.x, data.proj.y, { color: '#ffffff', alpha: 1, width: 6, lonCenter: data.proj.lonCenter })
  const land = mg.getImageData(0, 0, W, H).data
  // every town's 10m footprint, the ground the city plans stand on (a town off the view may reach into
  // it), grown by the edge's stroke; the rings are stored open
  const f = createCanvas(W, H), fg = f.getContext('2d'), towns = Object.values(await cellEnv.readJSON('geo/urban-10m.json'))
  fill(fg, towns, data.proj.x, data.proj.y, { color: '#ffffff', lonCenter: data.proj.lonCenter })
  limn(fg, towns.flat().map((r) => [...r, r[0]]), data.proj.x, data.proj.y, { color: '#ffffff', alpha: 1, width: 4, lonCenter: data.proj.lonCenter })
  const ground = fg.getImageData(0, 0, W, H).data
  let changed = 0, wet = 0, off = 0
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) < 30) continue
    changed++
    if (land[i + 3] === 0) wet++
    if (ground[i + 3] === 0) off++
  }
  assert.ok(changed > 2000, `${changed} px changed`)
  assert.equal(wet, 0, `${wet} of ${changed} washed px are at sea`)
  assert.equal(off, 0, `${off} of ${changed} washed px lie off the towns' footprints`)
})

// A waterfront town's icon stands over its built-up ground, not on its shore (scene.mjs standOf):
// Seattle's place point is on Elliott Bay, and its icon's box is mostly land through z9.
test('a waterfront town\'s icon stands on its ground, not on its shore', { skip: !existsSync(URBAN) && 'no urban areas download' }, async () => {
  for (const zoom of [6, 7, 8, 9]) {
    const { scene } = await createScene(env, { view: { lon: -122.33, lat: 47.6, zoom }, scale: 'off' })
    const t = scene.towns.find((x) => x.name === 'Seattle')
    assert.ok(t && !t.city && t.sprite, `Seattle is not an icon at z${zoom}`)
    const w = (t.h * t.sprite.img.width) / t.sprite.img.height
    let n = 0, dry = 0
    for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++, n++) if (scene.field.isLand(t.x + w * ((i + 0.5) / 6 - 0.5), t.y - t.h * (j + 0.5) / 6)) dry++
    assert.ok(dry / n >= 0.75, `z${zoom}: ${dry} of ${n} of the icon on land`)
  }
})
