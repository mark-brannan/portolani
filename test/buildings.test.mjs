// The Carta Marina's buildings drawn in code (scripts/buildings.mjs): each draws, in ink, parchment
// and red; the picker has a glyph for each; and the lesser places stand as a church or a house, lettered,
// from DETAIL_ZOOM in. Offline: reads only the repo, node_modules and committed fixtures.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadImage, createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { BUILDINGS, RUIN, LESSER_PX, lesserBuilding } from '../scripts/buildings.mjs'
import { POIS, POI_ZOOM } from '../scripts/pois.mjs'
import { createScene, towerGlyph, DETAIL_ZOOM } from '../scripts/scene.mjs'
import { coastNames, joinNames } from '../scripts/names.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const GEO = dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-50m')))
const read = (file) => JSON.parse(readFileSync(file, 'utf8'))
let made
const names = () => made ??= joinNames(read(join(ROOT, 'test', 'fixtures', 'sea-names-50m.json')),
  coastNames(read(join(GEO, 'ne-admin-0-countries-50m.geojson')), read(join(GEO, 'ne-coastline-50m.geojson'))))
const resolve = (p) => (p.startsWith('geo/') ? join(GEO, p.slice(4)) : join(ROOT, p))
const env = {
  createCanvas,
  readJSON: async (p) => (p === 'geo/names-50m.json' ? names() : read(resolve(p))),
  loadImage: (p) => loadImage(resolve(p)),
  loadFont: async (family) => { GlobalFonts.registerFromPath(join(ROOT, 'test', 'fixtures', 'IMFeENrm28P.ttf'), family) },
}
const IDS = ['house', 'church', 'castle', 'round-tower', 'tent']

test('the Carta Marina buildings: five, in the towers\' path data, within the towers\' box', () => {
  assert.deepEqual(BUILDINGS.map((b) => b.id), IDS)
  for (const b of BUILDINGS) {
    assert.equal(b.style, 'carta-marina', b.id)
    assert.ok(b.w > 0 && b.w <= 8, `${b.id}: half-width ${b.w}`) // the picker's box stays the towers'
    for (const [kind, d] of b.layers) {
      assert.ok('prks'.includes(kind), `${b.id}: layer ${kind}`)
      assert.match(d, /^M[-\d. MLHVQZ]*$/, `${b.id}: only M L H V Q Z`)
      const ys = [...d.matchAll(/[MLQ]\s*-?[\d.]+\s+(-?[\d.]+)|V\s*(-?[\d.]+)/g)].map((m) => +(m[1] ?? m[2]))
      assert.ok(ys.every((y) => y >= -16.5 && y <= 1), `${b.id}: ${ys} leaves the 16.5-unit box`)
    }
  }
})

test('towerGlyph draws each building as SVG, in ink, parchment and, but the tent, red', async () => {
  for (const id of IDS) {
    const svg = towerGlyph(id)
    assert.match(svg, /^<svg viewBox="-9 -17.5 18 19">(<path [^>]+\/>)+<\/svg>$/, id)
    const img = await loadImage(Buffer.from(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="76" ').replaceAll('currentColor', '#3b2a1a')))
    const c = createCanvas(72, 76), g = c.getContext('2d')
    g.drawImage(img, 0, 0)
    const px = g.getImageData(0, 0, 72, 76).data
    let ink = 0, red = 0, parchment = 0
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 200) continue
      const [r, gr, b] = [px[i], px[i + 1], px[i + 2]]
      if (r < 90 && gr < 70) ink++
      else if (r > 120 && gr < 70 && b < 50) red++
      else if (r > 200 && gr > 190) parchment++
    }
    assert.ok(ink > 40 && parchment > 40, `${id}: ink ${ink}, parchment ${parchment}`)
    if (id !== 'tent') assert.ok(red > 20, `${id}: red ${red}`)
  }
  // the towers' glyphs keep their box
  for (const id of ['tower', 'tower-round', 'tower-gate', 'tower-spire', 'tower-dome']) assert.match(towerGlyph(id), /^<svg viewBox="-9 -17\.5 18 19">/, id)
})

test('a lesser place is a church or a house, the bigger likelier a church, never a castle', () => {
  const seeds = Array.from({ length: 400 }, (_, i) => Math.imul(i + 1, 2654435761))
  const churches = (rank) => seeds.filter((s) => lesserBuilding(rank, s) === 'church').length
  for (let rank = 5; rank <= 8; rank++) assert.ok(seeds.every((s) => ['church', 'house'].includes(lesserBuilding(rank, s))), `rank ${rank}`)
  assert.ok(churches(5) > churches(6) && churches(6) > churches(7) && churches(7) >= churches(8), [5, 6, 7, 8].map(churches).join(' '))
})

