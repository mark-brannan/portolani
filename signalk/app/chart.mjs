// What the webapp ships of portolani's packs and what it asks the scene for. The build (build.mjs) trims
// each pack.json with packOf and copies only the files it keeps; the test reads the same trim. A chart
// draws the drawn (vivid) roses, cartouche, scale bar and towns, the drawn heraldic monsters and the
// scanned Paré ones, and no mountain sprite: its mountains are the inked ranges and its peaks the lone ink peak.
export const ROSES = ['aguiar', 'martines', 'oliva', 'brouscon', 'fleurs', 'dieppe'];
export const TOWNS = ['aguiar', 'martines'];
export const MONSTERS = { pare: 'scanned', heraldic: 'vivid' }; // a monster family and the pack it is drawn from
const KEPT = {
  vivid: (s) => ['rose', 'cartouche', 'scale', 'town'].includes(s.kind) || (s.kind === 'monster' && s.style === 'heraldic'),
  scanned: (s) => s.kind === 'monster' && s.style === 'pare',
};
export const packOf = (name, manifest) => ({ ...manifest, sprites: manifest.sprites.filter((s) => KEPT[name]?.(s) ?? false) });

// A rose style is its own rose and that rose's small sibling: the Aguiar family's Catalan roses are not the Aguiar rose
const roseOf = (style) => (s) => s.pack === 'vivid' && s.kind === 'rose' && s.style === style && s.id.startsWith(`rose-${style}`);
// The sprite keys (scene.mjs selectSprites) the drawer's settings choose, from the scene's sprite list (listSprites):
// `rose` a style of ROSES or 'off', `towns` styles of TOWNS, `monster` a family of MONSTERS or 'off', `cartouche` on or off
export function spritesFor({ rose, towns, monster, cartouche }, list) {
  const want = [
    (s) => ROSES.includes(rose) && roseOf(rose)(s),
    (s) => cartouche && s.pack === 'vivid' && s.kind === 'cartouche',
    (s) => s.pack === 'vivid' && s.kind === 'town' && towns.includes(s.style),
    (s) => s.kind === 'monster' && MONSTERS[monster] === s.pack && s.style === monster,
  ];
  return list.filter((s) => want.some((w) => w(s))).map((s) => s.key);
}
// The sprite a chip shows for a choice: the first of its kind and style
export const chipSprite = (list, kind, style, pack = 'vivid') => list.find((s) => s.pack === pack && s.kind === kind && s.style === style && (kind !== 'rose' || roseOf(style)(s)));

// The world geo the webapp does ship: the page's mountain ranges and landmark peaks, which the build
// (signalk/geo.mjs) slims from the same pinned coastlines files the page's build does. Every other
// geo/ file reads as empty: the land, coast, depth, towns and water names are the cells'.
export const CHART_GEO = ['geo/ranges-10m.json', 'geo/peaks-10m.json'];

// The drawer's settings before any are saved: the drawer's layers on, the cartouche off, the Aguiar rose,
// every drawn town style, the heraldic monsters, north up
export const DEFAULTS = { depth: true, mountains: true, peaks: true, cartouche: false, rose: 'aguiar', towns: [...TOWNS], monster: 'heraldic', courseUp: false };

// The scene's options for a chart: the land in one colour, the sea's depth drawn, the mountains along the
// ranges in the M.E. 1937 pen style, the landmark peaks (scene.mjs draws each as the lone ink peak) and the
// cells' water lettered on the map, and no mountain sprite (kind `mountain` stays, as it draws the peaks). No
// `atlas`: its sheets place the beasts on the world's sea, which the webapp does not ship, not on the cells' water
export const MOUNTAINS = ['me1937'];
export const CHART_OPTIONS = { kinds: ['rose', 'cartouche', 'monster', 'mountain'], names: true, land: 'off', islands: false, depth: true, relief: MOUNTAINS, peaks: true, peakNames: true, atlas: false, autoTitle: false, title: 'PORTOLANI' };

// The scene options for the drawer's settings, `list` the scene's sprite list
export function chartOptions(settings, list) {
  // a kind turned off is left out, so the scene draws none (no rose sprite chosen would draw its plain rose)
  const on = { rose: ROSES.includes(settings.rose), cartouche: settings.cartouche, monster: settings.monster in MONSTERS, mountain: true };
  const kinds = CHART_OPTIONS.kinds.filter((k) => on[k]);
  return { ...CHART_OPTIONS, kinds, sprites: spritesFor(settings, list), depth: settings.depth, relief: settings.mountains ? MOUNTAINS : [], peaks: settings.peaks === true };
}
// Saved settings read over the defaults
export function readSettings(saved) {
  const s = { ...DEFAULTS, ...saved };
  if (!Array.isArray(s.towns)) s.towns = [...DEFAULTS.towns];
  return s;
}
