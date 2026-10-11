// The demo is a normal customer of the packages it is demonstrating:
// portolani's own simplify and codec run in the browser to rebuild the
// document at every slider position, and coast-wright decodes and draws
// exactly what those rebuilt bytes contain. scripts/build-demo.mjs vendors
// the unmodified published files under ./vendor/.
import { simplify } from './vendor/portolani/simplify.js'
import { quantize, encodeRing } from './vendor/portolani/codec.js'
import { rings, limn } from './vendor/coast-wright/index.js'

// Slider position s in [0, 1] maps to tolerance 160 -> 0.002 degrees on a log
// scale, with the last notch snapping to 0 (keep every point). 160 is the
// floor RDP itself imposes: it keeps only each shape's two endpoints past
// that, so every tolerance beyond it renders identically (~26 points, mostly
// straight lines between continent corners) -- there's no lower point count
// to show. Below the precision grid RDP is a no-op anyway, so nothing is
// hidden by the snap.
const TOL_MAX = 160
const TOL_MIN = 0.002
const K = Math.log(TOL_MAX / TOL_MIN)
const toleranceFor = (s) => (s >= 1 ? 0 : TOL_MAX * Math.exp(-s * K))

// Precision one step finer than tolerance -- the pairing the README
// recommends and the shipped builds use. 110m source never earns more
// than three decimals. Floored at 1: a 0 here quantises to whole degrees,
// and the low end's sawtooth triangles are that grid, not a bug worth
// keeping -- flooring loses no simplification, only the artefact.
const precisionFor = (t) => (t === 0 || t < 0.045 ? 3 : t < 0.18 ? 2 : 1)

// The build the README ships: npx portolani --source ne_110m_coastline.
const SHIP = { tolerance: 0.25, precision: 1 }
const SHIP_S = Math.log(TOL_MAX / SHIP.tolerance) / K
const SNAP = 0.012

// 1000 steps end-to-end made the keyboard useless -- ~700 arrow presses to
// cross the range. 200 is still finer than the eye resolves on a 672 px
// track.
const SLIDER_MAX = 200

// Never computed, only counted: a digest is "sha256:" plus 64 hex characters
// whatever the geometry, so a placeholder of that length makes the byte
// counter exact without pulling in async hashing.
const DIGEST_SIZE_STANDIN = 'sha256:' + '0'.repeat(64)

let full
try {
  const response = await fetch('./coast-full.json')
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  full = await response.json()
} catch {
  document.getElementById('map').replaceWith(
    Object.assign(document.createElement('p'), {
      className: 'foot',
      textContent: "Couldn't load the coastline. Reload to try again.",
    })
  )
  throw new Error('coast-full.json failed to load')
}
const source = rings(full)

// Rebuilds the document portolani would emit at these knobs, from the
// full-detail rings. Mirrors buildLines in lib/portolano.js: lines are
// simplified open, and a ring quantised down to fewer than two points is
// dropped, which is how the low end loses its smallest islands.
function build(tolerance, precision) {
  const shapes = []
  for (const chain of source) {
    const fixed = quantize(simplify(chain, tolerance), precision)
    if (fixed.length >= 2) shapes.push(fixed)
  }
  return {
    format: full.format,
    kind: full.kind,
    encoding: { ...full.encoding, precision },
    bounds: full.bounds,
    counts: {
      shapes: shapes.length,
      rings: shapes.length,
      points: shapes.reduce((total, ring) => total + ring.length, 0),
    },
    digest: DIGEST_SIZE_STANDIN,
    provenance: {
      ...full.provenance,
      options: { ...full.provenance.options, tolerance, precision },
    },
    geometry: shapes.map(encodeRing),
  }
}

// What the same rings cost as an ordinary GeoJSON file, measured by writing
// one: same coordinates, same precision, no estimate anywhere. A single
// MultiLineString Feature, not one Feature per ring -- the fairest baseline
// is the leanest shape a human would actually reach for, and per-ring
// FeatureCollections pay 128 repeats of "type":"Feature","properties":{}
// that no serious competing encoding would carry.
function geojsonBytes(doc) {
  const scale = Math.pow(10, doc.encoding.precision)
  const coordinates = rings(doc).map((ring) =>
    ring.map(([lon, lat]) => [Math.round(lon * scale) / scale, Math.round(lat * scale) / scale])
  )
  return (
    JSON.stringify({
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates },
    }).length + 1
  )
}

const canvas = document.getElementById('map')
const ctx = canvas.getContext('2d')

function draw(doc) {
  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth * ratio
  const height = width / 2
  if (canvas.width !== width) {
    canvas.width = width
    canvas.height = height
  }
  ctx.clearRect(0, 0, width, height)
  const color = getComputedStyle(document.documentElement).getPropertyValue('--line')
  limn(
    ctx,
    rings(doc),
    (lon) => ((lon + 180) / 360) * width,
    (lat) => ((90 - lat) / 180) * height,
    { color, alpha: 1, width: Math.max(1, ratio) }
  )
}

const slider = document.getElementById('detail')
const shipMark = document.getElementById('ship')
const out = {
  points: document.getElementById('points'),
  bytes: document.getElementById('bytes'),
  geojson: document.getElementById('geojson'),
}

const kb = (bytes) =>
  (bytes >= 99950 ? Math.round(bytes / 1000) : (bytes / 1000).toFixed(1)) + ' KB'

let current = null

// geojsonBytes() serialises a whole second document purely to count it --
// about half of a frame's cost during a drag. The drawn map and the
// portolano counter still update every frame; this one trails behind by a
// beat so dragging stays smooth.
const GEOJSON_DEBOUNCE_MS = 150
let geojsonTimer = null

function update() {
  let s = Number(slider.value) / SLIDER_MAX
  if (Math.abs(s - SHIP_S) < SNAP) {
    s = SHIP_S
    slider.value = String(Math.round(SHIP_S * SLIDER_MAX))
  }
  const tolerance = s === SHIP_S ? SHIP.tolerance : toleranceFor(s)
  const precision = s === SHIP_S ? SHIP.precision : precisionFor(tolerance)
  current = build(tolerance, precision)
  out.points.value = current.counts.points.toLocaleString('en-US')
  const bytes = kb(JSON.stringify(current).length + 1)
  out.bytes.value = bytes
  slider.setAttribute(
    'aria-valuetext',
    `${current.counts.points.toLocaleString('en-US')} points, ${bytes} as a portolano`
  )
  draw(current)

  clearTimeout(geojsonTimer)
  const snapshot = current
  geojsonTimer = setTimeout(() => {
    if (snapshot === current) out.geojson.value = kb(geojsonBytes(snapshot))
  }, GEOJSON_DEBOUNCE_MS)
}

let queued = false
slider.addEventListener('input', () => {
  if (queued) return
  queued = true
  requestAnimationFrame(() => {
    queued = false
    update()
  })
})

shipMark.style.setProperty('--p', SHIP_S)
shipMark.addEventListener('click', () => {
  slider.value = String(Math.round(SHIP_S * SLIDER_MAX))
  update()
})

window.addEventListener('resize', () => current && draw(current))
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => current && draw(current))

slider.value = String(Math.round(SHIP_S * SLIDER_MAX))
update()
