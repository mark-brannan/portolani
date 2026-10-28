// Browser host for the shared scene code (scene.mjs): same scene as `npm run render`, drawn live.
// Drag to pan, wheel or pinch to zoom; while the map moves the land and coast are drawn and the placed
// ornaments slide with it, held to the earth; they are placed again when it stops. A row of six instruments
// at the top right opens one drawer each, one at a time: the settings behind the rose, so the map has the
// window, the charts, the points of interest, Go, the voyages and the anchorages. The view and the style are kept in the URL hash, e.g.
// #map=zoom/lat/lon&projection=miller&overlap=cut&sprites=s:serpent-a,v:kraken,v:rose-aguiar,p:tower&townsize=rank&names=0&rhumb=0&scale=chevron&scaleborder=blank&continents=5&regions=latin&regionszoom=7&land=green&islands=1&rivers=aguiar&lakes=marina&mountains=ink&trees=ink&seas=1&autotitle=0&title=Mare+Nostrum&ink=5a1a1a&parchment=eee&density=1.5;
// a setting left at its default is left out, `sprites` too (keys with the pack shortened, v: s: p:); `mountains` is `ink`
// or `off` (colour is the default); the hills are the Catalan sprites in `sprites`. `continents` and `regionszoom` are the zoom
// they are drawn down from (0 off, the top always). `voyages=columbus,drake:1f4e8c` are the voyages in the order chosen, a picked
// colour after an id, and `voyagewidth=3.2` their line weight. `overlay=carta-marina` lays that chart's scan over the map,
// `overlayopacity=0.6` how strongly (0 to 1); off by default.
// Older links naming a `rendering` (or `pack`), `rose`, `monster`, `town` and `kinds` open as the
// selection those chose, and are written back in the new form.
// For a while, `debug=sheets[,rings]` and `tune=name:value,...` carry the under-the-hood section
// (docs/atlas/under-the-hood.md), off by default.
import { createScene, towerGlyph, REGION_LANGS, drawScene, drawGround, anchorScene, drawAnchored, panView, zoomView, clampView, viewOfFrame, viewProjection, voyageMarks, SCALE_CARD_W, SCALE_CARD_H, drawCartoucheCard, drawScaleCard, covers, DEFAULT_VIEW, RENDERINGS, KINDS, DEFAULT_KINDS, LANDS, SCALE_BORDERS, MAX_ZOOM, OVERLAP_RULES, DEFAULT_OVERLAP, RIVER_STYLES, LAKE_STYLES, TREE_STYLES, TOWN_SIZES, readManifests, listSprites, defaultSprites, chooseSprites, PROJECTION_NAMES, SCALE_NAMES, parsePlacement, CORNERS, DEFAULT_CARTOUCHE_CORNER, DEFAULT_SCALE_CORNER, scaleRect, W, H, parseTune, parseDebug, TUNE_KNOBS, ROSE_SHARE, SHEET_ROSES, WIDE, VOYAGE_WIDTH, VOYAGE_WIDTHS, voyageColours, sightMarks, SIGHT_TILES, noteMarks } from './scene.mjs';
import { ORIGINS } from './atlas.mjs';
import { OVERLAY_DEFAULTS, overlayFromHash, overlayToHash } from './overlays.mjs';
import { POIS, POI_ZOOM } from './pois.mjs';
import { fold, bestPlace } from './placename.mjs';

const memo = new Map();
// a failed load is forgotten, so the next stop tries it again
const once = (key, make) => {
  if (!memo.has(key)) memo.set(key, make().catch((e) => { memo.delete(key); throw e; }));
  return memo.get(key);
};

const env = {
  createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
  readJSON: (p) => once(p, () => fetch(p).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); })),
  loadImage: (p) => once(p, () => new Promise((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => no(new Error(`${p}: image failed`));
    img.src = p;
  })),
  loadFont: (family) => once('font', async () => {
    const faces = [new FontFace(family, 'url(font/IMFeENrm28P.ttf)'), new FontFace(family, 'url(font/IMFeENit28P.ttf)', { style: 'italic' })];
    for (const face of faces) document.fonts.add(await face.load());
  }),
};

const $ = (id) => document.getElementById(id);
const canvas = $('map'), ctx = canvas.getContext('2d');
// A phone (under 520 px wide): a drawer is a bottom sheet, and the cartouche and the scale bar sit on
// cards beside the map, not on the sea.
const phone = matchMedia('(max-width: 520px)');

const DEFAULTS = { ink: '#3b2a1a', parchment: '#e9d8b4', density: 1, names: true, rhumb: true, scale: 'genoese', continentsZoom: 5, regions: 'latin', regionsZoom: 7, title: 'PORTOLANI', autoTitle: true, land: 'ochre', islands: false, rivers: 'plain', lakes: 'marina', mountains: 'colour', trees: 'marina', seaTint: false, scaleBorder: 'bordered', townSize: TOWN_SIZES[0], voyages: [], voyageWidth: VOYAGE_WIDTH, ...OVERLAY_DEFAULTS, cartouchePos: DEFAULT_CARTOUCHE_CORNER, scalePos: DEFAULT_SCALE_CORNER, overlap: DEFAULT_OVERLAP };

// ---------------------------------------------------------------- the sprites on offer

// Every sprite of a kind the scene places, from the manifests alone: a sprite added to a pack shows up here.
const MANIFESTS = await readManifests(env);
const SPRITES = (await listSprites(env)).filter((s) => KINDS.includes(s.kind) || s.kind === 'town');
const BY_KEY = new Map(SPRITES.map((s) => [s.key, s]));
// the scene's default selection
const DEFAULT_SELECTION = defaultSprites(SPRITES);
const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));

// keys in the hash: the pack shortened (v:rose-aguiar); a pack with no short name is written whole
const SHORT = { vivid: 'v', scanned: 's', plain: 'p', debry: 'd' };
const LONG = Object.fromEntries(Object.entries(SHORT).map(([k, v]) => [v, k]));
const encodeKey = (key) => { const [pack, id] = key.split('/'); return `${SHORT[pack] ?? pack}:${id}`; };
const decodeKey = (t) => { const i = t.indexOf(':'); return `${LONG[t.slice(0, i)] ?? t.slice(0, i)}/${t.slice(i + 1)}`; };

// ---------------------------------------------------------------- the hash

const LEGACY_PACK = { all: 'vivid', vivid: 'vivid', catalan: 'scanned', 'carta-marina': 'scanned', plain: 'plain' };
const LEGACY_KEYS = ['rendering', 'pack', 'rose', 'monster', 'town', 'kinds'];
const hashParams = () => new URLSearchParams(location.hash.slice(1));
// the drawer's layout (`layout=`), a way of grouping the same controls; Default is written as no key
const LAYOUT_NAMES = ['default', 'question', 'moods', 'sheet'];
const layoutFromHash = () => (LAYOUT_NAMES.includes(hashParams().get('layout')) ? hashParams().get('layout') : 'default');

