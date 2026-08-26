import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { run } from '../lib/cli.js'

// portolani has no dependencies and its tests must pass with no network, so
// that `npm ci && npm test` in an offline sandbox is a real check rather than
// a check of the sandbox's DNS. The generator itself of course fetches -- the
// guarantee is only that nothing but an explicit remote --source does.
test('nothing reaches the network unless --source is a URL', async () => {
  const original = globalThis.fetch
  globalThis.fetch = () => {
    throw new Error('unexpected network access')
  }
  try {
    const io = { write: () => {} }
    const code = await run(
      ['-s', fileURLToPath(new URL('./fixtures/atoll.geojson', import.meta.url)), '-q'],
      { generator: { name: 'portolani', version: '0.0.0-test' }, stdout: io, stderr: io }
    )
    assert.equal(code, 0)
  } finally {
    globalThis.fetch = original
  }
})
