// What the webapp ships of portolani's packs and what it asks the scene for: a chart's roses, its
// cartouche and its scale bar, and the mountains, from the vivid pack, and nothing of the others. The
// build (build.mjs) trims each pack.json with packOf and copies only the files it keeps; the test reads
// the same trim.
export const CHART_KINDS = ['rose', 'cartouche', 'mountain'];
const KEPT = { vivid: (s) => ['rose', 'cartouche', 'scale', 'mountain'].includes(s.kind) };
export const packOf = (name, manifest) => ({ ...manifest, sprites: manifest.sprites.filter((s) => KEPT[name]?.(s) ?? false) });

// The world geo the webapp does ship: the page's mountain ranges and landmark peaks, which the build
// (signalk/geo.mjs) slims from the same pinned coastlines files the page's build does. Every other
// geo/ file reads as empty: the land, coast and depth are the cells'.
export const CHART_GEO = ['geo/ranges-10m.json', 'geo/peaks-10m.json'];

// The scene's options for a chart: the land in one colour, no names (the world's names would spill
// over an ENC's water), the sea's depth drawn, and the mountains along the ranges in the M.E. 1937 pen
// style, with the landmark peaks; `mountains` and `peaks` are the drawer's chips
export const MOUNTAINS = ['me1937'];
export const CHART_OPTIONS = { kinds: CHART_KINDS, names: false, land: 'off', islands: false, depth: true, relief: MOUNTAINS, peaks: true, autoTitle: false, title: 'PORTOLANI' };
