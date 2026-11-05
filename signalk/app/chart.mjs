// What the webapp ships of portolani's packs and what it asks the scene for. The build (build.mjs) trims
// each pack.json with packOf and copies only the files it keeps; the test reads the same trim. A chart
// draws the drawn (vivid) roses, cartouche, scale bar and towns, the towns and buildings drawn in code, the drawn
// heraldic monsters and the scanned Paré ones, and no mountain sprite: its mountains are the inked ranges and its
// peaks the lone ink peak.
export const ROSES = ['catalan', 'aguiar', 'martines', 'oliva', 'brouscon', 'fleurs', 'dieppe'];
// a town style and the pack it is drawn from: `plain` is the scene's shapes drawn in code, the towers and the Carta Marina's buildings
export const TOWNS = { aguiar: 'vivid', martines: 'vivid', 'carta-marina': 'plain', tower: 'plain' };
export const MONSTERS = { pare: 'scanned', heraldic: 'vivid' }; // a monster family and the pack it is drawn from
const KEPT = {
  vivid: (s) => ['rose', 'cartouche', 'scale', 'town'].includes(s.kind) || (s.kind === 'monster' && s.style === 'heraldic'),
  scanned: (s) => s.kind === 'monster' && s.style === 'pare',
};
export const packOf = (name, manifest) => ({ ...manifest, sprites: manifest.sprites.filter((s) => KEPT[name]?.(s) ?? false) });

// A rose style is the drawn roses named for it, each with its small sibling, by id: the pack files the drawn
// Catalan roses under the Aguiar style, and here they are their own
const roseOf = (style) => (s) => s.pack === 'vivid' && s.kind === 'rose' && (s.id === `rose-${style}` || s.id.startsWith(`rose-${style}-`));
// The sprite keys (scene.mjs selectSprites) the drawer's settings choose, from the scene's sprite list (listSprites):
// `rose` a style of ROSES or 'off', `towns` styles of TOWNS, `monster` a family of MONSTERS or 'off', `cartouche` on or off
export function spritesFor({ rose, towns, monster, cartouche }, list) {
  const want = [
    (s) => ROSES.includes(rose) && roseOf(rose)(s),
    (s) => cartouche && s.pack === 'vivid' && s.kind === 'cartouche',
    (s) => s.kind === 'town' && towns.includes(s.style) && TOWNS[s.style] === s.pack,
    (s) => s.kind === 'monster' && MONSTERS[monster] === s.pack && s.style === monster,
  ];
  return list.filter((s) => want.some((w) => w(s))).map((s) => s.key);
}
// The sprite a chip shows for a choice: the first of its kind and style
export const chipSprite = (list, kind, style, pack = 'vivid') => list.find((s) => s.pack === pack && s.kind === kind && (kind === 'rose' ? roseOf(style)(s) : s.style === style));

// The world geo the webapp does ship: Natural Earth's 50m land and coast, byte for byte, the base the
// cells are drawn over and all a view without a cell draws (app/enc-provider.js); and the page's
// mountain ranges and landmark peaks, which the build (signalk/geo.mjs) slims from the same pinned
// coastlines files the page's build does. Every other geo/ file reads as empty: the depth, towns and
// water names are the cells'.
export const CHART_GEO = ['geo/ne-land-50m.geojson', 'geo/ne-coastline-50m.geojson', 'geo/ranges-10m.json', 'geo/peaks-10m.json'];

// The drawer's settings before any are saved: the drawer's layers on, the cartouche off, the drawn Catalan
// roses, no towns, the heraldic monsters, north up
export const DEFAULTS = { depth: true, mountains: true, peaks: true, cartouche: false, rose: 'catalan', towns: [], monster: 'heraldic', courseUp: false };

// The scene's options for a chart: the land in one colour, the sea's depth drawn, the mountains along the
// ranges in the M.E. 1937 pen style, the landmark peaks (scene.mjs draws each as the lone ink peak) and the
// cells' water lettered on the map, and no mountain sprite (kind `mountain` stays, as it draws the peaks). The
// atlas's sheets place the roses and rhumb lines, as on the page (docs/atlas/README.md); the beasts stand on the
// view's own water (`atlas: 'roses'`), since the sheets' sea is the world's, not the cells'. The scale bar stands as far
// from the bottom edge as from the left (`scaleGap`), the cartouche's corner margin
export const MOUNTAINS = ['me1937'];
export const CHART_OPTIONS = { kinds: ['rose', 'cartouche', 'monster', 'mountain'], names: true, land: 'off', islands: false, depth: true, relief: MOUNTAINS, peaks: true, peakNames: true, atlas: 'roses', scaleGap: 22, autoTitle: false, title: 'PORTOLANI' };

// The scene options for the drawer's settings, `list` the scene's sprite list, `cells` the cells' own options
// (enc-provider.js cellData): their built-up areas stand towns only while a Towns chip is on, so all off is none
export function chartOptions(settings, list, cells = {}) {
  // a kind turned off is left out, so the scene draws none (no rose sprite chosen would draw its plain rose)
  const on = { rose: ROSES.includes(settings.rose), cartouche: settings.cartouche, monster: settings.monster in MONSTERS, mountain: true };
  const kinds = CHART_OPTIONS.kinds.filter((k) => on[k]);
  return { ...CHART_OPTIONS, ...cells, places: settings.towns.length ? cells.places ?? [] : [], kinds, sprites: spritesFor(settings, list), depth: settings.depth, relief: settings.mountains ? MOUNTAINS : [], peaks: settings.peaks === true };
}
// Saved settings read over the defaults
export function readSettings(saved) {
  const s = { ...DEFAULTS, ...saved };
  if (!Array.isArray(s.towns)) s.towns = [...DEFAULTS.towns];
  s.towns = s.towns.filter((t) => t in TOWNS);
  if (s.rose !== 'off' && !ROSES.includes(s.rose)) s.rose = DEFAULTS.rose;
  return s;
}
