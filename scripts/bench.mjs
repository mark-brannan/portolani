#!/usr/bin/env node
// Measures what the README claims: the same Natural Earth 110m layer as raw
// GeoJSON, as TopoJSON, and as a portolano -- bytes, gzipped bytes, and the
// time from the text in hand to a finished set of canvas path calls.
//
// Run it with `npm run bench`. It prints Markdown tables; the README's are
// pasted from a run of this. It needs the network once, for the pinned
// Natural Earth source, and `npm ci` for the TopoJSON reference tools. It is
// a script, not a test: the suite stays offline and takes no timing.
//
// What the numbers are and are not:
//   - Bytes and gzipped bytes are exact and deterministic for the pinned
//     inputs. gzip is zlib level 9.
//   - Time is the median of RUNS warm runs in this Node process, on a stub 2D
//     context that counts calls and rasterises nothing. There is no browser
//     here, so "first canvas draw" is the last JavaScript step before one:
//     parse, decode to [lon, lat], project, and issue the path calls.
//     Machine-dependent and noisy by half or more; compare rows with each
//     other, not with other machines or other runs.
//   - Every row is drawn by the same projection and path code. Only the
//     decode step differs, which is the thing being measured.
//
// The TopoJSON reference tools are devDependencies, pinned exactly: world-atlas
// (Mike Bostock's published 110m file), topojson-server (geo2topo, to convert
// the coastline, which world-atlas does not publish) and topojson-client (the
// decoder every TopoJSON consumer ships). None is a runtime dependency of the
// package; zero runtime dependencies is policy.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { gzipSync } from 'node:zlib'
import { feature } from 'topojson-client'
import { topology } from 'topojson-server'
import { DEFAULTS, buildPortolano, decodeRingDegrees, emit, resolveSource } from '../lib/index.js'

const require = createRequire(import.meta.url)

const WARMUP = 20
const RUNS = 200
const WIDTH = 1024
const HEIGHT = 512
// world-atlas quantises its 110m files to 1e5 steps per axis; converting the
// coastline at the same setting keeps the two TopoJSON rows comparable.
const QUANTIZATION = 1e5

const layers = [
  { id: 'ne_110m_land', title: 'Land, `ne_110m_land` (polygons)', kind: 'polygons' },
  { id: 'ne_110m_coastline', title: 'Coastline, `ne_110m_coastline` (lines)', kind: 'lines' },
]

// --- the one drawing routine every row shares ------------------------------

/** A 2D context that does the arithmetic a real one's caller does, and no more. */
function stubContext() {
  const ctx = {
    points: 0,
    paths: 0,
    checksum: 0,
    beginPath: () => void ctx.paths++,
    moveTo: (x, y) => void (ctx.points++, (ctx.checksum += x + y)),
    lineTo: (x, y) => void (ctx.points++, (ctx.checksum += x + y)),
    closePath() {},
    stroke() {},
    fill() {},
  }
  return ctx
}