function viewFromHash() {
  const q = hashParams(), m = /^(-?[\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)$/.exec(q.get('map') ?? '');
  const v = m && { zoom: Number(m[1]), lat: Number(m[2]), lon: Number(m[3]) };
  const at = v && Object.values(v).every(Number.isFinite) ? v : DEFAULT_VIEW; // e.g. #map=1.2.3/40/5
  return clampView({ ...at, projection: q.get('projection') });
}
const zoomOf = (v, dflt) => (v === '1' ? dflt : Number.isFinite(Number(v)) ? Math.max(0, Math.min(MAX_ZOOM, Math.round(Number(v)))) : dflt); // '1' is an older link's checked box
const hex = (v, fallback) => (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(v ?? '') ? `#${v.length === 3 ? [...v].map((c) => c + c).join('') : v}`.toLowerCase() : fallback);
function styleFromHash() {
  const q = hashParams(), density = Number(q.get('density') ?? DEFAULTS.density);
  return {
    ink: hex(q.get('ink'), DEFAULTS.ink),
    parchment: hex(q.get('parchment'), DEFAULTS.parchment),
    density: density >= 0 && density <= 2 ? density : DEFAULTS.density,
    names: q.get('names') !== '0',
    rhumb: q.get('rhumb') !== '0',
    // older links: continents=1 / 0, and regions=off
    continentsZoom: q.has('continents') ? zoomOf(q.get('continents'), DEFAULTS.continentsZoom) : DEFAULTS.continentsZoom,
    regions: ['latin', 'english'].includes(q.get('regions')) ? q.get('regions') : DEFAULTS.regions,
    regionsZoom: q.get('regions') === 'off' ? 0 : q.has('regionszoom') ? zoomOf(q.get('regionszoom'), DEFAULTS.regionsZoom) : DEFAULTS.regionsZoom,
    title: q.get('title') ?? DEFAULTS.title,
    // a link from before automatic was the default, with a title and no autotitle, keeps its title
    autoTitle: q.has('autotitle') ? q.get('autotitle') === '1' : !q.has('title') && DEFAULTS.autoTitle,
    land: LANDS.includes(q.get('land')) && q.get('land') !== 'islands' ? q.get('land') : DEFAULTS.land,
    islands: q.has('islands') ? q.get('islands') === '1' : q.get('land') === 'islands', // older: land=islands was the coloured islands
    rivers: RIVER_STYLES.includes(q.get('rivers')) ? q.get('rivers') : DEFAULTS.rivers,
    lakes: LAKE_STYLES.includes(q.get('lakes')) ? q.get('lakes') : DEFAULTS.lakes,
    // older links named the drawn styles in `relief`: colour wins where it is listed
    mountains: ['off', 'ink'].includes(q.get('mountains')) ? q.get('mountains')
      : q.has('relief') ? (q.get('relief').split(',').includes('marina') ? 'colour' : q.get('relief').includes('engraved') ? 'ink' : 'off') : DEFAULTS.mountains,
    trees: TREE_STYLES.includes(q.get('trees')) ? q.get('trees') : DEFAULTS.trees,
    seaTint: q.get('seas') === '1' || q.get('redsea') === '1',
    scaleBorder: SCALE_BORDERS.includes(q.get('scaleborder')) ? q.get('scaleborder') : DEFAULTS.scaleBorder,
    scale: q.get('scale') === 'off' || SCALE_NAMES.includes(q.get('scale')) ? q.get('scale') : DEFAULTS.scale,
    cartouchePos: CORNERS.includes(q.get('cartouche')) ? q.get('cartouche') : DEFAULTS.cartouchePos, // dragged to a corner of the map
    scalePos: CORNERS.includes(q.get('scalepos')) ? q.get('scalepos') : DEFAULTS.scalePos,
    townSize: TOWN_SIZES.includes(q.get('townsize')) ? q.get('townsize') : DEFAULTS.townSize,
    placement: parsePlacement(q.get('placement')).text,
    // how curated charts that overlap are drawn: one of OVERLAP_RULES (atlas.mjs)
    overlap: OVERLAP_RULES.includes(q.get('overlap')) ? q.get('overlap') : DEFAULTS.overlap,
    // under the hood, for a while: the sheets in red and the knobs fixed in the code, each as its canonical text
    debug: parseDebug(q.get('debug')).text,
    tune: parseTune(q.get('tune')).text,
    voyages: voyagesFromHash(q),
    voyageWidth: VOYAGE_WIDTHS.includes(Number(q.get('voyagewidth'))) ? Number(q.get('voyagewidth')) : DEFAULTS.voyageWidth,
    // a chart's scan laid over the map (packs/overlays/overlays.json; an id the site lacks draws nothing), and how strongly
    ...overlayFromHash(q),
  };
}
// The voyages drawn, in the order chosen, by their ids (data/voyages/<id>.json; one the site lacks draws nothing),
// each with the colour picked for it or null for its own (voyageColours): voyages=columbus,drake:1f4e8c. An older
// link's single voyage=<id> is read as a list of one.
function voyagesFromHash(q) {
  const list = q.has('voyages') ? q.get('voyages').split(',') : q.has('voyage') ? [q.get('voyage')] : [];
  const seen = new Set();
  return list.map((t) => { const [id, c] = t.split(':'); return { id, colour: /^[0-9a-f]{6}$/i.test(c ?? '') ? `#${c.toLowerCase()}` : null }; })
    .filter((v) => /^[a-z][a-z0-9-]*$/.test(v.id) && v.id !== 'off' && !seen.has(v.id) && seen.add(v.id));
}
// The selection a hash names; an older link's rendering, styles and kinds become the selection they drew.
function selectionFromHash() {
  const q = hashParams();
  if (q.has('sprites')) return new Set(q.get('sprites').split(',').filter(Boolean).map(decodeKey).filter((k) => BY_KEY.has(k)));
  if (!LEGACY_KEYS.some((k) => q.has(k))) return new Set(DEFAULT_SELECTION);
  const rendering = RENDERINGS.includes(q.get('rendering')) ? q.get('rendering') : LEGACY_PACK[q.get('pack')] ?? 'vivid';
  const chosen = chooseSprites(MANIFESTS, { rendering, rose: q.get('rose') || undefined, monster: q.get('monster') || undefined, town: q.get('town') || undefined });
  const kinds = q.has('kinds') ? q.get('kinds').split(',') : DEFAULT_KINDS.filter((k) => k !== 'mountain'); // older links never drew mountains
  const keys = [...chosen.roses, chosen.cartouche, ...chosen.monsters, ...chosen.ships, ...chosen.mountains].filter(Boolean).map((s) => `${s.pack}/${s.id}`)
    .concat(chosen.roses.length ? [] : ['plain/rose'], chosen.cartouche ? [] : ['plain/cartouche'])
    .filter((k) => kinds.includes(BY_KEY.get(k)?.kind));
  return new Set([...keys, ...chosen.towns.map((s) => `${s.pack}/${s.id}`), ...(chosen.tower ? ['plain/tower'] : [])].filter((k) => BY_KEY.has(k)));
}
function writeHash() {
  const q = new URLSearchParams(), v = view, st = style;
  q.set('map', `${v.zoom.toFixed(2)}/${v.lat.toFixed(3)}/${v.lon.toFixed(3)}`);
  if (v.projection !== PROJECTION_NAMES[0]) q.set('projection', v.projection);
  if (layout !== 'default') q.set('layout', layout);
  if (!sameSet(selection, new Set(DEFAULT_SELECTION))) q.set('sprites', SPRITES.filter((s) => selection.has(s.key)).map((s) => encodeKey(s.key)).join(','));
  if (st.townSize !== DEFAULTS.townSize) q.set('townsize', st.townSize);
  if (!st.names) q.set('names', '0');
  if (!st.rhumb) q.set('rhumb', '0');
  if (st.continentsZoom !== DEFAULTS.continentsZoom) q.set('continents', st.continentsZoom);
  if (st.regions !== DEFAULTS.regions) q.set('regions', st.regions);
  if (st.regionsZoom !== DEFAULTS.regionsZoom) q.set('regionszoom', st.regionsZoom);
  // a title without autotitle reads as custom (styleFromHash), so a typed title carries the mode with it
  if (st.autoTitle !== DEFAULTS.autoTitle || st.title !== DEFAULTS.title) q.set('autotitle', st.autoTitle ? '1' : '0');
  if (st.title !== DEFAULTS.title) q.set('title', st.title);
  if (st.land !== DEFAULTS.land) q.set('land', st.land);
  if (st.islands !== DEFAULTS.islands) q.set('islands', st.islands ? '1' : '0');
  if (st.rivers !== DEFAULTS.rivers) q.set('rivers', st.rivers);
  if (st.lakes !== DEFAULTS.lakes) q.set('lakes', st.lakes);
  if (st.mountains !== DEFAULTS.mountains) q.set('mountains', st.mountains);
  if (st.trees !== DEFAULTS.trees) q.set('trees', st.trees);
  if (st.placement) q.set('placement', st.placement);
  if (st.overlap !== DEFAULTS.overlap) q.set('overlap', st.overlap);
  if (st.debug) q.set('debug', st.debug);
  if (st.tune) q.set('tune', st.tune);
  if (st.voyages.length) q.set('voyages', st.voyages.map((v) => (v.colour ? `${v.id}:${v.colour.slice(1)}` : v.id)).join(','));
  if (st.voyageWidth !== DEFAULTS.voyageWidth) q.set('voyagewidth', st.voyageWidth);
  overlayToHash(st, q);
  if (st.seaTint) q.set('seas', '1');
  if (st.scaleBorder !== DEFAULTS.scaleBorder) q.set('scaleborder', st.scaleBorder);
  if (st.scale !== DEFAULTS.scale) q.set('scale', st.scale);
  if (st.cartouchePos !== DEFAULTS.cartouchePos) q.set('cartouche', st.cartouchePos);
  if (st.scalePos !== DEFAULTS.scalePos) q.set('scalepos', st.scalePos);
  if (st.density !== DEFAULTS.density) q.set('density', st.density);
  if (st.ink !== DEFAULTS.ink) q.set('ink', st.ink.slice(1));
  if (st.parchment !== DEFAULTS.parchment) q.set('parchment', st.parchment.slice(1));
  history.replaceState(null, '', `#${q.toString().replaceAll('%2C', ',').replaceAll('%2F', '/').replaceAll('%3A', ':')}`);
}

// ---------------------------------------------------------------- the pickers

// A family is a style drawn one way: "Carta Marina · scan" beside "Carta Marina · drawn".
const HOW = { scanned: 'scan', debry: 'scan', vivid: 'drawn', plain: 'drawn in code' };
const PACK_ORDER = ['scanned', 'debry', 'vivid', 'plain'];
const titleCase = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
function familiesOf(kind) {
  const sprites = SPRITES.filter((s) => s.kind === kind), styles = [...new Set(sprites.map((s) => s.style))];
  const out = new Map();
  for (const s of sprites) {
    const id = `${s.style}|${s.pack}`;
    if (!out.has(id)) out.set(id, { label: `${titleCase(s.style)} · ${HOW[s.pack] ?? s.pack}`, rank: styles.indexOf(s.style) * 10 + PACK_ORDER.indexOf(s.pack), sprites: [] });
    out.get(id).sprites.push(s);
  }
  return [...out.values()].sort((a, b) => a.rank - b.rank);
}

// Glyphs for the shapes drawn in code, which have no picture to show.
const rosePath = () => {
  const pts = [];
  for (let i = 0; i < 32; i++) { const r = i % 2 ? 4 : i % 4 ? 11 : 19, a = (i * Math.PI) / 16 - Math.PI / 2; pts.push(`${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`); }
  return `M${pts.join('L')}Z`;
};
const GLYPHS = {
  rose: `<svg viewBox="-22 -22 44 44"><circle r="20" fill="none" stroke="currentColor"/><path d="${rosePath()}" fill="currentColor"/></svg>`,
  cartouche: '<svg viewBox="0 0 64 44"><rect x="6" y="10" width="52" height="24" fill="none" stroke="currentColor" stroke-width="2"/><rect x="2" y="6" width="60" height="32" fill="none" stroke="currentColor" stroke-width="0.8"/><path d="M18 22h28" stroke="currentColor" stroke-width="3" stroke-dasharray="4 2"/></svg>',
};

function thumb(s, label) {
  const b = document.createElement('button');
  Object.assign(b, { type: 'button', className: 'thumb', title: s.id });
  b.dataset.key = s.key;
  b.setAttribute('aria-label', `${s.id}, ${label}`);
  if (s.file) b.append(Object.assign(new Image(), { src: `packs/${s.pack}/${s.file}`, alt: '', decoding: 'async' }));
  else b.innerHTML = GLYPHS[s.id] ?? towerGlyph(s.id); // the towers draw their own
  return b;
}

// Each family: a checkbox for the whole family (indeterminate when part of it is on) over its sprites, each its own toggle.
const familyBoxes = [];
for (const kind of ['monster', 'ship', 'rose', 'town', 'mountain']) { // the mountain kind is the Catalan sprites, which stand on the hills
  for (const fam of familiesOf(kind)) {
    const row = document.createElement('div'), head = document.createElement('label'), box = document.createElement('input'), count = document.createElement('span'), thumbs = document.createElement('div');
    row.className = 'family'; head.className = 'fam'; count.className = 'count'; thumbs.className = 'thumbs';
    box.type = 'checkbox';
    head.append(box, fam.label, count);
    thumbs.append(...fam.sprites.map((s) => thumb(s, fam.label)));
    row.append(head, thumbs);
    $(kind === 'mountain' ? 'pick-relief' : `pick-${kind}`).append(row);
    const keys = fam.sprites.map((s) => s.key);
    familyBoxes.push({ box, count, keys });
    box.addEventListener('change', () => { const all = keys.every((k) => selection.has(k)); for (const k of keys) all ? selection.delete(k) : selection.add(k); changed(); });
  }
}
// The cartouche is one of its pictures, or none.
const none = Object.assign(document.createElement('button'), { type: 'button', className: 'thumb none', textContent: 'None' });
$('pick-cartouche').append(...familiesOf('cartouche').flatMap((f) => f.sprites.map((s) => thumb(s, f.label))), none);
const CARTOUCHES = SPRITES.filter((s) => s.kind === 'cartouche').map((s) => s.key);
$('drawer').addEventListener('click', (e) => {
  const b = e.target.closest('.thumb');
  if (!b) return;
  const key = b.dataset.key;
  if (b === none || CARTOUCHES.includes(key)) { for (const k of CARTOUCHES) selection.delete(k); if (key) selection.add(key); }
  else if (selection.has(key)) selection.delete(key); else selection.add(key);
  changed();
});

// ---------------------------------------------------------------- the choices

// One of a few, as chips rather than a dropdown: each `.chips` element reads and writes its choice as `.value`
// and fires `input` when one is chosen, as the select it replaces did.
// Each option may carry a sample of what it does: a colour (a dot) or an inline picture (an SVG string).
const svg = (body, wide) => `<svg viewBox="0 0 28 18"${wide ? ' class="wide"' : ''} aria-hidden="true">${body}</svg>`;
const stroke = (c, w = 1.5) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const lineOf = (c, w = 3) => svg(`<path d="M2 9h24" ${stroke(c, w)}/>`);
const GRID = (rows) => rows.map((y) => `<path d="M2 ${y}h24" ${stroke('currentColor', 0.6)}/>`).join('') + [8, 14, 20].map((x) => `<path d="M${x} 2v14" ${stroke('currentColor', 0.6)}/>`).join('');
const ROUND = (extra = '') => `<circle cx="14" cy="9" r="7.5" ${stroke('currentColor', 1)}/><path d="M14 1.5v15M6.5 9h15${extra}" ${stroke('currentColor', 0.6)}/>`;
const PROJECTION_GLYPHS = {
  mercator: svg(`<rect x="2" y="2" width="24" height="14" ${stroke('currentColor', 1)}/>${GRID([4, 7, 11, 14])}`),
  'plate-carree': svg(`<rect x="2" y="2" width="24" height="14" ${stroke('currentColor', 1)}/>${GRID([6, 9, 12])}`),
  miller: svg(`<rect x="2" y="2" width="24" height="14" ${stroke('currentColor', 1)}/>${GRID([5, 9, 13])}`),
  'equal-area': svg(`<rect x="2" y="4" width="24" height="10" ${stroke('currentColor', 1)}/>${GRID([7, 9, 11]).replaceAll('M8 2v14', 'M8 4v10').replaceAll('M14 2v14', 'M14 4v10').replaceAll('M20 2v14', 'M20 4v10')}`),
  orthographic: svg(ROUND('') + `<path d="M8 3.5Q5 9 8 14.5M20 3.5Q23 9 20 14.5" ${stroke('currentColor', 0.6)}/>`),
  'azimuthal-equidistant': svg(ROUND('') + `<circle cx="14" cy="9" r="3.7" ${stroke('currentColor', 0.6)}/>`),
  stereographic: svg(ROUND('') + `<circle cx="14" cy="9" r="2.5" ${stroke('currentColor', 0.6)}/><circle cx="14" cy="9" r="5.2" ${stroke('currentColor', 0.6)}/>`),
};
const MOUNTAIN_GLYPHS = {
  off: svg(`<path d="M3 15h22" ${stroke('currentColor', 0.8)}/>`),
  ink: svg(`<path d="M3 15 10 4l3 5 4-7 8 13Z" ${stroke('currentColor', 1)}/><path d="M17 2l-3 13M19 6l-2 9M10 4 8 15M12 9l-2 6" ${stroke('currentColor', 0.6)}/>`),
  colour: svg('<path d="M3 15 10 4l3 5 4-7 8 13Z" fill="#d2965a" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M17 2l3 13h5ZM10 4l2 11h-3Z" fill="rgba(150,70,32,.7)"/>'),
};
const HILL_GLYPH = svg('<path d="M3 15c3-9 8-9 11 0M12 15c3-7 7-7 10 0" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><path d="M6 11l1 2M9 11l1 2M16 11l1 2M19 11l1 2" stroke="currentColor" stroke-width=".6"/>');
const WIGGLE = (c) => svg(`<path d="M2 9q3-6 6 0t6 0 6 0 6 0" ${stroke(c, 1.2)}/>`);
const RIVER_GLYPHS = { aguiar: WIGGLE('#3b2a1a'), marina: svg(`<path d="M2 7h24M2 11h24" ${stroke('#3b2a1a', 1)}/>`), plain: lineOf('#4a7fa0', 2) };
const LAKE_GLYPHS = {
  aguiar: svg('<path d="M14 3l5 6-5 6-5-6Z" fill="#a8432e" stroke="#3b2a1a" stroke-width=".8"/>'),
  marina: svg(`<ellipse cx="14" cy="9" rx="9" ry="5" ${stroke('#3b2a1a', 1)}/><path d="M7 7l5 4M10 5l7 6M15 5l5 4" ${stroke('#3b2a1a', 0.6)}/>`),
  plain: svg('<ellipse cx="14" cy="9" rx="9" ry="5" fill="#8fb4c8" stroke="#4a7fa0" stroke-width="1"/>'),
};
const ISLANDS_GLYPH = svg('<circle cx="6" cy="9" r="3.5" fill="#a8432e"/><circle cx="14" cy="6" r="3" fill="#6b8a4a"/><circle cx="21" cy="11" r="3.5" fill="#c9a13b"/>');
const SEAS_GLYPH = svg('<rect x="2" y="3" width="24" height="12" rx="3" fill="#a8432e" fill-opacity=".5" stroke="#a8432e" stroke-width="1"/>');
const SCALE_GLYPHS = {
  genoese: svg(`<path d="M2 6h24M2 12h24" ${stroke('#8c2f1e', 1)}/><path d="M2 5v8M8 5v8M14 5v8M20 5v8M26 5v8" ${stroke('#8c2f1e', 1)}/>`),
  chequer: svg('<rect x="2" y="5" width="6" height="4" fill="#8c2f1e"/><rect x="14" y="5" width="6" height="4" fill="#8c2f1e"/><rect x="8" y="9" width="6" height="4" fill="#4f6b3a"/><rect x="20" y="9" width="6" height="4" fill="#4f6b3a"/>'),
  chevron: svg(`<path d="M2 9l3-4 3 8 3-8 3 8 3-8 3 8 3-8 3 4" ${stroke('#8c2f1e', 1)}/>`),
  ribbon: svg(`<rect x="2" y="5" width="24" height="8" fill="#e9d8b4" stroke="#8c2f1e" stroke-width="1.2"/><path d="M8 5v8M14 5v8M20 5v8" ${stroke('#8c2f1e', 0.8)}/>`),
  beads: svg(`<path d="M2 5h24M2 13h24" ${stroke('#8c2f1e', 0.8)}/><circle cx="6" cy="9" r="2.4" ${stroke('#8c2f1e', 0.9)}/><circle cx="14" cy="9" r="2.4" ${stroke('#8c2f1e', 0.9)}/><circle cx="22" cy="9" r="2.4" ${stroke('#8c2f1e', 0.9)}/>`),
  ruled: svg(`<path d="M2 4h24M2 14h24" ${stroke('#8c2f1e', 0.8)}/><path d="M3 3v12M14 3v12M25 3v12" ${stroke('#8c2f1e', 0.8)}/><circle cx="14" cy="9" r="2" fill="#e9d8b4" stroke="#8c2f1e" stroke-width=".8"/>`),
};
const MAP_LINES = '<path d="M0 4q8-3 14 2t14-1M0 13q9 3 15-1t13 2" fill="none" stroke="currentColor" stroke-width=".7" opacity=".6"/>';
const BORDER_GLYPHS = {
  bordered: svg(`<rect width="28" height="18" fill="none"/>${MAP_LINES}<rect x="4" y="4" width="20" height="10" fill="#e9d8b4" stroke="#8c2f1e" stroke-width="1"/><rect x="6" y="6" width="16" height="6" fill="none" stroke="#8c2f1e" stroke-width=".6"/>`),
  blank: svg(`${MAP_LINES}<rect x="4" y="4" width="20" height="10" fill="#e9d8b4"/><path d="M7 9h14" ${stroke('#8c2f1e', 1.2)}/>`),
  transparent: svg(`${MAP_LINES}<path d="M7 9h14" ${stroke('#8c2f1e', 1.2)}/>`),
};
const COAST = 'M2 8q4-4 8 0t8 0 8 0V16H2Z';
const LAND_GLYPH = (wash, shoals = '') => svg(`<path d="${COAST}" fill="${wash}" fill-opacity=".75" stroke="#3b2a1a" stroke-width="1" stroke-linejoin="round"/>${shoals}`);
const SHOAL_DOTS = '<g fill="#a8432e"><circle cx="4" cy="3.2" r="1"/><circle cx="9" cy="2.2" r="1"/><circle cx="14" cy="3.4" r="1"/><circle cx="19" cy="2.2" r="1"/><circle cx="24" cy="3.4" r="1"/></g>';
const LAND_GLYPHS = { gilt: LAND_GLYPH('#b58a3c'), green: LAND_GLYPH('#6b8a4a'), ochre: LAND_GLYPH('#c47f2c', SHOAL_DOTS) };
const CROWN = 'M14 4a4 4 0 0 1 4 3 3.5 3.5 0 0 1 1 6.5H9A3.5 3.5 0 0 1 10 7a4 4 0 0 1 4-3Z';
const TREE_GLYPHS = {
  marina: svg(`<path d="M14 13v3" ${stroke('#3b2a1a', 1.2)}/><path d="${CROWN}" fill="#6b8a4a" stroke="#3b2a1a" stroke-width="1" stroke-linejoin="round"/>`),
  ink: svg(`<path d="M14 13v3" ${stroke('currentColor', 1.2)}/><path d="${CROWN}" ${stroke('currentColor', 1)}/><path d="M11 9l1 1M14 7l1 1M16 10l1 1" ${stroke('currentColor', 0.6)}/>`),
};
// Two charts, the smaller in the larger's corner, each with its hub and rays: what each overlap rule keeps and draws.
const OVERLAP_GLYPHS = (() => {
  const chart = (x, y, w, h, faint) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" ${stroke('currentColor', 1)}${faint ? ' opacity=".3"' : ''}/>`;
  const big = (faint) => chart(2, 2, 24, 14, faint), small = (faint) => chart(14, 8, 12, 8, faint);
  const bigRays = (cut) => `<path d="M9 9 2 2M9 9 26 2M9 9 2 16M9 9 ${cut ? '14 11.1' : '26 16'}M9 9H${cut ? 14 : 26}M9 9H2" ${stroke('currentColor', 0.6)}/>`;
  const smallRays = `<path d="M20 12 14 8M20 12 26 8M20 12 26 16M20 12 14 16M20 12H14M20 12H26" ${stroke('currentColor', 0.6)}/>`;
  return {
    smallest: svg(big(true) + small() + smallRays),
    fit: svg(big() + bigRays(false) + small(true)),
    cut: svg(big() + small() + bigRays(true) + smallRays),
    uncut: svg(big() + small() + bigRays(false) + smallRays),
  };
})();
// Under the hood: the sheets' red, a sheet's outline and its ring, a grid's origin, the rose's lines.
const RED = '#d00';
const SHEET_GLYPH = `<rect x="4" y="3" width="20" height="12" ${stroke(RED, 1.5)}/>`;
const HOOD_GLYPHS = {
  off: MOUNTAIN_GLYPHS.off,
  sheets: svg(SHEET_GLYPH),
  rings: svg(`${SHEET_GLYPH}<circle cx="14" cy="9" r="4.5" ${stroke(RED, 1)}/><circle cx="14" cy="9" r="1.3" ${stroke(RED, 0.8)}/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${(14 + 4.5 * Math.sin(i * Math.PI / 4)).toFixed(2)}" cy="${(9 - 4.5 * Math.cos(i * Math.PI / 4)).toFixed(2)}" r=".9" fill="${RED}"/>`).join('')}`),
  rose: svg(`<path d="M2 9h24M14 2v14M8 2v14M20 2v14M2 5h24M2 13h24" ${stroke('currentColor', 0.5)}/><path d="M14 6l1 3-1 3-1-3Z M11 9l3-1 3 1-3 1Z" fill="${RED}"/>`),
  zero: svg(`<path d="M2 9h24M14 2v14M8 2v14M20 2v14M2 5h24M2 13h24" ${stroke('currentColor', 0.5)}/><circle cx="14" cy="9" r="2.6" ${stroke(RED, 1.2)}/>`),
  curated: svg(`<rect x="3" y="3" width="22" height="12" ${stroke('currentColor', 1)}/><circle cx="14" cy="9" r="4" ${stroke('currentColor', 0.8)}/>`),
  grid: svg(`<rect x="3" y="3" width="22" height="12" ${stroke('currentColor', 1)}/><path d="M8.5 3v12M14 3v12M19.5 3v12M3 9h22" ${stroke('currentColor', 0.6)}/>`),
  roselines: svg(`<path d="M6 9h20M6 9l18-6M6 9l18 6M6 9l12-7M6 9l12 7" ${stroke('currentColor', 0.6)}/><circle cx="6" cy="9" r="1.6" fill="${RED}"/>`),
};
const ROSE_AT = `${Math.abs(ORIGINS.rose.lon)}°${ORIGINS.rose.lon < 0 ? 'W' : 'E'} ${Math.abs(ORIGINS.rose.lat)}°${ORIGINS.rose.lat < 0 ? 'S' : 'N'}`;
const CHOICES = {
  overlap: [['smallest', 'Smallest', 'only the smallest of the charts that overlap'], ['fit', 'Fit', 'the chart nearest one window wide'], ['cut', 'All, cut', 'every chart, its lines stopping at a smaller chart\'s edge'], ['uncut', 'All, uncut', 'every chart in full']].map(([value, label, note]) => [value, label, note, OVERLAP_GLYPHS[value]]),
  projection: [['mercator', 'Mercator', 'rhumb lines straight'], ['plate-carree', 'Plate carrée', 'equal degrees'], ['miller', 'Miller', 'poles tamed'], ['equal-area', 'Equal-area', 'Gall–Peters'], ['orthographic', 'Globe', 'orthographic'], ['azimuthal-equidistant', 'Azimuthal equidistant', 'true from the centre'], ['stereographic', 'Stereographic', 'the polar chart']].map(([value, label, note = '']) => [value, label, note, PROJECTION_GLYPHS[value]]),
  regions: [['latin', 'Latin', 'Hispania'], ['english', 'English', 'Iberia']],
  titleMode: [['auto', 'Automatic', 'what the view shows'], ['custom', 'Custom']],
  mountains: [['off', 'Off', '', MOUNTAIN_GLYPHS.off], ['ink', 'Ink', 'black and white hatching, as Engraved', MOUNTAIN_GLYPHS.ink], ['colour', 'Colour', 'ochre wash, as the Carta Marina', MOUNTAIN_GLYPHS.colour]],
  hills: [['off', 'Off', '', MOUNTAIN_GLYPHS.off], ['catalan', 'Catalan drawings', 'Catalan Atlas, 1375', HILL_GLYPH]],
  land: [['off', 'Off', '', MOUNTAIN_GLYPHS.off], ['gilt', 'Gilt wash', '', LAND_GLYPHS.gilt], ['green', 'Green wash', 'Oliva, c.1590', LAND_GLYPHS.green], ['ochre', 'Ochre with shoals', 'Benincasa, 1466', LAND_GLYPHS.ochre]],
  islands: [['off', 'Plain islands'], ['on', 'Coloured islands', 'Beccari, 1403', ISLANDS_GLYPH]],
  seaTint: [['off', 'Plain seas'], ['on', 'Coloured seas', 'Red, Black and Caspian Seas, the Persian Gulf', SEAS_GLYPH]],
  rivers: [['off', 'Off'], ['aguiar', 'Wiggled ink', 'Aguiar, 1492', RIVER_GLYPHS.aguiar], ['marina', 'Double line', 'Carta Marina, 1539', RIVER_GLYPHS.marina], ['plain', 'Plain blue line', '', RIVER_GLYPHS.plain]],
  lakes: [['off', 'Off'], ['aguiar', 'Lozenges', 'Aguiar, 1492', LAKE_GLYPHS.aguiar], ['marina', 'True shapes, hatched', 'Carta Marina, 1539', LAKE_GLYPHS.marina], ['plain', 'True shapes, blue wash', '', LAKE_GLYPHS.plain]],
  trees: [['off', 'Off', '', MOUNTAIN_GLYPHS.off], ['marina', 'Green crowns', 'Carta Marina, 1539', TREE_GLYPHS.marina], ['ink', 'Ink only', '', TREE_GLYPHS.ink]],
  scale: [['off', 'Off'], ['genoese', 'Genoese', 'drawn as vectors'], ['chequer', 'Chequer'], ['chevron', 'Chevron ladder', 'Genoese'], ['ribbon', 'Ribbon', 'Martines'], ['beads', 'Beads', 'Prunes'], ['ruled', 'Ruled', 'Beccari']].map(([value, label, note = '']) => [value, label, note, SCALE_GLYPHS[value]]),
  voyageWidth: VOYAGE_WIDTHS.map((w, i) => [String(w), ['Fine', 'Standard', 'Bold', 'Heavy'][i] ?? `${w} px`, `${w} px`, lineOf('#8c2f1e', w)]),
  scaleBorder: [['bordered', 'Bordered', 'parchment and a double rule'], ['blank', 'Blank', 'parchment, no rule'], ['transparent', 'Transparent', 'drawn over the map']].map(([value, label, note = '']) => [value, label, note, BORDER_GLYPHS[value]]),
  debug: [['off', 'Off', '', HOOD_GLYPHS.off], ['sheets', 'Outlines', 'each sheet of the atlas at this view, in red, with its name', HOOD_GLYPHS.sheets], ['sheets,rings', 'Outlines + rings', 'and each sheet\'s hidden circle: its hub and sixteen nodes', HOOD_GLYPHS.rings]],
  tuneOrigin: [['rose', `Catalan rose (${ROSE_AT})`, 'every band\'s grid has a corner on the rose', HOOD_GLYPHS.rose], ['zero', '0° 0°', 'NOAA\'s own zero', HOOD_GLYPHS.zero]],
  tuneCurated: [['1', 'On', 'the curated charts take the place of the grid cells they hold', HOOD_GLYPHS.curated], ['0', 'Off', 'grid cells everywhere', HOOD_GLYPHS.grid]],
  tuneRoselines: [['1', 'On', 'the rose\'s 32 lines as one more hub at every zoom', HOOD_GLYPHS.roselines], ['0', 'Off', 'only the sheet the rose falls in', HOOD_GLYPHS.off]],
};
for (const [id, options] of Object.entries(CHOICES)) {
  const el = $(id);
  for (const [value, label, note, dot] of options) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'chip', title: note ? `${label} (${note})` : label });
    b.dataset.value = value;
    b.setAttribute('role', 'radio');
    if (dot?.startsWith('<')) b.insertAdjacentHTML('beforeend', dot);
    else if (dot) b.append(Object.assign(document.createElement('i'), { style: `background:${dot}` }));
    b.append(label);
    el.append(b);
  }
  Object.defineProperty(el, 'value', {
    get: () => el.dataset.value,
    set: (v) => { el.dataset.value = v; for (const b of el.children) b.setAttribute('aria-checked', String(b.dataset.value === v)); },
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b && b.dataset.value !== el.value) { el.value = b.dataset.value; el.dispatchEvent(new Event('input')); }
  });
}

// ---------------------------------------------------------------- the captions

// Where a style comes from, as a caption under its chip group: plain text, with each chart or maker
// linking to its page on Wikipedia or Wikimedia Commons.
const C = 'https://commons.wikimedia.org/wiki/File:';
const WP = {
  marina: ['Carta marina', 'https://en.wikipedia.org/wiki/Carta_marina'],
  olaus: ['Olaus Magnus', 'https://en.wikipedia.org/wiki/Olaus_Magnus'],
  catalan: ['Catalan Atlas', 'https://en.wikipedia.org/wiki/Catalan_Atlas'],
  cresques: ['Cresques Abraham', 'https://en.wikipedia.org/wiki/Cresques_Abraham'],
  oliva: ['Joan Oliva', `${C}1590_Portolan_chart_of_the_Eastern_Mediterranean,_the_Aegean_and_the_Black_Sea_by_Joan_Oliva.tif`],
  benincasa: ['Grazioso Benincasa', `${C}1466_Portolan_chart_of_the_Eastern_Mediterrenean,_the_Aegean_Sea_and_the_Sea_of_Marmara_by_Grazioso_Benincasa.jpg`],
  beccario: ['Francesco Beccario', `${C}Francesco_Beccario_chart_(1403).jpg`],
  aguiar: ['Jorge de Aguiar', `${C}Jorge_Aguiar_1492_MR.jpg`],
  genoese: ['an anonymous chart, probably Genoese', `${C}Mediterranean_chart_fourteenth_century2.jpg`],
  martines: ['Joan Martines', 'https://en.wikipedia.org/wiki/Joan_Martines'],
  prunes: ['Mateus Prunes', `${C}(Chart_of_the_Mediterranean,_Black_Sea,_and_the_coasts_of_western_Europe_and_northwest_Africa)_LOC_2014588812.jpg`],
};
// a string is text; a key is a link
const CAPTIONS = {
  mountains: ['After the ', 'marina', ' of ', 'olaus', ', first printed in 1539.'],
  hills: ['After the ', 'catalan', ', conventionally dated 1375, by ', 'cresques', ' of Mallorca.'],
  trees: ['After the ', 'marina', ' of ', 'olaus', ', first printed in 1539.'],
  land: ['Green wash: ', 'oliva', ', 1590. Ochre with shoals: ', 'benincasa', ', 1466.'],
  seaTint: ['Coloured islands: ', 'beccario', ', Genoa, 1403.'],
  rivers: ['Wiggled ink: ', 'aguiar', ', Lisbon, 1492. Double line: the ', 'marina', ', 1539.'],
  lakes: ['Lozenges: ', 'aguiar', ', Lisbon, 1492. Hatched shapes: the ', 'marina', ', 1539.'],
  scaleBorder: ['Ladders after ', 'genoese', ', about 1320 to 1350 (chevron); ', 'prunes', ', 1559 (beads); ', 'martines', ' of Messina (ribbon); ', 'beccario', ', 1403 (ruled).'],
};
for (const [id, parts] of Object.entries(CAPTIONS)) {
  const p = document.createElement('p');
  p.className = 'caption';
  for (const part of parts) {
    if (!WP[part]) { p.append(part); continue; }
    const a = Object.assign(document.createElement('a'), { href: WP[part][1], textContent: WP[part][0], target: '_blank', rel: 'noopener noreferrer' });
    p.append(a);
  }
  const g = $(id);
  (id === 'seaTint' ? g.parentElement : g).after(p); // #seaTint shares a row with #islands, so its caption goes after the row
}

// ---------------------------------------------------------------- the controls

// the controls show the style and the selection
const CATALAN_KEYS = SPRITES.filter((s) => s.kind === 'mountain').map((s) => s.key);
const zoomLabel = (n) => (n <= 0 ? 'off' : n >= MAX_ZOOM ? 'always' : `zoom ${n} and out`);
function showStyle() {
  $('projection').value = view.projection;
  $('ink').value = style.ink; $('parchment').value = style.parchment;
  $('density').value = style.density; $('densityOut').textContent = style.density;
  $('names').checked = style.names; $('rhumb').checked = style.rhumb; $('scale').value = style.scale; $('scaleBorder').value = style.scaleBorder;
  $('land').value = style.land; $('islands').value = style.islands ? 'on' : 'off'; $('seaTint').value = style.seaTint ? 'on' : 'off';
  $('rivers').value = style.rivers; $('lakes').value = style.lakes; $('trees').value = style.trees;
  $('overlap').value = style.overlap;
  $('mountains').value = style.mountains; $('hills').value = CATALAN_KEYS.some((k) => selection.has(k)) ? 'catalan' : 'off';
  $('continentsZoom').value = style.continentsZoom; $('continentsOut').textContent = zoomLabel(style.continentsZoom);
  $('regions').value = style.regions; $('regionsZoom').value = style.regionsZoom; $('regionsOut').textContent = zoomLabel(style.regionsZoom);
  $('titleMode').value = style.autoTitle ? 'auto' : 'custom'; $('title').disabled = style.autoTitle;
  if (!style.autoTitle) $('title').value = style.title; // automatic shows the view's own name, once placed (render)
  $('townSize').checked = style.townSize !== 'rank';
  showHood();
  $('voyageWidth').value = String(style.voyageWidth);
  showOverlay();
  showUiNow(); showMoods();
  for (const f of toolRefreshers) f();
  for (const b of document.querySelectorAll('#drawer .thumb')) b.setAttribute('aria-pressed', b === none ? !CARTOUCHES.some((k) => selection.has(k)) : selection.has(b.dataset.key));
  for (const { box, count, keys } of familyBoxes) {
    const on = keys.filter((k) => selection.has(k)).length;
    box.checked = on === keys.length; box.indeterminate = on > 0 && on < keys.length;
    count.textContent = `${on} of ${keys.length}`;
  }
}
function readControls() {
  style = {
    ink: $('ink').value, parchment: $('parchment').value, density: Number($('density').value),
    names: $('names').checked, rhumb: $('rhumb').checked, scale: $('scale').value, scaleBorder: $('scaleBorder').value,
    land: $('land').value, islands: $('islands').value === 'on', seaTint: $('seaTint').value === 'on',
    rivers: $('rivers').value, lakes: $('lakes').value, mountains: $('mountains').value, trees: $('trees').value,
    continentsZoom: Number($('continentsZoom').value), regions: $('regions').value, regionsZoom: Number($('regionsZoom').value),
    // automatic shows the view's name in the box, which is not the typed title
    title: $('titleMode').value === 'auto' || style.autoTitle ? style.title : $('title').value, // switching to custom starts from the typed title, not the name shown
    autoTitle: $('titleMode').value === 'auto',
    // checked, by metro area; a link's townsize=population is kept until the box is touched
    townSize: $('townSize').checked ? (style.townSize === 'rank' ? 'area' : style.townSize) : 'rank',
    placement: style.placement, // chosen by the placement chips below
    overlap: $('overlap').value,
    cartouchePos: style.cartouchePos, scalePos: style.scalePos, // set by dragging the cartouche or the scale bar
    ...readHood(),
    voyages: style.voyages, voyageWidth: Number($('voyageWidth').value), // chosen in the voyages drawer
    overlay: style.overlay, overlayOpacity: style.overlayOpacity, // chosen in the charts drawer
  };
  // hills are the Catalan sprites: the chip selects all of them or none
  const hills = $('hills').value === 'catalan';
  if (hills !== CATALAN_KEYS.some((k) => selection.has(k))) for (const k of CATALAN_KEYS) hills ? selection.add(k) : selection.delete(k);
  view = clampView({ ...view, projection: $('projection').value });
  changed();
}
// Under the hood: the sheets chips and the knobs. A knob whose default is each band's own (rose share, roses per
// sheet) is unset until its slider is moved; its slider then rests at the narrow bands' value.
const KNOB_SLIDERS = { radius: 'tuneRadius', reach: 'tuneReach', roseshare: 'tuneRoseshare', sheetroses: 'tuneSheetroses' };
const KNOB_CHIPS = { origin: 'tuneOrigin', curated: 'tuneCurated', roselines: 'tuneRoselines' };
const BAND_OWN = { roseshare: `band's own: ${ROSE_SHARE}, ${WIDE.roseShare} wide`, sheetroses: `band's own: ${SHEET_ROSES}, ${WIDE.sheetRoses} wide` };
const KNOB_OUT = { radius: (v) => `${v} of sheet height`, reach: (v) => `${v} × diagonal`, roseshare: String, sheetroses: String };
for (const [name, id] of Object.entries(KNOB_SLIDERS)) Object.assign($(id), { min: TUNE_KNOBS[name].min, max: TUNE_KNOBS[name].max });
function showHood() {
  $('debug').value = style.debug || 'off';
  const t = parseTune(style.tune).tune, at = (name) => t[name] ?? TUNE_KNOBS[name].def;
  for (const [name, id] of Object.entries(KNOB_CHIPS)) $(id).value = String(at(name));
  for (const [name, id] of Object.entries(KNOB_SLIDERS)) {
    const v = at(name), el = $(id);
    el.value = v ?? { roseshare: ROSE_SHARE, sheetroses: SHEET_ROSES }[name];
    if (v == null) delete el.dataset.set; else el.dataset.set = '1';
    $(`${id}Out`).textContent = v == null ? BAND_OWN[name] : KNOB_OUT[name](v);
  }
}
function readHood() {
  const pairs = [...Object.entries(KNOB_CHIPS).map(([name, id]) => [name, $(id).value]),
    ...Object.entries(KNOB_SLIDERS).filter(([, id]) => $(id).dataset.set).map(([name, id]) => [name, $(id).value])];
  return { debug: parseDebug($('debug').value).text, tune: parseTune(pairs.map(([n, v]) => `${n}:${v}`).join(',')).text };
}
function changed() {
  showStyle();
  writeHash();
  render();
}

// ---------------------------------------------------------------- the other drawers (?ui=presets, ?ui=grid)

// The default drawer has no flag. `?ui=presets` offers a few named presets and one master switch per kind of
// decoration; `?ui=grid` a compact grid of every figure with a whole-set toggle for each family. Both read
// and write the same selection and style as the default drawer, so the link carries the same hash. The flag
// is in the query, which the hash writes, Reset and Copy link leave alone, and the phone's bottom sheet shows.
const UI = ['presets', 'grid'].find((u) => u === new URLSearchParams(location.search).get('ui')) ?? null;
const KIND_UI = [['monster', 'Monsters'], ['ship', 'Ships'], ['rose', 'Roses'], ['town', 'Towns'], ['mountain', 'Hill drawings'], ['cartouche', 'Cartouche']];
const kindKeys = (kind) => SPRITES.filter((s) => s.kind === kind).map((s) => s.key);
const sampleOf = (s) => {
  const el = document.createElement('span');
  el.className = 'sample';
  if (s.file) el.append(Object.assign(new Image(), { src: `packs/${s.pack}/${s.file}`, alt: '', decoding: 'async' }));
  else el.innerHTML = GLYPHS[s.id] ?? towerGlyph(s.id);
  return el;
};
const glyphSample = (html) => Object.assign(document.createElement('span'), { className: 'sample', innerHTML: html });
const chipButton = (role, ...kids) => {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'chip' });
  b.setAttribute('role', role);
  b.append(...kids);
  return b;
};
// Every group of independent toggles has a Clear (none on) and, where its default is not none, a Defaults
// (back to the default set); each greyed when the group is already so. `get` reads the group's keys that are on,
// `set` puts a list of keys on in their place.
const CLEAR_GLYPH = svg(`<rect x="4" y="3" width="20" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 2"/><path d="M10 6l8 6M18 6l-8 6" ${stroke('currentColor', 1.2)}/>`);
const RESET_GLYPH = svg(`<path d="M9 5.5a5 5 0 1 1-1.6 4" ${stroke('currentColor', 1.3)}/><path d="M9 2v3.5H5.5" ${stroke('currentColor', 1.3)}/>`);
const DEFAULT_KEYS = new Set(DEFAULT_SELECTION);
const toolRefreshers = [];
function groupTools(label, { all, dflt, get, set }) {
  const row = document.createElement('div');
  row.className = 'tools';
  const same = (a, b) => a.length === b.length && a.every((k) => b.includes(k));
  for (const [name, glyph, keys, note] of [['Clear', CLEAR_GLYPH, [], 'none'], ...(dflt.length ? [['Defaults', RESET_GLYPH, dflt, 'the default set']] : [])]) {
    const b = Object.assign(chipButton('button', glyphSample(glyph), name), { title: `${label}: ${note}` });
    b.classList.add('tool');
    b.addEventListener('click', () => set(keys));
    row.append(b);
    toolRefreshers.push(() => { b.disabled = same([...get()].sort(), [...keys].sort()) || !all().length; });
  }
  return row;
}
// the figures of a kind, by their sprite keys
const spriteTools = (label, keys) => groupTools(label, {
  all: () => keys, dflt: keys.filter((k) => DEFAULT_KEYS.has(k)), get: () => keys.filter((k) => selection.has(k)),
  set: (on) => { for (const k of keys) selection.delete(k); for (const k of on) selection.add(k); changed(); },
});
for (const [kind, label] of [['monster', 'Monsters'], ['ship', 'Ships'], ['rose', 'Roses'], ['town', 'Towns'], ['mountain', 'Hill drawings']]) {
  $(kind === 'mountain' ? 'pick-relief' : `pick-${kind}`).prepend(spriteTools(label, SPRITES.filter((s) => s.kind === kind).map((s) => s.key)));
}

// the style switches: off, or the default (the first drawn style where the default is off)
const STYLE_SWITCHES = [
  ['mountains', 'Mountain style', MOUNTAIN_GLYPHS.colour], ['trees', 'Trees', TREE_GLYPHS.marina],
  ['rivers', 'Rivers', RIVER_GLYPHS.plain], ['lakes', 'Lakes', LAKE_GLYPHS.marina],
];
let showUiNow = () => {};
let showMoods = () => {}; // the layout Moods: its chips show which look is on
if (UI) {
  document.documentElement.dataset.ui = UI;
  $('ui').hidden = false;
  const body = $('ui-body'), refreshers = [], DEFAULT_SET = new Set(DEFAULT_SELECTION);
  const sample = (kinds, set) => kinds.map((k) => SPRITES.find((s) => s.kind === k && set.has(s.key))).filter(Boolean);
  const kindOn = (kind) => kindKeys(kind).some((k) => selection.has(k));
  const setKind = (kind, on) => {
    const keys = kindKeys(kind), dflt = keys.filter((k) => DEFAULT_SET.has(k));
    for (const k of keys) selection.delete(k);
    if (on) for (const k of dflt.length ? dflt : keys) selection.add(k);
    changed();
  };
  if (UI === 'presets') {
    const scan = new Set(['scanned', 'debry']);
    const ofPack = (pred) => new Set(SPRITES.filter((s) => (DEFAULT_SET.has(s.key) || s.pack === 'plain') && pred(s)).map((s) => s.key));
    const PRESETS = [
      ['everything', 'Everything', 'the default: every figure the chart draws', () => new Set(DEFAULT_SET)],
      ['scans', 'Scans', 'figures cut from the old charts, with the default cartouche', () => ofPack((s) => scan.has(s.pack) || (s.kind === 'cartouche' && s.pack === 'vivid'))],
      ['drawn', 'Drawn', 'the vector redrawings', () => ofPack((s) => s.pack === 'vivid')],
      ['plain', 'Plain', 'a rose, a cartouche and tower towns, drawn in code', () => new Set(SPRITES.filter((s) => s.pack === 'plain').map((s) => s.key))],
      ['bare', 'Bare chart', 'a rose and a cartouche, no creatures or towns', () => new Set(SPRITES.filter((s) => DEFAULT_SET.has(s.key) && ['rose', 'cartouche'].includes(s.kind) && s.pack === 'vivid').map((s) => s.key))],
    ];
    body.insertAdjacentHTML('beforeend', '<h3>Presets</h3><div class="presets" role="radiogroup" aria-label="Preset"></div><h3>Switches</h3><div class="switches" role="group" aria-label="Decorations"></div>');
    const presets = body.querySelector('.presets'), switches = body.querySelector('.switches');
    const decoKeys = SPRITES.filter((s) => KIND_UI.some(([k]) => k === s.kind)).map((s) => s.key);
    const styleOn = () => STYLE_SWITCHES.filter(([id]) => style[id] !== 'off').map(([id]) => `style:${id}`);
    switches.before(groupTools('Decorations', {
      all: () => decoKeys, dflt: [...decoKeys.filter((k) => DEFAULT_SET.has(k)), ...STYLE_SWITCHES.filter(([id]) => DEFAULTS[id] !== 'off').map(([id]) => `style:${id}`)],
      get: () => [...decoKeys.filter((k) => selection.has(k)), ...styleOn()],
      set: (on) => {
        for (const k of decoKeys) selection.delete(k);
        for (const k of on) if (!k.startsWith('style:')) selection.add(k);
        for (const [id] of STYLE_SWITCHES) $(id).value = on.includes(`style:${id}`) ? DEFAULTS[id] : 'off';
        $('hills').value = CATALAN_KEYS.some((k) => selection.has(k)) ? 'catalan' : 'off'; // readControls reads the hills from their chip
        readControls();
      },
    }));
    for (const [id, label, note, make] of PRESETS) {
      const set = make(), strip = document.createElement('span');
      strip.className = 'sample';
      for (const s of sample(['monster', 'ship', 'rose', 'town', 'cartouche'], set).slice(0, 4)) strip.append(...sampleOf(s).children);
      const b = chipButton('radio', strip, Object.assign(document.createElement('b'), { textContent: label }), Object.assign(document.createElement('small'), { textContent: `${note}` }));
      b.classList.add('preset'); b.title = `${label}: ${note}`;
      b.addEventListener('click', () => { selection = make(); changed(); });
      presets.append(b);
      refreshers.push(() => b.setAttribute('aria-checked', String(sameSet(selection, make()))));
    }
    for (const [kind, label] of KIND_UI) {
      const first = SPRITES.find((s) => s.kind === kind && DEFAULT_SET.has(s.key)) ?? SPRITES.find((s) => s.kind === kind);
      const b = chipButton('switch', sampleOf(first), label);
      b.classList.add('switch'); b.title = `${label}: all on or all off`;
      b.addEventListener('click', () => setKind(kind, !kindOn(kind)));
      switches.append(b);
      refreshers.push(() => b.setAttribute('aria-checked', String(kindOn(kind))));
    }
    for (const [id, label, glyph] of STYLE_SWITCHES) {
      const b = chipButton('switch', glyphSample(glyph), label);
      b.classList.add('switch'); b.title = `${label}: on or off`;
      b.addEventListener('click', () => {
        $(id).value = style[id] !== 'off' ? 'off' : DEFAULTS[id] !== 'off' ? DEFAULTS[id] : CHOICES[id].find(([v]) => v !== 'off')[0];
        readControls();
      });
      switches.append(b);
      refreshers.push(() => b.setAttribute('aria-checked', String(style[id] !== 'off')));
    }
  } else {
    for (const [kind, label] of KIND_UI.filter(([k]) => k !== 'cartouche')) { // the cartouche is one of its pictures: its own section below
      const all = kindKeys(kind), box = document.createElement('div'), head = document.createElement('div'), count = document.createElement('span'), fams = document.createElement('div'), grid = document.createElement('div');
      box.className = 'gk'; head.className = 'gh'; count.className = 'count'; fams.className = 'gf'; grid.className = 'gg';
      const whole = chipButton('switch', 'All');
      whole.title = `${label}: every figure on or off`;
      whole.addEventListener('click', () => { const on = all.every((k) => selection.has(k)); for (const k of all) on ? selection.delete(k) : selection.add(k); changed(); });
      head.append(label, count, whole);
      for (const fam of familiesOf(kind)) {
        const keys = fam.sprites.map((s) => s.key), n = document.createElement('span');
        const b = chipButton('checkbox', sampleOf(fam.sprites[0]), fam.label, n);
        n.style.cssText = 'font:11px system-ui,sans-serif;color:var(--muted)';
        b.title = `${fam.label}: the whole set on or off`;
        b.addEventListener('click', () => { const on = keys.every((k) => selection.has(k)); for (const k of keys) on ? selection.delete(k) : selection.add(k); changed(); });
        fams.append(b);
        grid.append(...fam.sprites.map((s) => thumb(s, fam.label)));
        refreshers.push(() => { const on = keys.filter((k) => selection.has(k)).length; b.setAttribute('aria-checked', on === keys.length ? 'true' : on ? 'mixed' : 'false'); n.textContent = `${on}/${keys.length}`; });
      }
      refreshers.push(() => { const on = all.filter((k) => selection.has(k)).length; whole.setAttribute('aria-checked', String(on === all.length)); count.textContent = `${on} of ${all.length}`; });
      box.append(head, spriteTools(label, all), fams, grid);
      body.append(box);
    }
  }
  showUiNow = () => { for (const f of refreshers) f(); };
}

let layout = layoutFromHash();
let view = viewFromHash();
let style = styleFromHash();
let selection = selectionFromHash();
showStyle();
if (LEGACY_KEYS.some((k) => hashParams().has(k))) writeHash(); // an older link, rewritten in the new form
let ground = null; // { world, coarse, bg, anchored } from the last placement, all a moving frame needs
let placed = null; // the view the canvas shows with its ornaments
let pinTitle = null; // the name of the place last flown to, on the cartouche until the map is moved by hand
let run = 0;

async function render() {
  const me = ++run;
  try {
    const t0 = performance.now();
    // a kind is drawn while any of its sprites is selected
    const kinds = KINDS.filter((k) => SPRITES.some((s) => s.kind === k && selection.has(s.key)));
    const { scene, data, bg, world, coarse, timing } = await createScene(env, {
      ...style, ...parsePlacement(style.placement), relief: style.mountains === 'colour' ? ['marina'] : style.mountains === 'ink' ? ['engraved'] : [],
      continents: style.continentsZoom > 0, continentsZoom: style.continentsZoom,
      regions: style.regionsZoom > 0 ? style.regions : 'off', regionsZoom: style.regionsZoom,
      sprites: [...selection], kinds, view, pinned: !phone.matches, pinTitle: style.autoTitle ? pinTitle : null,
      voyages: style.voyages.map((v) => ({ id: v.id, colour: v.colour ?? undefined, width: style.voyageWidth })),
      overlay: style.overlay ? { id: style.overlay, opacity: style.overlayOpacity } : null,
      debug: parseDebug(style.debug).debug, tune: parseTune(style.tune).tune,
    });
    if (me !== run) return; // a newer change or a move superseded this one
    ground = { world, coarse, bg, voyages: scene.voyages, anchored: anchorScene(scene, data), overlay: scene.overlay, cards: { cartouche: kinds.includes('cartouche') ? scene.cartouche : null, scaleSprite: scene.scaleSprite, scale: style.scale, bg } };
    if (style.autoTitle) $('title').value = scene.cartouche.title; // the box shows what the cartouche letters, and cannot be edited
    placed = view;
    hideTile(); // its mark may be gone: another voyage, or none
    cancelAnimationFrame(frame); frame = 0; // a moving frame still queued would paint over the scene
    const t1 = performance.now();
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, scene, data, bg, { scale: 1, x: 0, y: 0 });
    drawCards();
    const t2 = performance.now();
    $('status').textContent = `z${view.zoom.toFixed(1)}: load ${timing.load.toFixed(0)} ms, placement + parchment ${timing.place.toFixed(0)} ms, draw ${(t2 - t1).toFixed(0)} ms (total ${(t2 - t0).toFixed(0)} ms)`;
  } catch (e) {
    $('status').textContent = `Failed: ${e.message}`;
    throw e;
  }
}

