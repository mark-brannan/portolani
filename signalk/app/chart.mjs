// What the webapp ships of portolani's packs and what it asks the scene for: a chart's roses, its
// cartouche and its scale bar, from the vivid pack, and nothing of the others. The build (build.mjs)
// trims each pack.json with packOf and copies only the files it keeps; the test reads the same trim.
export const CHART_KINDS = ['rose', 'cartouche'];
const KEPT = { vivid: (s) => ['rose', 'cartouche', 'scale'].includes(s.kind) };
export const packOf = (name, manifest) => ({ ...manifest, sprites: manifest.sprites.filter((s) => KEPT[name]?.(s) ?? false) });

// The scene's options for a chart: the land in one colour, no names (the world's names would spill
// over an ENC's water), and the sea's depth drawn
export const CHART_OPTIONS = { kinds: CHART_KINDS, names: false, land: 'off', islands: false, depth: true, autoTitle: false, relief: ['tolkien'], title: 'PORTOLANI' };