test('lesser places stand at zoom 10, lettered, a fixed height, and not at zoom 5', async () => {
  const LIGURIA = { lon: 8.7, lat: 44.3 }
  const close = (await createScene(env, { view: { ...LIGURIA, zoom: 10 } })).scene
  close.lesser = close.lesser.filter((t) => !t.poi) // the points of interest have their own test
  assert.ok(DETAIL_ZOOM <= 10)
  assert.ok(close.lesser.length > 0, 'no lesser place at zoom 10')
  for (const t of close.lesser) {
    assert.ok(['church', 'house'].includes(t.tower), `${t.name}: ${t.tower}`)
    assert.equal(t.h, LESSER_PX, t.name)
    assert.ok(t.rank > 4 && t.rank <= 8, `${t.name}: rank ${t.rank}`)
    assert.ok(close.names.some((n) => n.text === t.name), `${t.name}: not lettered`)
    assert.ok(!close.towns.some((u) => u.name === t.name), `${t.name}: also a town`)
  }
  assert.ok(close.lesser.some((t) => t.name === 'Genoa'))
  const far = (await createScene(env, { view: { ...LIGURIA, zoom: 5 } })).scene
  assert.deepEqual(far.lesser.filter((t) => !t.poi), [])
})

test('points of interest are lettered from POI_ZOOM, bigger than the lesser places, and name the cartouche', async () => {
  const at = (p, zoom, opts = {}) => createScene(env, { view: { lon: p.lon, lat: p.lat, zoom }, ...opts }).then((r) => r.scene)
  for (const p of POIS) {
    const near = await at(p, 7)
    const t = near.lesser.find((l) => l.name === p.name)
    assert.ok(t?.poi, `${p.name}: not placed at zoom 7`)
    assert.equal(t.tower, p.building, p.name)
    assert.ok(t.h > LESSER_PX, p.name)
    assert.ok(near.names.some((n) => n.text === p.name), `${p.name}: not lettered`)
    assert.equal(near.cartouche.title, p.name.toUpperCase(), `${p.name}: the cartouche names the view`)
  }
  // palms stand beside a point of interest on an island with room, whatever the tree style (off here)
  const majorca = await createScene(env, { view: { lon: 2.9, lat: 39.6, zoom: 8 } })
  assert.equal(majorca.data.palms.length, POIS.find((p) => p.name === 'Majorca').palms)
  assert.ok(majorca.data.palms.every((s) => s.trees.every((t) => t.shape === 'palm')))
  assert.ok(POI_ZOOM > 0 && !(await at(POIS[0], POI_ZOOM - 1)).lesser.some((l) => l.poi), 'a point of interest below POI_ZOOM')
  // a place flown to names the cartouche, whatever scores highest in the frame, and the title is capitals
  const world = { lon: 10, lat: 25, zoom: 0 }
  assert.notEqual((await at(world, 0)).cartouche.title, 'THE WORLD')
  assert.equal((await at(world, 0, { pinTitle: 'The World' })).cartouche.title, 'THE WORLD')
})

test('a place with a tile gets an unlettered mark: a ruin wherever the sight says so, even beside a city, else the plain tower', async () => {
  const tyre = { name: 'Tyre', lon: 35.2, lat: 33.27, ruin: true }, ostia = { name: 'Ostia', lon: 12.29, lat: 41.76, ruin: true }
  const carthage = { name: 'Carthage', lon: 10.33, lat: 36.84, ruin: true }, aden = { name: 'Aden', lon: 45.03, lat: 12.78 }
  const at = (p, zoom, sights) => createScene(env, { view: { lon: p.lon, lat: p.lat, zoom }, sights }).then((r) => r.scene)
  const scene = await at(tyre, 7, [tyre])
  const mark = scene.lesser.find((l) => l.name === 'Tyre')
  assert.ok(mark?.mark && mark.tower === 'ruin', 'Tyre is a ruin')
  assert.ok(!scene.names.some((n) => n.text === 'Tyre'), 'no lettering beside it')
  assert.ok(!(await at(tyre, 7)).lesser.some((l) => l.name === 'Tyre'), 'no sights, no mark')
  assert.ok(!(await at(tyre, POI_ZOOM - 1, [tyre])).lesser.some((l) => l.mark), 'none below POI_ZOOM')
  for (const zoom of [POI_ZOOM, 6, 8, 10]) assert.equal((await at(carthage, zoom, [carthage])).lesser.find((l) => l.name === 'Carthage')?.tower, 'ruin', `Carthage beside Tunis, z${zoom}`)
  assert.equal((await at(ostia, 7, [ostia])).lesser.find((l) => l.name === 'Ostia')?.tower, 'ruin')
  const barygaza = { name: 'Barygaza', lon: 72.99, lat: 21.71, ruin: 'clear' }
  assert.equal((await at(barygaza, 6, [barygaza])).lesser.find((l) => l.name === 'Barygaza')?.tower, 'ruin', 'no town drawn on the site: a ruin')
  const town = (await at(aden, 7, [aden])).lesser.find((l) => l.name === 'Aden')
  assert.ok(!town || town.tower !== 'ruin', 'a sight that does not say ruin is never one')
  assert.ok(RUIN.layers.every(([, d]) => /^M[-\d. MLHVQZ]*$/.test(d)) && RUIN.w <= 8, 'the ruin is drawn in the towers\' path data')
  assert.ok(!BUILDINGS.some((b) => b.id === 'ruin'), 'not a town to pick at random')
})
