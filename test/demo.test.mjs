// The demo page rebuilds portolani documents in the browser from the
// library's own files, vendored verbatim by scripts/build-demo.mjs. That
// only works while those files stay dependency-free ES modules, and while
// the page imports nothing the build does not vendor. Both properties are
// invisible to the node test run -- a stray `node:` import would pass every
// other test and break only on GitHub Pages -- so they are pinned here.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('the modules the demo vendors import nothing at all', async () => {
  for (const file of ['lib/simplify.js', 'lib/codec.js']) {
    assert.doesNotMatch(await read(file), /^\s*import\b/m, `${file} must stay self-contained`)
  }
})

test('the demo page imports only vendored files', async () => {
  const imports = [...(await read('demo/demo.js')).matchAll(/from '([^']+)'/g)].map((m) => m[1])
  assert.ok(imports.length >= 3)
  for (const specifier of imports) {
    assert.match(specifier, /^\.\/vendor\//, `${specifier} is not served by the built site`)
  }
})

test('the browser-safe entry points are exported subpaths', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.exports['./codec'], './lib/codec.js')
  assert.equal(pkg.exports['./simplify'], './lib/simplify.js')
})