// The cards: the cartouche at the top of the window and the scale bar at the foot of the map, each on a
// canvas of its own, drawn at the sheet's size and shown at 1.1 times the sheet's scale on the page.
const cardCartouche = $('cardCartouche'), cardScale = $('cardScale');
function drawCards(scaleOnly = false) { // scaleOnly: a moving frame, where only the scale bar depends on the view
  const c = ground?.cards, on = phone.matches && c;
  cardCartouche.hidden = !(on && c.cartouche);
  cardScale.hidden = !(on && c.scale !== 'off');
  if (!on) return;
  const k = (innerWidth / 1600) * 1.1;
  if (c.cartouche && !scaleOnly) {
    if (cardCartouche.width !== Math.round(c.cartouche.w) || cardCartouche.height !== Math.round(c.cartouche.h)) { cardCartouche.width = Math.round(c.cartouche.w); cardCartouche.height = Math.round(c.cartouche.h); }
    cardCartouche.style.width = `${c.cartouche.w * k}px`;
    drawCartoucheCard(cardCartouche.getContext('2d'), c.cartouche, c.bg);
  }
  if (c.scale !== 'off') {
    cardScale.style.width = `${SCALE_CARD_W * k}px`;
    drawScaleCard(cardScale.getContext('2d'), viewProjection(view), c.bg, c.scale, c.scaleSprite);
  }
}
addEventListener('resize', () => { drawCards(); hideTile(); }); // the cards' width follows the window, in rotation too, and the tile was placed in its px
phone.addEventListener('change', () => { drawCards(); if (ground) render(); }); // the sheet is placed again with or without them

