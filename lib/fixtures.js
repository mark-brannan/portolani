// Self-check vectors for a decoder written in another language.
//
// The digest alone is not enough to prove a decoder works. A decoder that
// reads [lat, lon] instead of [lon, lat], or divides by the wrong power of
// ten, reproduces the digest exactly -- the digest is over the *encoded*
// strings -- and then draws a world turned on its side. So the fixtures carry
// decoded coordinates, and the first one they carry is an asymmetric point
// where swapping the pair is visible.

import { encodeRing, decodeRing } from './codec.js'

/**
 * Cases chosen for what they break, not for coverage: the coordinate order,
 * the sign of a negative delta, a delta large enough to need several
 * continuation bytes, and a value whose encoded character is a backslash --
 * which every JSON reader must unescape and a naive C parser will not.
 */
function vector(name, note, fixed, precision) {
  const encoded = encodeRing(fixed)
  const scale = Math.pow(10, precision)
  return {
    name,
    note,
    precision,
    encoded,
    fixed,
    degrees: fixed.map(([x, y]) => [x / scale, y / scale]),
  }
}

export function codecVectors() {
  return [
    vector(
      'lon-lat-order',
      'Decoded as [lat, lon] this is off the map: latitude 122 does not exist.',
      [[-1222, 375]],
      1
    ),
    vector('origin', 'A single point at 0,0 encodes to two zero varints.', [[0, 0]], 1),
    vector(
      'negative-deltas',
      'Successive points moving south-west; every delta is negative.',
      [
        [100, 100],
        [90, 90],
        [80, 80],
      ],
      1
    ),
    vector(
      'repeated-point',
      'A zero delta is legal and encodes to "?"; decoders must not skip it.',
      [
        [50, 50],
        [50, 50],
      ],
      1
    ),
    vector(
      'multi-byte-varint',
      'A jump large enough to need three continuation bytes per axis.',
      [
        [0, 0],
        [1800, -900],
      ],
      1
    ),
    vector(
      'backslash',
      'A delta of -15 encodes to a literal backslash. In JSON it is escaped as \\\\.',
      [
        [0, 0],
        [-15, 0],
      ],
      1
    ),
    vector(
      'closed-ring',
      'A closed ring repeats its first point last; the closing delta is not zero.',
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 0],
      ],
      1
    ),
    vector(
      'finer-precision',
      'The same shape at precision 3; the divisor comes from encoding.precision.',
      [
        [-122400, 37800],
        [-122390, 37810],
      ],
      3
    ),
  ]
}

/** The first few decoded coordinates of a document, for an eyeball check. */
function sample(portolano, count = 3) {
  const first = portolano.kind === 'polygons' ? portolano.geometry[0]?.[0] : portolano.geometry[0]
  if (!first) return []
  const scale = Math.pow(10, portolano.encoding.precision)
  return decodeRing(first)
    .slice(0, count)
    .map(([x, y]) => [x / scale, y / scale])
}

/**
 * A fixtures document. `documents` describes real portolani so a decoder can
 * check aggregates -- point count, bounds, digest -- after decoding all of
 * them, which catches the failures a handful of short vectors will not.
 */
export function buildFixtures(entries, { generator }) {
  return {
    format: 'portolano-fixtures/1',
    generator: { name: generator.name, version: generator.version },
    vectors: codecVectors(),
    documents: entries.map(({ path, portolano }) => ({
      path,
      kind: portolano.kind,
      precision: portolano.encoding.precision,
      digest: portolano.digest,
      counts: portolano.counts,
      bounds: portolano.bounds,
      firstPoints: sample(portolano),
    })),
  }
}
