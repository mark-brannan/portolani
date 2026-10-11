// The CLI. `portolani` is CLI-first on purpose: the argument for splitting the
// generator out of the plugin that needed it was that anyone can re-run it and
// diff the result, and that only holds if running it takes no install.

import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { buildPortolano, DEFAULTS } from './portolano.js'
import { buildFixtures } from './fixtures.js'
import { emit, FORMATS } from './emit.js'
import {
  DEFAULT_REF,
  NATURAL_EARTH_LAYERS,
  loadSource,
  resolveSource,
} from './sources.js'

const OPTIONS = {
  source: { type: 'string', short: 's' },
  ref: { type: 'string' },
  kind: { type: 'string', short: 'k' },
  tolerance: { type: 'string', short: 't' },
  precision: { type: 'string', short: 'p' },
  'min-extent': { type: 'string', short: 'm' },
  bbox: { type: 'string', short: 'b' },
  format: { type: 'string', short: 'f' },
  out: { type: 'string', short: 'o' },
  fixtures: { type: 'string' },
  pretty: { type: 'boolean' },
  quiet: { type: 'boolean', short: 'q' },
  sources: { type: 'boolean' },
  version: { type: 'boolean', short: 'v' },
  help: { type: 'boolean', short: 'h' },
}

export function usage() {
  return `portolani -- generate a portolano: simplified, encoded coastline geometry

Usage
  npx portolani --source <layer|url|file> [options] > coastline.json

Options
  -s, --source <spec>    Named Natural Earth layer, an https URL, or a local
                         GeoJSON file. Required. --sources lists the names.
      --ref <git-ref>    Natural Earth release for named layers (default ${DEFAULT_REF}).
  -k, --kind <kind>      lines | polygons. Defaults to what the layer holds;
                         polygons keep their holes, lines do not close.
  -t, --tolerance <deg>  Douglas-Peucker tolerance in degrees (default ${DEFAULTS.tolerance}).
                         0 keeps every point.
  -p, --precision <n>    Decimal places kept per coordinate (default ${DEFAULTS.precision}).
  -m, --min-extent <deg> Drop shapes whose bounding box is smaller than this
                         on both sides (default ${DEFAULTS.minExtent}). 0 keeps every island.
  -b, --bbox <w,s,e,n>   Clip to a region. West may exceed east to wrap the
                         antimeridian.
  -f, --format <fmt>     ${FORMATS.join(' | ')} (default json).
  -o, --out <path>       Write here instead of stdout.
      --fixtures <path>  Also write decoder self-check fixtures.
      --pretty           Indent the JSON.
  -q, --quiet            No summary on stderr.
      --sources          List the named layers and exit.
  -v, --version          Print the version and exit.
  -h, --help             This.

Examples
  # The 8KB annotation-grade profile: a coastline finer than any grid cell
  # a space-weather map draws over it.
  npx portolani -s ne_110m_coastline -o coastline-110m.json

  # Fillable land, tenth-degree, for a webapp that shades the sea.
  npx portolani -s ne_110m_land -k polygons -t 0.1 -p 2 -o land-110m.json

  # Just the Salish Sea, every island kept.
  npx portolani -s ne_10m_coastline -b -125.5,47,-122,50 -t 0.005 -p 3 -m 0
`
}

function number(raw, name) {
  const value = Number(raw)
  if (!Number.isFinite(value)) throw new Error(`--${name} must be a number, got ${JSON.stringify(raw)}`)
  return value
}

export function parseBbox(raw) {
  const parts = raw.split(',').map((part) => Number(part.trim()))
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`--bbox must be four numbers "west,south,east,north", got ${JSON.stringify(raw)}`)
  }
  const [west, south, east, north] = parts
  if (south >= north) throw new Error('--bbox south must be less than north')
  if (west === east) throw new Error('--bbox west and east must differ')
  return parts
}

/**
 * `--bbox -125,47,-122,50` is the shape every western-hemisphere extract
 * takes, and parseArgs refuses it: a value starting with a dash looks like the
 * next flag. Joining the pair with `=` before it ever gets there is cheaper
 * than telling every user to quote differently than they would anywhere else.
 */
export function normalizeArgv(argv) {
  const valued = new Set(
    Object.entries(OPTIONS)
      .filter(([, option]) => option.type === 'string')
      .flatMap(([name, option]) => [`--${name}`, option.short ? `-${option.short}` : null])
      .filter(Boolean)
  )
  const out = []
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i]
    const next = argv[i + 1]
    if (valued.has(argument) && next !== undefined && /^-[\d.]/.test(next)) {
      out.push(argument.startsWith('--') ? `${argument}=${next}` : `${argument}${next}`)
      i++
      continue
    }
    out.push(argument)
  }
  return out
}

export async function run(argv, { generator, stdout, stderr, fetchImpl } = {}) {
  const { values } = parseArgs({
    args: normalizeArgv(argv),
    options: OPTIONS,
    allowPositionals: false,
  })

  if (values.help) {
    stdout.write(usage())
    return 0
  }
  if (values.version) {
    stdout.write(`${generator.version}\n`)
    return 0
  }
  if (values.sources) {
    for (const [id, layer] of Object.entries(NATURAL_EARTH_LAYERS)) {
      stdout.write(`${id.padEnd(20)} ${layer.kind}\n`)
    }
    return 0
  }
  if (!values.source) {
    stderr.write('portolani: --source is required (try --help, or --sources)\n')
    return 2
  }

  const source = resolveSource(values.source, { ref: values.ref ?? DEFAULT_REF })
  const kind = values.kind ?? source.defaultKind ?? DEFAULTS.kind
  const options = {
    kind,
    tolerance: values.tolerance === undefined ? DEFAULTS.tolerance : number(values.tolerance, 'tolerance'),
    precision:
      values.precision === undefined ? DEFAULTS.precision : number(values.precision, 'precision'),
    minExtent:
      values['min-extent'] === undefined
        ? DEFAULTS.minExtent
        : number(values['min-extent'], 'min-extent'),
    bbox: values.bbox === undefined ? null : parseBbox(values.bbox),
  }

  const loaded = await loadSource(source, fetchImpl ? { fetchImpl } : {})
  const portolano = buildPortolano({
    geojson: loaded.geojson,
    source: { ...source, sha256: loaded.sha256, bytes: loaded.bytes },
    options,
    generator,
  })

  const text = emit(portolano, { format: values.format ?? 'json', pretty: values.pretty })
  if (values.out) await writeFile(values.out, text)
  else stdout.write(text)

  if (values.fixtures) {
    const fixtures = buildFixtures([{ path: values.out ?? null, portolano }], { generator })
    await writeFile(values.fixtures, JSON.stringify(fixtures, null, 2) + '\n')
  }

  if (!values.quiet) {
    const { shapes, rings, points } = portolano.counts
    stderr.write(
      `${shapes} ${portolano.kind === 'polygons' ? 'polygons' : 'lines'}, ` +
        `${rings} rings, ${points} points, ${Buffer.byteLength(text)} bytes ` +
        `(${portolano.digest.slice(0, 14)}...)\n`
    )
  }
  return 0
}