// ---------------------------------------------------------------- the drawers

// Six buttons in the row, each with its own drawer: the rose the settings, the chart the charts, the
// astrolabe the points of interest, the compass Go, the dividers the voyages, the anchor the anchorages.
// At most one is open. A click on a button opens its drawer and a second click shuts it; a click on another
// button shuts it and opens that one; a choice in it, Esc, or a click or a focus outside the row and the
// drawer shuts it. On a wide screen the drawer hangs below the row, which it never covers or moves, and a
// touch on the map shuts it; on a phone it is a bottom sheet with the map shrunk above it, and it stays up
// while the map is moved: that is how a control's effect is seen. An open drawer takes the focus (Go its
// text box, on a wide screen only, so a phone's keyboard does not cover the sheet); shut by the keyboard,
// the focus goes back to its button.
const where = $('where');
const drawers = [[$('open'), $('drawer')], [$('charts'), $('chartsDrawer')], [$('sights'), $('sightsPanel')], [$('go'), $('goPanel')], [$('voyages'), $('voyagesPanel')], [$('anchor'), $('anchorPanel')]];
const openDrawer = () => drawers.find(([, d]) => d.classList.contains('open'))?.[1] ?? false;
const focusable = (d) => [...d.querySelectorAll('button, input, a[href]')].find((e) => !e.disabled && e.getClientRects().length);
function setDrawer(open, byKeyboard = false) { // the drawer to open, or false for none
  const was = openDrawer();
  if (open === was) return;
  for (const [b, d] of drawers) { d.classList.toggle('open', d === open); b.setAttribute('aria-expanded', String(d === open)); }
  document.documentElement.classList.toggle('sheet', !!open && !open.classList.contains('menu')); // on a phone the map makes room above the settings or the charts; a lighter drawer sits over its foot
  if (open?.id === 'voyagesPanel') fillVoyages(); // the list loads on the first open
  if (open) (open.id === 'goPanel' ? (phone.matches ? null : $('coordsText')) : focusable(open))?.focus({ preventScroll: true });
  else if (byKeyboard) drawers.find(([, d]) => d === was)[0].focus({ preventScroll: true });
  else if (was.contains(document.activeElement)) document.activeElement.blur(); // a phone's keyboard goes with it
}
for (const [b, d] of drawers) b.addEventListener('click', (e) => setDrawer(d === openDrawer() ? false : d, e.detail === 0)); // detail 0: Enter or Space
addEventListener('keydown', (e) => { if (e.key === 'Escape' && openDrawer()) setDrawer(false, true); });
const outside = (t) => { const d = openDrawer(); return d && t instanceof Node && !where.contains(t) && !d.contains(t); };
// On a phone the settings and the charts stay up while the map is moved; a lighter drawer shuts as on a wide screen.
addEventListener('pointerdown', (e) => { if (outside(e.target) && !(phone.matches && e.target === canvas && !openDrawer().classList.contains('menu'))) setDrawer(false); });
addEventListener('focusout', (e) => { if (e.relatedTarget && outside(e.relatedTarget)) setDrawer(false); }); // tabbed out; a click that focuses nothing has no relatedTarget