function drawRing(ctx, ring) {
  for (let i = 0; i < ring.length; i++) {
    const x = ((ring[i][0] + 180) * WIDTH) / 360
    const y = ((90 - ring[i][1]) * HEIGHT) / 180
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
}

function drawLine(ctx, ring) {
  ctx.beginPath()
  drawRing(ctx, ring)
  ctx.stroke()
}

function drawPolygon(ctx, rings) {
  ctx.beginPath()
  for (const ring of rings) {
    drawRing(ctx, ring)
    ctx.closePath()
  }
  ctx.fill()
}

function drawGeometry(ctx, geometry) {
  switch (geometry.type) {
    case 'LineString':
      return drawLine(ctx, geometry.coordinates)
    case 'MultiLineString':
      return geometry.coordinates.forEach((line) => drawLine(ctx, line))
    case 'Polygon':
      return drawPolygon(ctx, geometry.coordinates)
    case 'MultiPolygon':
      return geometry.coordinates.forEach((polygon) => drawPolygon(ctx, polygon))
    default:
      throw new Error(`bench cannot draw ${geometry.type}`)
  }
}

function drawFeatures(ctx, collection) {
  const features = collection.type === 'FeatureCollection' ? collection.features : [collection]
  for (const f of features) drawGeometry(ctx, f.geometry)
}

// --- one parse-to-drawable function per format -----------------------------

const parseGeoJSON = (text) => {
  const ctx = stubContext()
  drawFeatures(ctx, JSON.parse(text))
  return ctx
}

const parseTopoJSON = (objectName) => (text) => {
  const ctx = stubContext()
  const topo = JSON.parse(text)
  drawFeatures(ctx, feature(topo, topo.objects[objectName]))
  return ctx
}

const parsePortolano = (text) => {
  const ctx = stubContext()
  const doc = JSON.parse(text)
  const { precision } = doc.encoding
  if (doc.kind === 'lines') {
    for (const ring of doc.geometry) drawLine(ctx, decodeRingDegrees(ring, precision))
  } else {
    for (const polygon of doc.geometry) {
      drawPolygon(
        ctx,
        polygon.map((ring) => decodeRingDegrees(ring, precision))
      )
    }
  }
  return ctx
}

// --- measuring --------------------------------------------------------------

function median(parse, text) {
  let ctx
  for (let i = 0; i < WARMUP; i++) ctx = parse(text)
  const samples = []
  for (let i = 0; i < RUNS; i++) {
    const start = process.hrtime.bigint()
    ctx = parse(text)
    samples.push(Number(process.hrtime.bigint() - start) / 1e6)
  }
  samples.sort((a, b) => a - b)
  return { ms: samples[RUNS >> 1], points: ctx.points }
}

function measure(label, text, parse) {
  const bytes = Buffer.byteLength(text)
  const { ms, points } = median(parse, text)
  return { label, bytes, gzipped: gzipSync(text, { level: 9 }).length, points, ms }
}

const group = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

function table(rows) {
  const lines = [
    '| Format | Bytes | Gzipped | Points drawn | Parse + draw |',
    '| --- | ---: | ---: | ---: | ---: |',
  ]
  for (const r of rows) {
    // One decimal: run-to-run noise on a shared machine is half or more.
    const time = r.ms < 0.05 ? '<0.1' : r.ms.toFixed(1)
    lines.push(`| ${r.label} | ${group(r.bytes)} | ${group(r.gzipped)} | ${group(r.points)} | ${time} ms |`)
  }
  return lines.join('\n')
}

// --- the run ----------------------------------------------------------------

async function fetchSource(id) {
  const source = resolveSource(id)
  const response = await fetch(source.url)
  if (!response.ok) throw new Error(`${source.url} responded ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const sha256 = 'sha256:' + createHash('sha256').update(buffer).digest('hex')
  return { source, buffer, sha256 }
}

function portolanoText({ source, buffer, sha256 }, kind, options) {
  const portolano = buildPortolano({
    geojson: JSON.parse(buffer.toString('utf8')),
    source: { ...source, sha256, bytes: buffer.length },
    options: { ...DEFAULTS, kind, ...options },
    generator: { name: 'portolani', version: 'bench' },
  })
  return emit(portolano)
}

const out = []
const sources = []
for (const layer of layers) {
  const fetched = await fetchSource(layer.id)
  sources.push(`${layer.id} ${fetched.sha256}`)
  const published = fetched.buffer.toString('utf8')
  const geometries = JSON.parse(published).features.map((f) => f.geometry)
  const bare = JSON.stringify({
    type: 'FeatureCollection',
    features: geometries.map((geometry) => ({ type: 'Feature', properties: {}, geometry })),
  })

  let topoLabel, topoText, topoObject
  if (layer.kind === 'polygons') {
    topoLabel = 'TopoJSON, world-atlas `land-110m.json` as published'
    topoText = await readFile(require.resolve('world-atlas/land-110m.json'), 'utf8')
    topoObject = 'land'
  } else {
    topoLabel = 'TopoJSON, geo2topo of the same geometry'
    topoText = JSON.stringify(
      topology({ coastline: { type: 'GeometryCollection', geometries } }, QUANTIZATION)
    )
    topoObject = 'coastline'
  }

  const rows = [
    measure('GeoJSON, Natural Earth as published', published, parseGeoJSON),
    measure('GeoJSON, geometry only', bare, parseGeoJSON),
    measure(topoLabel, topoText, parseTopoJSON(topoObject)),
    measure(
      'portolano, defaults (`-t 0.25 -p 1`)',
      portolanoText(fetched, layer.kind, {}),
      parsePortolano
    ),
    measure(
      'portolano, nothing simplified (`-t 0 -p 3 -m 0`)',
      portolanoText(fetched, layer.kind, { tolerance: 0, precision: 3, minExtent: 0 }),
      parsePortolano
    ),
  ]
  out.push(`### ${layer.title}\n\n${table(rows)}`)
}

// The decoder is the other half of what a page ships.
const topojsonClient = await readFile(require.resolve('topojson-client/dist/topojson-client.min.js'))
const codec = await readFile(new URL('../lib/codec.js', import.meta.url))

console.log(`Natural Earth v5.1.2, 110m. Node ${process.version}, ${process.platform}/${process.arch}.`)
console.log(`Parse + draw: median of ${RUNS} warm runs after ${WARMUP}, stub 2D context at ${WIDTH}x${HEIGHT}.`)
console.log(`Sources: ${sources.join('; ')}\n`)
console.log(out.join('\n\n'))
console.log(`
### Decoders a page also has to ship

| Decoder | Bytes | Gzipped |
| --- | ---: | ---: |
| none (GeoJSON is \`JSON.parse\`) | 0 | 0 |
| \`topojson-client\` 3.1.0, minified | ${group(topojsonClient.length)} | ${group(gzipSync(topojsonClient, { level: 9 }).length)} |
| \`lib/codec.js\`, unminified, encoder and comments included | ${group(codec.length)} | ${group(gzipSync(codec, { level: 9 }).length)} |`)
