// Programmatic entry point. The CLI is the front door -- this is here because
// a package generating several profiles wants a loop, not eight shell lines.
export { buildPortolano, digestGeometry, DEFAULTS, FORMAT } from './portolano.js'
export { buildFixtures, codecVectors } from './fixtures.js'
export { emit, FORMATS } from './emit.js'
export { loadSource, resolveSource, NATURAL_EARTH_LAYERS, DEFAULT_REF } from './sources.js'
export { encodeRing, decodeRing, decodeRingDegrees, quantize, toDegrees } from './codec.js'
export { simplify } from './simplify.js'
export { run, usage } from './cli.js'