// Reset: every control back to its default, the place and the drawer's layout kept. The hash holds the whole
// style, so a hash with only the view is the default style; the hashchange handler below redraws from it.
$('reset').addEventListener('click', () => {
  const m = hashParams().get('map');
  $('shareUrl').hidden = true; $('shareNote').textContent = '';
  location.hash = [m && `map=${m}`, layout !== 'default' && `layout=${layout}`].filter(Boolean).join('&');
});
// Copy link: the hash is kept current by writeHash. Where the clipboard is refused (an insecure page,
// a denied permission) the link is put in a box, selected, to copy by hand.
$('copy').addEventListener('click', async () => {
  const url = $('shareUrl'), note = $('shareNote');
  url.value = location.href;
  try {
    await navigator.clipboard.writeText(location.href);
    url.hidden = true; note.textContent = 'Link copied';
  } catch {
    url.hidden = false; url.focus(); url.select();
    note.textContent = 'Could not copy automatically: the link is selected, press Ctrl+C';
  }
});

// Placement: the chips choose how the ornaments are placed; the choice rides in the link (`placement=`).
// Re-roll takes a new seed and keeps it in the link, so an arrangement can be kept and shared.
const PLACEMENT_CHIPS = [...document.querySelectorAll('#placement [data-placement]')];
function showPlacement() {
  const now = parsePlacement(style.placement).text, seeded = now.startsWith('seed:');
  for (const c of PLACEMENT_CHIPS) c.setAttribute('aria-checked', String(c.dataset.placement === (seeded ? 'reroll' : now || 'default')));
}
for (const c of PLACEMENT_CHIPS) c.addEventListener('click', () => {
  const v = c.dataset.placement;
  style = { ...style, placement: v === 'reroll' ? `seed:${(Math.random() * 2 ** 31) | 0}` : v === 'default' ? '' : v };
  showPlacement(); changed();
});

// ---------------------------------------------------------------- the layouts (layout=)

