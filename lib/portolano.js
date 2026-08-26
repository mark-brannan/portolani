// Assembles one portolano: the document defined by docs/portolano-format.md.

import { createHash } from 'node:crypto'
import { encodeRing, quantize } from './codec.js'
import { simplify } from './simplify.js'
import {
  bounds,
  boxParts,
  clipLine,
  clipRing,
  closedRing,
  extent,
  lineShapes,
  polygonShapes,
  unionBounds,
} from './geometry.js'

export const FORMAT = 'portolano/1'

export const DEFAULTS = {
  kind: 'lines',
  tolerance: 0.25,
  precision: 1,
  minExtent: 1,
  bbox: null,
}

/**
 * sha256 over the compact JSON of the `geometry` member alone. Over geometry
 * rather than the whole document so that adding a field to the metadata does
 * not invalidate every stamp downstream: what a consumer wants to assert is
 * "these are the same shapes", and the knobs that produced them are recorded
 * separately in `provenance`.
 */
export function digestGeometry(geometry) {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(geometry)).digest('hex')
}

function prepareChain(chain, options, closed) {
  const simplified = simplify(chain, options.tolerance, { closed })
  const fixed = quantize(simplified, options.precision, { closed })
  const minimum = closed ? 4 : 2
  return fixed.length >= minimum ? fixed : null
}

function buildLines(geojson, options) {
  const shapes = []
  for (const chain of lineShapes(geojson)) {
    const pieces = options.bbox
      ? boxParts(options.bbox).flatMap((box) => clipLine(chain, box))
      : [chain]
    for (const piece of pieces) {
      if (extent(piece) < options.minExtent) continue
      const fixed = prepareChain(piece, options, false)
      if (fixed) shapes.push(fixed)
    }
  }
  return shapes
}

function buildPolygons(geojson, options) {
  const shapes = []
  for (const rings of polygonShapes(geojson)) {
    const boxes = options.bbox ? boxParts(options.bbox) : [null]
    for (const box of boxes) {
      const outer = box ? clipRing(rings[0], box) : rings[0]
      if (!outer) continue
      if (extent(outer) < options.minExtent) continue
      const kept = []
      const outerFixed = prepareChain(outer, options, true)
      if (!outerFixed) continue
      kept.push(outerFixed)
      for (const hole of rings.slice(1)) {
        const clipped = box ? clipRing(hole, box) : hole
        if (!clipped) continue
        if (extent(clipped) < options.minExtent) continue
        const holeFixed = prepareChain(clipped, options, true)
        if (holeFixed) kept.push(holeFixed)
      }
      shapes.push(kept)
    }
  }
  return shapes
}

/** Fixed-point shapes -> the format's nested arrays of encoded strings. */
function encodeShapes(shapes, kind) {
  return kind === 'polygons'
    ? shapes.map((rings) => rings.map(encodeRing))
    : shapes.map(encodeRing)
}

function countPoints(shapes, kind) {
  if (kind === 'polygons') {
    let rings = 0
    let points = 0
    for (const shape of shapes) {
      rings += shape.length
      for (const ring of shape) points += ring.length
    }
    return { shapes: shapes.length, rings, points }
  }
  return {
    shapes: shapes.length,
    rings: shapes.length,
    points: shapes.reduce((total, ring) => total + ring.length, 0),
  }
}

function degreeBounds(shapes, kind, precision) {
  const scale = Math.pow(10, precision)
  const rings = kind === 'polygons' ? shapes.flat() : shapes
  const boxes = rings.map((ring) => bounds(ring))
  const union = unionBounds(boxes)
  return union ? union.map((value) => value / scale) : null
}

/**
 * Builds a portolano from already-loaded GeoJSON. Pure: no network, no clock.
 * There is deliberately no timestamp anywhere in the output -- a portolano is
 * meant to be byte-identical when regenerated from the same source with the
 * same knobs, and a generation date is the one field guaranteed to break that.
 * Time is recorded by the commit that added the file, where it belongs.
 */
export function buildPortolano({ geojson, source, options, generator }) {
  const settings = { ...DEFAULTS, ...options }
  const kind = settings.kind
  if (kind !== 'lines' && kind !== 'polygons') {
    throw new Error(`kind must be "lines" or "polygons", got ${JSON.stringify(kind)}`)
  }

  const shapes = kind === 'polygons' ? buildPolygons(geojson, settings) : buildLines(geojson, settings)
  const geometry = encodeShapes(shapes, kind)

  return {
    format: FORMAT,
    kind,
    encoding: { type: 'polyline', precision: settings.precision, order: 'lon,lat' },
    bounds: degreeBounds(shapes, kind, settings.precision),
    counts: countPoints(shapes, kind),
    digest: digestGeometry(geometry),
    provenance: {
      generator: { name: generator.name, version: generator.version },
      source: {
        id: source.id,
        url: source.url,
        ref: source.ref ?? null,
        sha256: source.sha256 ?? null,
        bytes: source.bytes ?? null,
        license: source.license ?? null,
        attribution: source.attribution ?? null,
      },
      options: {
        kind,
        tolerance: settings.tolerance,
        precision: settings.precision,
        minExtent: settings.minExtent,
        bbox: settings.bbox,
      },
    },
    geometry,
  }
}

export { closedRing }
