import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeArgv, parseBbox, run, usage } from '../lib/cli.js'

const generator = { name: 'portolani', version: '0.0.0-test' }
const ATOLL = fileURLToPath(new URL('./fixtures/atoll.geojson', import.meta.url))

function capture() {
  const out = { stdout: '', stderr: '' }
  return {
    out,
    stdout: { write: (text) => (out.stdout += text) },
    stderr: { write: (text) => (out.stderr += text) },
  }
}

/** Every test here goes through a file source, so the network is never right. */
const noNetwork = () => {
  throw new Error('the CLI reached the network for a local file source')
}

test('--help prints usage and exits clean', async () => {
  const io = capture()
  assert.equal(await run(['--help'], { generator, ...io, fetchImpl: noNetwork }), 0)
  assert.match(io.out.stdout, /npx portolani/)
})

test('--sources lists the named layers with their kinds', async () => {
  const io = capture()
  await run(['--sources'], { generator, ...io, fetchImpl: noNetwork })
  assert.match(io.out.stdout, /ne_110m_coastline\s+lines/)
  assert.match(io.out.stdout, /ne_110m_land\s+polygons/)
})

test('a missing --source is an error with a pointer, not a stack trace', async () => {
  const io = capture()
  assert.equal(await run([], { generator, ...io, fetchImpl: noNetwork }), 2)
  assert.match(io.out.stderr, /--source is required/)
  assert.equal(io.out.stdout, '')
})

test('a local file source writes a portolano to stdout and never fetches', async () => {
  const io = capture()
  assert.equal(await run(['-s', ATOLL, '-q'], { generator, ...io, fetchImpl: noNetwork }), 0)
  const portolano = JSON.parse(io.out.stdout)
  assert.equal(portolano.format, 'portolano/1')
  assert.equal(portolano.kind, 'lines')
  assert.ok(portolano.geometry.length > 0)
})

test('the summary on stderr stays out of the document on stdout', async () => {
  const io = capture()
  await run(['-s', ATOLL], { generator, ...io, fetchImpl: noNetwork })
  assert.doesNotThrow(() => JSON.parse(io.out.stdout))
  assert.match(io.out.stderr, /lines, \d+ rings, \d+ points/)
})

test('--out and --fixtures write files a decoder can check itself against', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portolani-'))
  try {
    const io = capture()
    await run(
      ['-s', ATOLL, '-k', 'polygons', '-o', join(directory, 'p.json'), '--fixtures', join(directory, 'f.json'), '-q'],
      { generator, ...io, fetchImpl: noNetwork }
    )
    const portolano = JSON.parse(await readFile(join(directory, 'p.json'), 'utf8'))
    const fixtures = JSON.parse(await readFile(join(directory, 'f.json'), 'utf8'))
    assert.equal(fixtures.format, 'portolano-fixtures/1')
    assert.equal(fixtures.documents[0].digest, portolano.digest)
    assert.deepEqual(fixtures.documents[0].counts, portolano.counts)
    assert.equal(fixtures.documents[0].firstPoints.length, 3)
    assert.ok(fixtures.vectors.length >= 5)
    assert.equal(io.out.stdout, '', '--out means the document does not also go to stdout')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('a negative --bbox survives argument parsing in both forms', () => {
  assert.deepEqual(normalizeArgv(['-b', '-125,47,-122,50']), ['-b-125,47,-122,50'])
  assert.deepEqual(normalizeArgv(['--bbox', '-125,47,-122,50']), ['--bbox=-125,47,-122,50'])
  assert.deepEqual(normalizeArgv(['-s', '-oddly-named-file']), ['-s', '-oddly-named-file'])
})

test('a malformed --bbox says what it wanted', () => {
  assert.throws(() => parseBbox('1,2,3'), /four numbers/)
  assert.throws(() => parseBbox('1,9,3,2'), /south must be less than north/)
})

test('usage documents every option the parser accepts', () => {
  const text = usage()
  for (const flag of ['--source', '--ref', '--kind', '--tolerance', '--precision', '--min-extent', '--bbox', '--format', '--out', '--fixtures', '--pretty', '--quiet', '--sources', '--version', '--help']) {
    assert.match(text, new RegExp(flag.replace(/-/g, '\\-')), flag)
  }
})