// Four arrangements of the same controls, chosen by a chip at the drawer's top and kept in the link, so each
// is a link to share. Default is the drawer as index.html lays it out. The others move each control (a .ctl,
// with the lead paragraph written for it) into groups of their own and back again, so a control is one
// element and one hash key whichever layout shows it.
const LAND_GROUP = ['continents', 'regions', 'land', 'colour', 'rivers', 'lakes', 'mountains', 'hills', 'trees', 'towns'];
const BY_QUESTION = [['The chart', ['cartouche', 'projection', 'names', 'rhumb', 'scale', 'overlap']], ['The land', LAND_GROUP], ['The figures', ['density', 'monsters', 'ships', 'roses', 'placement', 'colours']]];
const LAYOUTS = {
  default: { label: 'Default', note: 'the drawer by kind of thing: sea, roses, towns, land, cartouche, map, colours',
    glyph: svg(`<path d="M3 3h22M3 6.5h15M3 10h22M3 13.5h12M3 17h18" ${stroke('currentColor', 1)}/>`) },
  question: { label: 'By question', note: 'three groups: the chart, the land, the figures', groups: BY_QUESTION,
    glyph: svg(`<rect x="2" y="1.5" width="24" height="4" rx="1.5" ${stroke('currentColor', 1)}/><rect x="2" y="7" width="24" height="4" rx="1.5" ${stroke('currentColor', 1)}/><rect x="2" y="12.5" width="24" height="4" rx="1.5" ${stroke('currentColor', 1)}/>`) },
  moods: { label: 'Moods', note: 'five looks at a click, every control under Fine controls', groups: BY_QUESTION, moods: true,
    glyph: svg(`<rect x="1.5" y="2" width="4.4" height="7" rx="2.2" fill="currentColor"/>${[6.8, 12.1, 17.4, 22.7].map((x) => `<rect x="${x}" y="2" width="4.4" height="7" rx="2.2" ${stroke('currentColor', 0.8)}/>`).join('')}<path d="M3 12.5l2 2 2-2M9 13.5h16" ${stroke('currentColor', 0.8)}/>`) },
  sheet: { label: 'By the sheet', note: 'where it is drawn: the sea, the land, the margins',
    groups: [['Sea', ['monsters', 'ships', 'density', 'placement']], ['Land', LAND_GROUP], ['Margins', ['cartouche', 'scale', 'roses', 'overlap', 'rhumb', 'names', 'projection', 'colours']]],
    glyph: svg(`<rect x="1.5" y="1.5" width="25" height="15" ${stroke('currentColor', 1)}/><rect x="4" y="4" width="20" height="10" ${stroke('currentColor', 0.5)}/><path d="M14 5q5 0 8 3t-3 5h-5q-2-4 0-8Z" fill="#c47f2c" fill-opacity=".75"/><path d="M5.5 8q1.5-1.5 3 0t3 0M5.5 11q1.5-1.5 3 0" ${stroke('#4a7fa0', 0.8)}/>`) },
};
const CTLS = new Map([...document.querySelectorAll('#drawer .ctl')].map((el) => [el.dataset.ctl, el]));
const LEADS = new Map([...document.querySelectorAll('#drawer [data-lead-for]')].map((el) => [el.dataset.leadFor, el]));
// each moved node's place in Default, marked by an empty comment before it
const HOMES = new Map([...CTLS.values(), ...LEADS.values()].map((el) => { const at = document.createComment(''); el.before(at); return [el, at]; }));
for (const [name, { label, note, glyph }] of Object.entries(LAYOUTS)) {
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'chip', title: `${label}: ${note}` });
  b.dataset.layout = name;
  b.setAttribute('role', 'radio');
  b.insertAdjacentHTML('beforeend', glyph);
  b.append(label);
  b.addEventListener('click', () => { if (layout !== name) { layout = name; showLayout(); writeHash(); } });
  $('layout').append(b);
}

// Moods: five whole looks at a click, sparse to dense, and every control under Fine controls. A mood sets the
// density, the placement, the figures and every style of the land, the water and the colours, each at its default
// where the mood does not depart from it, so a mood replaces the whole look another left. Figures are named as the
// hash names them (v:merman). All the things: every figure of every kind (the cartouche as chosen), the density at
// the top, a new seed.
const FIGURE_KINDS = ['monster', 'ship', 'rose', 'town', 'mountain'];
const FIGURES = SPRITES.filter((s) => FIGURE_KINDS.includes(s.kind)).map((s) => s.key);
const DEFAULT_SET = new Set(DEFAULT_SELECTION);
const MOOD_STYLES = ['land', 'islands', 'seaTint', 'rivers', 'lakes', 'mountains', 'trees', 'ink', 'parchment'];
const PLAIN_LOOK = Object.fromEntries(MOOD_STYLES.map((k) => [k, DEFAULTS[k]]));
const HILLS = ['v:mountains-a', 'v:mountains-b', 'v:mountains-c'];
const AGUIAR_SCAN = ['venice', 'genoa', 'lisbon', 'lake', 'lake-moat', 'smina', 'jerusalem', 'ceuta', 'avignon'].map((t) => `s:town-aguiar-${t}`);
const AGUIAR_DRAWN = ['walled', 'walled-2', 'walled-3', 'hall', 'hall-2', 'hall-3', 'towers', 'towers-2', 'towers-3', 'hill', 'hill-2', 'hill-3', 'church', 'church-2', 'church-3', 'gate', 'gate-2', 'gate-3', 'venice', 'moat'].map((t) => `v:town-aguiar-${t}`);
// a look with fixed figures, at the charts' own places; its chip shows the first of its figures of each of `kinds`
const fixedMood = (label, note, kinds, figures, styles) => {
  const look = { ...PLAIN_LOOK, placement: 'historic', ...styles }, keys = figures.map(decodeKey).filter((k) => BY_KEY.has(k));
  return { label, note, kinds, keys, set: () => ({ ...look, selection: new Set(keys) }),
    is: () => Object.entries(look).every(([k, v]) => style[k] === v) && sameSet(selection, new Set(keys)) };
};
const MOODS = [
  fixedMood('Pilot’s chart', 'lines, names and a plain rose: the working chart, nothing drawn on it', ['rose'],
    ['p:rose'], { density: 0, land: 'off', rivers: 'off', lakes: 'off', mountains: 'off', trees: 'off' }),
  fixedMood('Tasteful', 'Majorcan: a Catalan rose, coloured islands, tinted seas, hills, a few figures, at half density', ['rose', 'monster', 'mountain'],
    ['s:rose-catalan', 'v:rose-catalan', 'v:cartouche-frame', 'v:merman', 'v:hippocampus', 'v:galley', 'v:caravel', ...HILLS, ...AGUIAR_SCAN],
    { density: 0.5, islands: true, seaTint: true, mountains: 'off' }), // the Catalan hills carry the relief
  fixedMood('Woodcut', 'printed: ink on paper, the Carta Marina’s and Paré’s creatures, hatched mountains', ['monster', 'ship'],
    ['p:rose', 's:cartouche-dewit', 's:serpent-a', 's:whale-b', 's:pistrix-c', 's:cete-e', 's:pare-truie', 's:pare-boar', 's:pare-lion', 's:pare-calf', 's:pare-elephant', 's:pare-bear', 's:pare-seaman', 's:pare-bishop', 'd:debry-monster', 's:ship-a', 's:ship-b', 's:ship-w-key', 's:ship-w-buss', 'd:debry-ship-a', 'd:debry-ship-b', 'd:debry-canoe', 'p:tower', 'p:tower-dome', 'p:house', 'p:church', 'p:castle', 'p:round-tower', 'p:tent'],
    { density: 1, land: 'off', rivers: 'marina', lakes: 'marina', mountains: 'ink', trees: 'ink', ink: '#1d1913', parchment: '#efe9dc' }),
  fixedMood('Illuminated', 'gilt land, blue rivers, coloured islands, the scanned roses, every Aguiar town', ['rose', 'monster', 'town'],
    ['s:rose-aguiar', 's:rose-catalan', 's:rose-prunes', 's:rose-aguiar-b', 'v:rose-fleurs', 'v:rose-fleurs-small', 'v:cartouche-frame', 'v:sea-dragon', 'v:sea-lion', 'v:dolphin', 'v:merman', 'v:hippocampus', 'v:walrus', 'v:galleon', 'v:caravel-heraldic', 'v:carrack', 'v:galley', 'v:caravel', ...HILLS, ...AGUIAR_SCAN, ...AGUIAR_DRAWN],
    { density: 1.5, land: 'gilt', islands: true, seaTint: true, rivers: 'aguiar', lakes: 'aguiar', mountains: 'colour', trees: 'marina' }),
  { label: 'All the things', note: 'density 2, re-rolled, every figure on, the styles at their defaults', kinds: FIGURE_KINDS, keys: FIGURES, all: true,
    set: () => {
      const cartouche = CARTOUCHES.filter((k) => selection.has(k));
      return { ...PLAIN_LOOK, density: 2, placement: `seed:${(Math.random() * 2 ** 31) | 0}`, selection: new Set([...FIGURES, ...(cartouche.length ? cartouche : CARTOUCHES.filter((k) => DEFAULT_SET.has(k)))]) };
    },
    is: () => style.density === 2 && style.placement.startsWith('seed:') && FIGURES.every((k) => selection.has(k)) && MOOD_STYLES.every((k) => style[k] === PLAIN_LOOK[k]) },
];
const moods = Object.assign(document.createElement('div'), { className: 'presets moods' });
moods.setAttribute('role', 'radiogroup'); moods.setAttribute('aria-label', 'Mood');
for (const m of MOODS) {
  const strip = document.createElement('span');
  strip.className = 'sample';
  // a figure of each kind it shows, the first of its own; for All the things one from outside the default set
  for (const kind of m.kinds) {
    const of = m.keys.map((k) => BY_KEY.get(k)).filter((s) => s.kind === kind), pick = (m.all ? of.filter((s) => !DEFAULT_SET.has(s.key)) : []).concat(of)[0];
    if (pick) strip.append(...sampleOf(pick).children);
  }
  const b = chipButton('radio', strip, Object.assign(document.createElement('b'), { textContent: m.label }), Object.assign(document.createElement('small'), { textContent: m.note }));
  b.classList.add('preset'); b.title = `${m.label}: ${m.note}`;
  b.addEventListener('click', () => {
    const { selection: next, ...look } = m.set();
    style = { ...style, ...look };
    selection = next;
    showPlacement(); changed();
  });
  moods.append(b);
}
showMoods = () => { MOODS.forEach((m, i) => moods.children[i].setAttribute('aria-checked', String(m.is()))); };
const fine = document.createElement('details'); // closed until opened, and kept as it was across a switch
fine.className = 'fine';
fine.append(Object.assign(document.createElement('summary'), { textContent: 'Fine controls' }));

function showLayout() {
  const { groups, moods: withMoods } = LAYOUTS[layout];
  if (groups) document.documentElement.dataset.layout = layout; else delete document.documentElement.dataset.layout;
  for (const c of $('layout').children) c.setAttribute('aria-checked', String(c.dataset.layout === layout));
  for (const [el, at] of HOMES) at.after(el); // every control home first
  for (const s of document.querySelectorAll('#drawer section.home')) s.hidden = !!groups;
  const box = $('layoutGroups');
  for (const s of fine.querySelectorAll('section')) s.remove();
  box.replaceChildren();
  box.hidden = !groups;
  if (!groups) return;
  const into = withMoods ? fine : box;
  if (withMoods) box.append(moods, fine);
  groups.forEach(([title, ids], i) => {
    const sec = document.createElement('section'), h = Object.assign(document.createElement('h2'), { id: `h-layout-${i}`, textContent: title });
    sec.setAttribute('aria-labelledby', h.id);
    sec.append(h);
    for (const id of ids) sec.append(...[LEADS.get(id), CTLS.get(id)].filter(Boolean));
    into.append(sec);
  });
}
showMoods(); showLayout();

// ---------------------------------------------------------------- moving

let frame = 0, settle = 0;
function moved(next, flying = false) {
  if (next.zoom === view.zoom && next.lon === view.lon && next.lat === view.lat) return; // e.g. wheel at a zoom bound
  if (!flying) pinTitle = null; // a drag or a wheel leaves the place flown to
  view = next;
  hideTile();
  run++; // a placement still in flight is for a view already left
  clearTimeout(settle);
  if (!ground || frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const t = performance.now();
    // the 10m cells placed last while they cover the view; 50m otherwise, until it stops and is placed again
    drawGround(ctx, covers(ground.world, view) ? ground.world : ground.coarse, view, ground.bg);
    drawAnchored(ctx, ground.anchored, ground.bg, view); // the placed ornaments, held to the earth
    drawCards(true);
    $('status').textContent = `z${view.zoom.toFixed(1)}: moving, frame ${(performance.now() - t).toFixed(1)} ms`;
  });
}
function stopped(delay = 0) {
  clearTimeout(settle);
  settle = setTimeout(() => { if (view !== placed) { writeHash(); render(); } }, delay); // a click moves nothing
}

// client px to canvas px, the units the view moves in
const toCanvas = (cx, cy) => {
  const r = canvas.getBoundingClientRect();
  return [(cx - r.left) * (W / r.width), (cy - r.top) * (H / r.height)];
};

const pointers = new Map(); // pointerId -> [x, y] in canvas px
let tap = null; // a lone pointer's start, [x, y] in canvas px, until it moves far enough to be a drag
const pinch = () => {
  const [[ax, ay], [bx, by]] = pointers.values();
  return { d: Math.hypot(bx - ax, by - ay), x: (ax + bx) / 2, y: (ay + by) / 2 };
};

