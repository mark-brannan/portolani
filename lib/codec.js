// The wire format's reference codec. Google's encoded-polyline varint over
// deltas between successive fixed-point coordinates, one ring per string.
//
// This is the whole of what a third-party decoder has to reimplement, which
// is why it is nine lines and why the format did not invent its own. See
// docs/portolano-format.md; test/codec.test.mjs pins every claim it makes.

/** Coordinate order is [lon, lat] -- NOT Google's [lat, lng]. See the spec. */

function varint(value) {
  let bits = value < 0 ? ~(value << 1) : value << 1
  let out = ''
  while (bits >= 0x20) {
    out += String.fromCharCode((0x20 | (bits & 0x1f)) + 63)
    bits >>= 5
  }
  return out + String.fromCharCode(bits + 63)
}

/**
 * Encodes fixed-point [x, y] integer pairs. Deltas restart at the origin for
 * every ring, so any ring can be decoded without reading the ones before it.
 */
export function encodeRing(fixed) {
  let previousX = 0
  let previousY = 0
  let out = ''
  for (const [x, y] of fixed) {
    out += varint(x - previousX) + varint(y - previousY)
    previousX = x
    previousY = y
  }
  return out
}

/** Inverse of encodeRing: back to fixed-point integer pairs. */
export function decodeRing(encoded) {
  const out = []
  let index = 0
  let x = 0
  let y = 0
  while (index < encoded.length) {
    let shift = 0
    let bits = 0
    let byte
    do {
      byte = encoded.charCodeAt(index++) - 63
      bits |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    x += bits & 1 ? ~(bits >> 1) : bits >> 1
    shift = 0
    bits = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      bits |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    y += bits & 1 ? ~(bits >> 1) : bits >> 1
    out.push([x, y])
  }
  return out
}

/**
 * Rounds degrees to the format's fixed point and drops points that land on
 * the coordinate their neighbour already occupies. Quantisation is what makes
 * those duplicates, and an encoder that keeps them spends two bytes a piece
 * saying "no movement". A closed ring stays closed: the duplicate that closes
 * it is the one exception.
 */
export function quantize(ring, precision, { closed = false } = {}) {
  const scale = Math.pow(10, precision)
  const out = []
  for (const [lon, lat] of ring) {
    const point = [Math.round(lon * scale), Math.round(lat * scale)]
    const last = out[out.length - 1]
    if (last && last[0] === point[0] && last[1] === point[1]) continue
    out.push(point)
  }
  if (closed && out.length > 1) {
    const first = out[0]
    const last = out[out.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]])
  }
  return out
}

/** Fixed-point pairs back to degrees. */
export function toDegrees(fixed, precision) {
  const scale = Math.pow(10, precision)
  return fixed.map(([x, y]) => [x / scale, y / scale])
}

/** Convenience: encoded string straight to [lon, lat] degrees. */
export function decodeRingDegrees(encoded, precision) {
  return toDegrees(decodeRing(encoded), precision)
}
