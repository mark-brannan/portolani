// build-preview.mjs repeats the URLs and sha256 values of ASSETS.md; re-pinning one without the other
// would verify the wrong bytes. Offline: it reads both files and compares.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('every source build-preview.mjs pins appears in ASSETS.md with the same sha256', async () => {
  const script = await read('scripts/build-preview.mjs')
  const assets = await read('ASSETS.md')
  const pinned = [...script.matchAll(/'([0-9a-f]{64})'/g)].map((m) => m[1])
  assert.ok(pinned.length >= 5, 'expected the geojson, font and licence pins')
  for (const sha of pinned) assert.ok(assets.includes(sha), `${sha} missing from ASSETS.md`)
})
