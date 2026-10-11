import { test } from 'node:test'
import assert from 'node:assert/strict'
import { encodeRing, decodeRing, quantize, decodeRingDegrees } from '../lib/codec.js'
import { codecVectors } from '../lib/fixtures.js'

test('every published vector round-trips', () => {
  for (const vector of codecVectors()) {
    assert.deepEqual(decodeRing(vector.encoded), vector.fixed, vector.name)
    assert.equal(encodeRing(vector.fixed), vector.encoded, vector.name)
    assert.deepEqual(decodeRingDegrees(vector.encoded, vector.precision), vector.degrees, vector.name)
  }
})

test('a vector exists whose encoding contains a backslash', () => {
  // The trap a JSON-reading decoder in another language falls into: the
  // format's alphabet includes 0x5c, so the string is escaped on the wire.
  const withBackslash = codecVectors().filter((v) => v.encoded.includes('\\'))
  assert.ok(withBackslash.length > 0)
  const [vector] = withBackslash
  assert.deepEqual(decodeRing(JSON.parse(JSON.stringify(vector.encoded))), vector.fixed)
})

test('the order vector is unambiguous if a decoder swaps the pair', () => {
  const [lon, lat] = codecVectors().find((v) => v.name === 'lon-lat-order').degrees[0]
  assert.ok(Math.abs(lon) > 90, 'longitude must be outside latitude range')
  assert.ok(Math.abs(lat) <= 90)
})

test('encoded characters stay in the printable ASCII range', () => {
  const encoded = encodeRing([
    [-1800000, -900000],
    [1800000, 900000],
  ])
  for (const character of encoded) {
    const code = character.charCodeAt(0)
    assert.ok(code >= 63 && code <= 126, `0x${code.toString(16)} out of range`)
  }
})

test('deltas restart per ring, so a ring decodes on its own', () => {
  const ring = [
    [100, 100],
    [110, 90],
  ]
  assert.deepEqual(decodeRing(encodeRing(ring)), ring)
  assert.equal(encodeRing(ring), encodeRing(ring))
})

test('quantize drops points that round onto their neighbour', () => {
  const dense = [
    [0, 0],
    [0.01, 0.01],
    [0.02, 0.02],
    [1, 1],
  ]
  assert.deepEqual(quantize(dense, 1), [
    [0, 0],
    [10, 10],
  ])
  assert.equal(quantize(dense, 3).length, 4)
})

test('quantize keeps a closed ring closed', () => {
  const ring = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0.01, 0.01],
  ]
  const fixed = quantize(ring, 1, { closed: true })
  assert.deepEqual(fixed[0], fixed[fixed.length - 1])
})