// The cartouche and the scale bar are dragged to a corner of the map and stay there (cartouche=, scalepos=
// in the link). While one is held a dashed frame shows the corner it will take.
const snap = $('snap');
let carried = null; // { key: 'cartouchePos' | 'scalePos', w, h, corner } while one is being dragged
const cardAt = ([x, y]) => {
  if (phone.matches || !ground) return null;
  const c = ground.cards.cartouche, s = ground.cards.scale !== 'off' ? scaleRect() : null;
  const hit = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  if (hit(s)) return { key: 'scalePos', w: s.w, h: s.h };
  if (hit(c)) return { key: 'cartouchePos', w: c.w, h: c.h };
  return null;
};
const cornerAt = ([x, y]) => `${y < H / 2 ? 't' : 'b'}${x < W / 2 ? 'l' : 'r'}`;
function showSnap(corner, w, h) {
  const r = canvas.getBoundingClientRect(), kx = r.width / W, ky = r.height / H, m = 14;
  Object.assign(snap.style, { display: 'block', width: `${w * kx}px`, height: `${h * ky}px`,
    left: `${r.left + (corner[1] === 'l' ? m : W - m - w) * kx}px`, top: `${r.top + (corner[0] === 't' ? m : H - m - h) * ky}px` });
}
canvas.addEventListener('pointerdown', (e) => {
  cancelAnimationFrame(flight); // a touch takes over from a flight
  if (!pointers.size && e.isPrimary && (carried = cardAt(toCanvas(e.clientX, e.clientY)))) {
    carried.corner = style[carried.key];
    canvas.setPointerCapture(e.pointerId);
    showSnap(carried.corner, carried.w, carried.h);
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, toCanvas(e.clientX, e.clientY));
  tap = pointers.size === 1 ? pointers.get(e.pointerId) : null;
  hideTile();
  clearTimeout(settle);
});
canvas.addEventListener('pointermove', (e) => {
  if (carried) { carried.corner = cornerAt(toCanvas(e.clientX, e.clientY)); showSnap(carried.corner, carried.w, carried.h); return; }
  if (!pointers.size) { canvas.style.cursor = cardAt(toCanvas(e.clientX, e.clientY)) ? 'grab' : ''; return; }
  if (!pointers.has(e.pointerId)) return;
  const p = toCanvas(e.clientX, e.clientY);
  if (tap && Math.hypot(p[0] - tap[0], p[1] - tap[1]) > cssPx(TAP_SLOP)) tap = null;
  if (pointers.size === 2) {
    const before = pinch();
    pointers.set(e.pointerId, p);
    const after = pinch();
    moved(zoomView(panView(view, after.x - before.x, after.y - before.y), after.d / before.d, after.x, after.y));
  } else if (pointers.size === 1) {
    const [x, y] = pointers.get(e.pointerId);
    pointers.set(e.pointerId, p);
    moved(panView(view, p[0] - x, p[1] - y));
  }
});
const lift = (e) => {
  if (carried) { // dropped: the corner is kept, the sheet placed again
    const { key, corner } = carried;
    carried = null; snap.style.display = 'none';
    if (e.type === 'pointerup' && style[key] !== corner) { style = { ...style, [key]: corner }; writeHash(); render(); }
    return;
  }
  if (!pointers.delete(e.pointerId)) return;
  if (pointers.size === 0) stopped();
};
canvas.addEventListener('pointerup', (e) => {
  const at = tap; tap = null;
  lift(e);
  if (at && view === placed) showTileAt(at);
});
canvas.addEventListener('pointercancel', (e) => { tap = null; lift(e); });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cancelAnimationFrame(flight); // the wheel takes over from a flight
  const [x, y] = toCanvas(e.clientX, e.clientY);
  const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines to px
  moved(zoomView(view, 2 ** (-px / 300), x, y));
  stopped(300);
}, { passive: false });

// ---------------------------------------------------------------- the tile

// A click or tap on a point of interest opens a small tile beside it with what there is to know: its heading,
// date, text and source. Nothing is lettered beside the mark itself. Today the points of interest are the
// voyages' events (scripts/scene.mjs voyageMarks); the tile takes any { title, date, text, source }.
// It shuts on the next touch of the map, on Esc, on its own close button, or when the map moves.
const TAP_SLOP = 8, TAP_REACH = 22; // CSS px, so a finger is as forgiving on a phone's small canvas as a mouse on a wide one: a touch that stays within the slop is a tap; a mark takes a tap within the reach
const cssPx = (n) => n * (W / canvas.getBoundingClientRect().width); // CSS px to the canvas px the view moves in
const tileEl = $('tile');
function hideTile() { tileEl.hidden = true; }
function fillTile(t) {
  const part = (cls, text) => { if (!text) return null; const p = document.createElement('p'); p.className = cls; p.textContent = text; return p; };
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'tile-close'; close.setAttribute('aria-label', 'Close'); close.textContent = '×';
  close.addEventListener('click', hideTile);
  const head = part('tile-title', t.title);
  const meta = part('tile-date', [t.date, t.alternative ? 'another account' : null].filter(Boolean).join(' · '));
  const text = part('tile-text', t.text);
  if (t.link) { // a note on the Carta Marina: what was drawn, what was there, and the source as a link
    const labelled = (label, body) => { const p = part('tile-text', body); const b = document.createElement('strong'); b.textContent = `${label} `; p.prepend(b); return p; };
    const a = document.createElement('a');
    a.href = t.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = t.source;
    const src = document.createElement('p'); src.className = 'tile-source'; src.append('Source: ', a);
    tileEl.replaceChildren(close, head, labelled('Drawn.', t.drawn), labelled('Really.', t.real), src);
    tileEl.setAttribute('aria-label', t.title);
    return;
  }
  const source = part('tile-source', t.source && `Source: ${t.source}`);
  tileEl.replaceChildren(close, ...[head, meta, text, source].filter(Boolean));
  tileEl.setAttribute('aria-label', t.title ?? 'Point of interest');
}
// every listed place with a tile, once by name, at the view its button flies to
let sightList = null;
function sightTiles() {
  sightList ??= [...new Map([...places.map(({ name, view: v }) => [name, v]), ...CHARTS.map(({ made }) => [made.title, made])]).entries()]
    .filter(([name]) => SIGHT_TILES[name]).map(([name, v]) => { const { at, ...tile } = SIGHT_TILES[name]; return { lon: at?.[0] ?? v.lon, lat: at?.[1] ?? v.lat, tile: { title: name, ...tile } }; });
  return sightList;
}
function showTileAt([x, y]) {
  const proj = viewProjection(placed), rect = { x0: 0, y0: 0, x1: W, y1: H };
  const marks = [...(ground?.voyages ?? []).flatMap((v) => voyageMarks(v.voyage, proj, rect)), ...(placed.zoom >= POI_ZOOM ? sightMarks(sightTiles(), proj, rect) : []), ...noteMarks(ground?.overlay, proj, rect)];
  let best = null, bestD = Infinity;
  for (const m of marks) { const d = Math.hypot(m.x - x, m.y - y); if (d <= Math.max(cssPx(TAP_REACH), m.h / 2) && d < bestD) { best = m; bestD = d; } }
  if (!best) return;
  fillTile(best.tile);
  // beside the mark, in client px: below and to its right, flipped inside the window where that would run off it
  const r = canvas.getBoundingClientRect(), cx = r.left + best.x * (r.width / W), cy = r.top + best.y * (r.height / H);
  tileEl.hidden = false;
  const w = tileEl.offsetWidth, h = tileEl.offsetHeight, gap = best.h / 2 + 8;
  const left = cx + gap + w > innerWidth - 8 ? cx - gap - w : cx + gap;
  const top = cy + h > innerHeight - 8 ? cy - h : cy - 8;
  tileEl.style.left = `${Math.max(8, left)}px`; tileEl.style.top = `${Math.max(8, top)}px`;
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTile(); });

// ---------------------------------------------------------------- going somewhere

// The places: the anchorages (home first, then the world's regions, then the seas and islands worth the
// flight) and the points of interest (where the charts were made, the noteworthy ports by era, and the
// remote islands). The charts: each sheet's frame, from the centres read off the scans
// (docs/atlas/centres.md) and the frames of the scans the ornaments come from, and the city its school
// worked in. Each entry may carry a caption (`text`), shown under it; until it has one the line says
// "notes to come". Go finds any of them by name.
const around = (lon, lat, r) => viewOfFrame({ lonMin: lon - r, lonMax: lon + r, latMin: lat - r, latMax: lat + r });
const at = (lon, lat, zoom) => ({ lon, lat, zoom });
const both = (a, b) => viewOfFrame({ lonMin: a[0] - a[2], lonMax: b[0] + b[2], latMin: Math.min(a[1] - a[2], b[1] - b[2]), latMax: Math.max(a[1] + a[2], b[1] + b[2]) }); // two centres, west then east, on one sheet
const CAPTION = 'notes to come'; // the line under an entry until its caption is written
// A group: [heading, rows, sub] (an empty heading for none, sub for a heading under the one before);
// a row: [name, view, title, note, text], the title the cartouche's when it differs from the name.
const ANCHORAGES = [
  ['', [
    ['Home: the Mediterranean', DEFAULT_VIEW, 'The Mediterranean'],
    ['The world', at(10, 25, 0), 'The World'],
    ['The North', viewOfFrame({ lonMin: 0, lonMax: 40, latMin: 54, latMax: 72 })], // the Carta Marina's frame
  ]],
  ['Regions', [ // a view covers its whole frame and crops what overflows the window, so each frame is about the window's shape
    ['Europe and the Atlantic', viewOfFrame({ lonMin: -35, lonMax: 45, latMin: 25, latMax: 70 })],
    ['The Indian Ocean and Arabia', viewOfFrame({ lonMin: 20, lonMax: 120, latMin: -30, latMax: 32 })],
    ['The China Seas', viewOfFrame({ lonMin: 92, lonMax: 150, latMin: 2, latMax: 40 })],
    ['The Malay archipelago', viewOfFrame({ lonMin: 95, lonMax: 135, latMin: -11, latMax: 8 })],
    ['The Caribbean', viewOfFrame({ lonMin: -90, lonMax: -58, latMin: 8, latMax: 28 })],
    ['The Pacific', viewOfFrame({ lonMin: 150, lonMax: 280, latMin: -47, latMax: 30 })], // Hawai'i, Aotearoa and Rapa Nui, across the date line: 280 is 80°W
  ]],
  ['Seas and islands', [
    ['Guam', at(144.79, 13.44, 7)], // Islas de los Ladrones
    ['Cebu', at(123.89, 10.32, 7)],
    ['Maluku Islands', at(128, -3, 5)],
    ['Solomon Islands', at(160, -9, 5)],
    ['Marquesas Islands', at(-140, -9, 6)],
  ]],
];
// the places that are lettered on the chart whatever the city data holds are in scripts/pois.mjs
const port = (lon, lat) => at(lon, lat, 7.5);
const SIGHTS = [
  ['Where the charts were made', [
    ['Genoa', port(8.93, 44.41), null, 'Vesconte, 1311'],
    ['Venice', port(12.33, 45.44), null, 'Pizzigani, 1367'],
    ['Majorca', at(3.0, 39.6, 7), null, 'Cresques, 1375'],
    ['Lisbon', port(-9.14, 38.72), null, 'the Armazém'],
    ['Seville', port(-5.98, 37.39), null, 'Casa de Contratación'],
    ['Dieppe', port(1.08, 49.93), null, 'Vallard, 1547'],
  ]],
  // three eras of six ports, most of them outside Europe
  ['Noteworthy ports', []],
  ['The ancient world', [
    ['Alexandria', port(29.89, 31.20), null, 'Ptolemaic; the Pharos'],
    ['Tyre', port(35.20, 33.27), null, 'Phoenician'],
    ['Carthage', port(10.33, 36.84), null, 'Phoenician, then Punic'],
    ['Ostia', port(12.29, 41.76), null, "Rome's harbour"],
    ['Berenike', port(35.47, 23.91), null, 'Red Sea, for India'],
    ['Barygaza', port(72.99, 21.71), 'Barygaza (Bharuch)', 'in the Periplus'],
  ], 'sub'],
  ['The age of discovery', [
    ['Lisbon', port(-9.14, 38.72), null, 'the Carreira da Índia'], // also a chart city above, on purpose: the same view, so Go lands in one place
    ['São Jorge da Mina', port(-1.35, 5.08), 'São Jorge da Mina (Elmina)', 'fort, 1482; the Atlantic slave trade'],
    ['Goa', port(73.91, 15.50), null, "Portugal's Asian capital"],
    ['Manila', port(120.98, 14.60), null, 'the galleons, 1571'],
    ['Acapulco', port(-99.88, 16.86), null, 'the galleons, 1565'],
    ['Batavia', port(106.83, -6.18), 'Batavia (Jakarta)', 'the VOC, 1619'],
  ], 'sub'],
  ['The modern world', [
    ['Suez', port(32.55, 29.97), null, 'the canal, 1869'],
    ['Panama', port(-79.53, 8.97), null, 'the canal, 1914'],
    ['Singapore', port(103.83, 1.28), null, '1819'],
    ['Hong Kong', port(114.20, 22.30), null, 'ceded, 1841'],
    ['Shanghai', port(121.47, 31.23), null, 'treaty port, 1843'],
    ['Rotterdam', port(4.48, 51.92), null, 'the Nieuwe Waterweg, 1872'],
  ], 'sub'],
  ['Remote islands', [
    ['Pukapuka Atoll', at(-138.8, -14.82, 6.5), 'Pukapuka'], // Magellan's San Pablo, 1521 (the Tuamotu one)
    ['Pitcairn Islands', viewOfFrame({ lonMin: -131.3, lonMax: -124.2, latMin: -26.6, latMax: -22.4 })], // all four; the latitudes padded so the longitudes bind
  ]],
];
// name, year, view, [the city it was made in, its view], text
const CHARTS = [
  ['Carte Pisane', 'c. 1275', both([7.4, 40.0, 8], [27.4, 36.8, 7.5]), ['Genoa', port(8.93, 44.41)]], // maker unknown; Genoa the usual attribution, Pisa only its owners
  ['Vesconte', '1311', around(25.2, 37.5, 3), ['Genoa', port(8.93, 44.41)]], // signed "de Janua"; he later worked in Venice, and where this sheet was drawn is disputed
  ['Dulcert', '1339', around(14.5, 40.0, 17), ['Majorca', port(2.65, 39.57)]], // signed in the city of Majorca, today's Palma
  ['Catalan Atlas', '1375', both([-20.7, 42.1, 16], [-5.4, 42.3, 16]), ['Majorca', port(2.65, 39.57)]], // Cresques Abraham's workshop, Palma
  ['De la Cosa', '1500', both([-45, 23.4, 15], [65, 23.4, 15]), ['El Puerto de Santa María', port(-6.23, 36.60)]], // signed "la fizo en el puerto de S. Mª"
  ['Carta Marina', '1539', viewOfFrame({ lonMin: 0, lonMax: 40, latMin: 54, latMax: 72 }), ['Venice', port(12.33, 45.44)]], // Olaus Magnus had it printed there
  ['De Bry, Virginia', '1590', at(-76, 36.28, 7.47), ['Frankfurt', port(8.68, 50.11)]], // de Bry's America, part I, printed at Frankfurt am Main
].map(([name, year, v, [city, made], text]) => ({ name, year, view: { ...v, title: name }, made: { ...made, title: city }, text }));
const places = []; // every anchorage and point of interest: { name, view }

