// Where the geometry comes from, and the record of exactly which bytes it was.
//
// The named sources pin a Natural Earth release rather than tracking `master`.
// A generator whose default source is a moving branch cannot honour its own
// promise -- re-running it a month later diffs against a dataset nobody chose
// to change. Pass --ref to move deliberately.

import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

export const DEFAULT_REF = 'v5.1.2'

const NATURAL_EARTH = {
  license: 'public domain',
  attribution:
    'Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com',
  terms: 'https://www.naturalearthdata.com/about/terms-of-use/',
}

/** id -> { kind, path } for the Natural Earth layers worth naming. */
export const NATURAL_EARTH_LAYERS = {
  ne_110m_coastline: { kind: 'lines', scale: '110m' },
  ne_50m_coastline: { kind: 'lines', scale: '50m' },
  ne_10m_coastline: { kind: 'lines', scale: '10m' },
  ne_110m_land: { kind: 'polygons', scale: '110m' },
  ne_50m_land: { kind: 'polygons', scale: '50m' },
  ne_10m_land: { kind: 'polygons', scale: '10m' },
  ne_110m_lakes: { kind: 'polygons', scale: '110m' },
  ne_50m_lakes: { kind: 'polygons', scale: '50m' },
  ne_10m_lakes: { kind: 'polygons', scale: '10m' },
  ne_110m_ocean: { kind: 'polygons', scale: '110m' },
  ne_50m_ocean: { kind: 'polygons', scale: '50m' },
  ne_10m_ocean: { kind: 'polygons', scale: '10m' },
}

function naturalEarthUrl(id, ref) {
  return `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${ref}/geojson/${id}.geojson`
}

/** What --source accepts, resolved but not yet fetched. */
export function resolveSource(spec, { ref = DEFAULT_REF } = {}) {
  if (NATURAL_EARTH_LAYERS[spec]) {
    const layer = NATURAL_EARTH_LAYERS[spec]
    return {
      id: spec,
      url: naturalEarthUrl(spec, ref),
      ref,
      defaultKind: layer.kind,
      ...NATURAL_EARTH,
    }
  }
  if (/^https?:\/\//.test(spec)) {
    return { id: spec, url: spec, ref: null, defaultKind: null, license: null }
  }
  return { id: spec, url: null, path: spec, ref: null, defaultKind: null, license: null }
}

/**
 * Fetches or reads the source and records its bytes. The digest is the point:
 * it is what lets a consumer of a generated portolano prove which upstream
 * revision it came out of, without trusting the URL to have stayed put.
 */
export async function loadSource(source, { fetchImpl = globalThis.fetch } = {}) {
  let bytes
  if (source.path) {
    bytes = await readFile(source.path)
  } else {
    const response = await fetchImpl(source.url)
    if (!response.ok) throw new Error(`${source.url} responded ${response.status}`)
    bytes = Buffer.from(await response.arrayBuffer())
  }
  const sha256 = 'sha256:' + createHash('sha256').update(bytes).digest('hex')
  return { geojson: JSON.parse(bytes.toString('utf8')), bytes: bytes.length, sha256 }
}