// The voyages: any number drawn at once, none by default. The list is data/voyages/index.json in its order, each by
// its title (a phone shows the short name and the years, so none wraps); the titles load on the first open and stay
// cached. A click puts a voyage on or off and leaves the drawer open, so several can be chosen; each one on shows its
// ink beside it, a swatch to pick another. The first chosen is the chart's red, each further one a colour of its
// own (voyageColours). Above the list, the line weight for them all and Clear. The choice rides in the link
// (`voyages=`, `voyagewidth=`) like any style.
let voyageList = null;
const escapeHTML = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const voyageItem = (id, full, brief, when) => `<li><button type="button" role="checkbox" aria-checked="false" data-voyage="${id}">` +
  `<svg viewBox="0 0 28 18" aria-hidden="true"><path d="M2 9h24" fill="none" stroke-linecap="round"/></svg>` +
  `<span class="full">${full}</span><span class="brief">${brief}${when ? `<span class="when">${when}</span>` : ''}</span></button>` +
  `<input type="color" data-ink="${id}" aria-label="Colour of ${full}" title="Colour of ${full}" hidden></li>`;
const voyagesTools = groupTools('Voyages', {
  all: () => style.voyages, dflt: [], get: () => style.voyages,
  set: () => { style = { ...style, voyages: [] }; showVoyage(); writeHash(); render(); },
});
$('voyagesPanel').querySelector('.vtools').append(...voyagesTools.children);
const voyageInk = () => voyageColours(style.voyages.map((v) => v.id), Object.fromEntries(style.voyages.filter((v) => v.colour).map((v) => [v.id, v.colour])));
function showVoyage() {
  const ink = voyageInk();
  for (const b of $('voyageList').querySelectorAll('[data-voyage]')) {
    const id = b.dataset.voyage, on = id in ink, line = b.querySelector('path'), pick = b.parentElement.querySelector('[data-ink]');
    b.setAttribute('aria-checked', String(on));
    line.setAttribute('stroke', on ? ink[id] : 'currentColor');
    line.setAttribute('stroke-width', String(style.voyageWidth));
    line.setAttribute('stroke-dasharray', on ? '' : '2 3');
    line.setAttribute('opacity', on ? '1' : '0.45');
    pick.hidden = !on;
    if (on) pick.value = ink[id];
  }
  for (const f of toolRefreshers) f();
}
function fillVoyages() {
  voyageList ??= env.readJSON('data/voyages/index.json')
    .then((ids) => Promise.all(ids.map((id) => env.readJSON(`data/voyages/${id}.json`).then((v) => [id, v], () => [id, { title: id, short: id }]))))
    .then((voyages) => {
      $('voyageList').innerHTML = voyages.map(([id, v]) => voyageItem(escapeHTML(id), escapeHTML(v.title ?? id), escapeHTML(v.short ?? v.title ?? id), escapeHTML(v.when))).join('');
      showVoyage();
    }, (e) => { voyageList = null; $('voyageList').innerHTML = `<li>${escapeHTML(e.message)}</li>`; });
  showVoyage();
}
$('voyageList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-voyage]');
  if (!b) return;
  const id = b.dataset.voyage, on = style.voyages.some((v) => v.id === id);
  style = { ...style, voyages: on ? style.voyages.filter((v) => v.id !== id) : [...style.voyages, { id, colour: null }] };
  showVoyage(); writeHash(); render();
});
let picking = 0; // a colour is placed when the picker pauses, not on every step of a drag across it
$('voyageList').addEventListener('input', (e) => {
  const id = e.target.dataset?.ink;
  if (!id) return;
  style = { ...style, voyages: style.voyages.map((v) => (v.id === id ? { ...v, colour: e.target.value.toLowerCase() } : v)) };
  showVoyage(); writeHash();
  clearTimeout(picking); picking = setTimeout(render, 150);
});

// The cartouche names the place flown to (its title, else the button's name), not whatever scores highest in the frame.
const caption = (text) => `<span class="notes">${text ?? CAPTION}</span>`;
for (const [list, groups] of [[$('anchorages'), ANCHORAGES], [$('sightsList'), SIGHTS]]) {
  list.innerHTML = groups.map(([group, items, sub]) => (group ? `<li class="group${sub ? ' sub' : ''}">${group}</li>` : '') + items.map(([name, v, title, note, text]) =>
    `<li><button type="button" data-place="${places.push({ name, view: { ...v, title: title ?? name } }) - 1}">${name}${note ? `<small>${note}</small>` : ''}</button>${caption(text)}</li>`).join('')).join('');
  list.addEventListener('click', (e) => { const b = e.target.closest('[data-place]'); if (b) { setDrawer(false); goTo(places[b.dataset.place].view); } });
}

// Each chart a section on its own sheet of skin, the button's: where it was made, the sheet, and (to come) the scan.
const skin = $('charts').querySelector('svg').outerHTML;
$('chartList').innerHTML = CHARTS.map(({ name, year, made, text }, i) => `<li class="chart"><h3>${skin}<span>${name}</span><small>${year}</small></h3>${caption(text)}
  <div class="acts"><button type="button" data-chart="${i}" data-to="made" title="${made.title}">Where it was made</button><button type="button" data-chart="${i}" data-to="view">The sheet</button><button type="button" disabled title="The original, to come">The scan</button></div></li>`).join('');
$('chartList').addEventListener('click', (e) => { const b = e.target.closest('[data-chart]'); if (b) { setDrawer(false); goTo(CHARTS[b.dataset.chart][b.dataset.to]); } });

// A chart whose scan is in packs/overlays/overlays.json gets a chip under its buttons that lays the scan over the map,
// its own thumbnail the chip's glyph, and while on, a slider for how strongly: 0 today's coast alone, 1 the scan alone.
// An overlay's id is its chart's name in lower case, hyphenated (Carta Marina, carta-marina). Kept in the link like any style.
const overlayOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
let overlayTimer = 0;
env.readJSON('packs/overlays/overlays.json').then(({ overlays }) => {
  const ids = new Set(overlays.map((o) => o.id));
  CHARTS.forEach(({ name }, i) => {
    const o = overlays.find((v) => v.id === overlayOf(name));
    if (!o) return;
    $('chartList').children[i].insertAdjacentHTML('beforeend', `<div class="overlay" data-overlay="${o.id}">
      <button type="button" class="chip" role="checkbox" aria-checked="false" title="${escapeHTML(o.title)}, public domain"><img src="packs/overlays/${o.file}" alt="" loading="lazy">Lay the scan over the map</button>
      <div class="slider" hidden><label for="opacity-${o.id}">Opacity</label><input id="opacity-${o.id}" type="range" min="0" max="1" step="0.05"><output></output></div></div>`);
  });
  if (style.overlay && !ids.has(style.overlay)) console.warn(`overlay ${style.overlay}: not on this site`);
  showOverlay();
}).catch(() => {}); // no overlays on this site: no chips, and the map unchanged
$('chartList').addEventListener('click', (e) => {
  const box = e.target.closest('[data-overlay]'), chip = e.target.closest('.chip');
  if (!box || !chip) return;
  style = { ...style, overlay: style.overlay === box.dataset.overlay ? null : box.dataset.overlay };
  showOverlay(); writeHash(); render();
});
$('chartList').addEventListener('input', (e) => {
  if (e.target.type !== 'range' || !e.target.closest('[data-overlay]')) return;
  style = { ...style, overlayOpacity: Number(e.target.value) };
  showOverlay(); writeHash();
  clearTimeout(overlayTimer); overlayTimer = setTimeout(render, 120); // drawn when the slider pauses, not on every step
});
function showOverlay() {
  for (const box of document.querySelectorAll('#chartList [data-overlay]')) {
    const on = style.overlay === box.dataset.overlay, range = box.querySelector('input');
    box.querySelector('.chip').setAttribute('aria-checked', String(on));
    box.querySelector('.slider').hidden = !on;
    range.value = String(style.overlayOpacity);
    box.querySelector('output').textContent = `${Math.round(style.overlayOpacity * 100)}%`;
  }
}

// A typed position: "36.28, -76" or "36.28N 76W" (latitude first).
function parseLatLon(text) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EWew])?\s*$/.exec(text);
  if (!m || (m[2] && m[1].startsWith('-')) || (m[4] && m[3].startsWith('-'))) return null; // a sign and a letter disagree, or say it twice
  const lat = Number(m[1]) * (/s/i.test(m[2] ?? '') ? -1 : 1), lon = Number(m[3]) * (/w/i.test(m[4] ?? '') ? -1 : 1);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lon, lat } : null;
}

// A typed place: the chart views, then the points of interest, then Natural Earth's towns (placename.mjs matches them).
async function findPlace(text) {
  if (!fold(text)) return null;
  const towns = await env.readJSON('geo/ne-populated-places-50m.geojson').then((g) => g.features.toSorted((a, b) => a.properties.SCALERANK - b.properties.SCALERANK), () => []); // the bigger town first
  const candidates = [
    ...places.map(({ view: v }) => ({ name: v.title, view: v })),
    ...places,
    ...CHARTS.map(({ name, view }) => ({ name, view })),
    ...POIS.map((p) => ({ name: p.name, view: { lon: p.lon, lat: p.lat, zoom: 7, title: p.name } })),
    ...towns.map(({ properties: p, geometry: { coordinates: [lon, lat] } }) => ({ name: p.NAME, view: { lon, lat, zoom: 8, title: p.NAME } })),
  ];
  return bestPlace(text, candidates)?.view ?? null;
}

$('coords').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('coordsText').value, p = parseLatLon(text), miss = $('goMiss');
  const target = p ? { ...p, zoom: Math.max(view.zoom, LOCATE_ZOOM) } : await findPlace(text);
  if (!target) { miss.textContent = text.trim() ? `No place called “${text.trim()}”` : 'Type a place, or latitude, longitude: 36.28, -76'; miss.hidden = false; return; } // the text before the unhide, so a reader announces it
  miss.hidden = true;
  setDrawer(false);
  goTo(target);
});
$('coordsText').addEventListener('input', () => { $('goMiss').hidden = true; });

// A short flight from the view to a target, in the view's projection: the ground is drawn on the
// way as for a drag, and the ornaments placed when it lands. Reduced motion jumps.
let flight = 0;
function goTo(target) {
  cancelAnimationFrame(flight);
  pinTitle = null;
  const from = view, to = clampView({ ...target, projection: view.projection });
  const dlon = ((to.lon - from.lon + 540) % 360) - 180; // the short way round
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 600, t0 = performance.now();
  const step = (now) => {
    const u = ms ? Math.min(1, (now - t0) / ms) : 1, e = u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2;
    moved(u < 1 ? clampView({ lon: from.lon + dlon * e, lat: from.lat + (to.lat - from.lat) * e, zoom: from.zoom + (to.zoom - from.zoom) * e, projection: to.projection }) : to, true);
    if (u < 1) flight = requestAnimationFrame(step); else { pinTitle = target.title ?? null; placed = null; stopped(); }
  };
  step(t0);
}

// My position: asked for on the button in Go; the fix is written into its box as latitude, longitude, Go
// shuts and the map flies there (at z10 or closer, like any typed position); nothing is drawn there. The box
// is not focused, so a phone's keyboard does not come up over the map. While the browser looks, the button
// says so; a refusal or a failure is said in Go itself, where the eye is. The button is not offered where the
// browser has no geolocation (an insecure page has none).
const LOCATE_ZOOM = 10;
const locate = $('locate'), LOCATE_LABEL = locate.textContent;
locate.hidden = !navigator.geolocation;
locate.addEventListener('click', () => {
  const miss = $('goMiss');
  locate.disabled = true; locate.textContent = 'Finding my position…'; miss.hidden = true;
  const done = () => { locate.disabled = false; locate.textContent = LOCATE_LABEL; };
  navigator.geolocation.getCurrentPosition((p) => {
    done();
    const { latitude: lat, longitude: lon } = p.coords;
    $('coordsText').value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    setDrawer(false);
    goTo({ lat, lon, zoom: Math.max(view.zoom, LOCATE_ZOOM) });
  }, (e) => {
    done();
    const say = e.code === e.PERMISSION_DENIED ? 'My position: not allowed' : `My position: ${e.message}`;
    miss.textContent = say; miss.hidden = false; // the text before the unhide, so a reader announces it
    $('status').textContent = say;
  }, { timeout: 15000, maximumAge: 60000 });
});

for (const id of Object.values(KNOB_SLIDERS)) $(id).addEventListener('input', (e) => { e.target.dataset.set = '1'; }); // moved, so set
for (const id of ['debug', 'overlap', ...Object.values(KNOB_CHIPS), ...Object.values(KNOB_SLIDERS), 'projection', 'ink', 'parchment', 'density', 'names', 'rhumb', 'scale', 'scaleBorder', 'land', 'islands', 'seaTint', 'rivers', 'lakes', 'trees', 'mountains', 'hills', 'continentsZoom', 'regions', 'regionsZoom', 'titleMode', 'townSize', 'voyageWidth']) $(id).addEventListener('input', readControls);
let typing = 0; // a typed title is placed when the typing pauses, not on every key: a placement takes up to a few hundred ms
$('title').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(readControls, 400); });
addEventListener('hashchange', () => { layout = layoutFromHash(); showLayout(); view = viewFromHash(); style = styleFromHash(); selection = selectionFromHash(); showStyle(); showPlacement(); showVoyage(); render(); });
showPlacement();
render();

// the bottom-right corner: the commit this site was built from, its subject, and the build's time
// (build.json, from build-preview.mjs; the dev server's has no build time, so it says so)
const ago = (t) => {
  const m = Math.round((Date.now() - Date.parse(t)) / 60000);
  return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
fetch('build.json').then((r) => (r.ok ? r.json() : null)).then((b) => {
  if (!b?.sha) return;
  const el = $('build');
  const link = Object.assign(document.createElement('a'), { href: `https://github.com/mark-brannan/portolani/commit/${b.sha}`, textContent: b.sha.slice(0, 7) });
  const built = b.built ? `built ${b.built.replace('T', ' ').slice(0, 16)} UTC (${ago(b.built)})` : 'dev server';
  el.append(link, ` · ${built} · ${b.subject}`);
  el.title = `${b.sha}\ncommitted ${b.committed}\n${b.built ? `built ${b.built}` : 'served live by the dev server'}\n${b.subject}`;
  el.hidden = false;
  document.documentElement.classList.add('built');
}).catch(() => {});
