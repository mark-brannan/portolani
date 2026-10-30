// Browser host for the shared scene code (scene.mjs): same scene as `npm run render`, drawn live.
// Drag to pan, wheel or pinch to zoom; while the map moves the land and coast are drawn and the placed
// ornaments slide with it, held to the earth; they are placed again when it stops. A row of seven instruments
// at the top right opens one drawer each, one at a time: the settings behind the rose, so the map has the
// window, the charts, the points of interest, Go, the voyages, the people and the anchorages. The view and the style are kept in the URL hash, e.g.
// #map=zoom/lat/lon&projection=miller&overlap=cut&sprites=s:serpent-a,v:kraken,v:rose-aguiar,p:tower&townsize=rank&names=0&rhumb=0&scale=chevron&scaleborder=blank&continents=5&regions=latin&regionset=catalan-1375&regionszoom=7&land=green&islands=1&rivers=aguiar&lakes=marina&mountains=ink&trees=ink&seas=1&autotitle=0&title=Mare+Nostrum&ink=5a1a1a&parchment=eee&density=1.5;
// a setting left at its default is left out, `sprites` too (keys with the pack shortened, v: s: p:); `mountains` is `ink`
// or `off` (colour is the default); the hills are the Catalan sprites in `sprites`. `continents` and `regionszoom` are the zoom
// they are drawn down from (0 off, the top always); `regionset=catalan-1375` letters the regions in a period's names (REGION_SETS), today's by default. `voyages=columbus,drake:1f4e8c` are the voyages in the order chosen, a picked
// colour after an id, `voyagewidth=3.2` their line weight and `voyagedraw=4` the seconds the pen takes to draw one on. `overlay=carta-marina,aguiar` lays those charts' scans over the map,
// each as one sheet, the last on top; `sheet=;lon,lat,scale,turn` where each was dragged to, a slot per id; `overlaymode=pieces` the warped pieces instead, `overlayopacity=0.6`
// how strongly (0 to 1); off by default.
// Older links naming a `rendering` (or `pack`), `rose`, `monster`, `town` and `kinds` open as the
// selection those chose, and are written back in the new form.
// For a while, `debug=sheets[,rings]` and `tune=name:value,...` carry the under-the-hood section
// (docs/atlas/under-the-hood.md), off by default.
import { createScene, towerGlyph, REGION_LANGS, REGION_SETS, REGION_SAMPLES, drawScene, drawGround, anchorScene, drawAnchored, panView, zoomView, clampView, viewOfFrame, viewProjection, voyageMarks, doubtMarks, SCALE_CARD_W, SCALE_CARD_H, drawCartoucheCard, drawScaleCard, covers, DEFAULT_VIEW, RENDERINGS, KINDS, DEFAULT_KINDS, LANDS, SCALE_BORDERS, MAX_ZOOM, OVERLAP_RULES, DEFAULT_OVERLAP, RIVER_STYLES, LAKE_STYLES, TREE_STYLES, TOWN_SIZES, readManifests, listSprites, defaultSprites, chooseSprites, PROJECTION_NAMES, SCALE_NAMES, parsePlacement, CORNERS, DEFAULT_CARTOUCHE_CORNER, DEFAULT_SCALE_CORNER, scaleRect, W, H, parseTune, parseDebug, TUNE_KNOBS, ROSE_SHARE, SHEET_ROSES, WIDE, VOYAGE_WIDTH, VOYAGE_WIDTHS, VOYAGE_DRAW, voyageDrawSeconds, voyageColours, isBroken, legPath, voyageView, CONTINENT_ZOOM_END, readVoyage, chronological, voyageLink, sightMarks, SIGHT_TILES, noteMarks, pickMark, markClear, tileSpot, ZOOM } from './scene.mjs';
import { ORIGINS } from './atlas.mjs';
import { OVERLAY_DEFAULTS, overlayFromHash, overlayToHash, sheetCorners, onSheet, sheetView, sameSheet, drawSheet } from './overlays.mjs';
import { POIS, POI_ZOOM } from './pois.mjs';
import { PEOPLE_FILE, PICTURES_FILE, SIGHT_PICTURES_FILE, SIGHT_MANIFEST_FILE, sightDeal, lifeSpan, laneAxis, eraBands, EARLIER_MARKS, pictureCredit, pictureNote, commonsPage, voyageYears, parsePictures, parsePictureAt, pictureAtText, picturePlaces, frameOf, sightFrame, viewContaining, withPictures, peopleOf, whoOf, deathOf, sightPicturesOf, MEMENTO, mementoNext } from './people.mjs';
import { fold, bestPlace } from './placename.mjs';
import { planFlight, ease as flyEase, FLY_KNOBS, flyDefaults } from './flight.mjs';

const memo = new Map();
// a failed load is forgotten, so the next stop tries it again
const once = (key, make) => {
  if (!memo.has(key)) memo.set(key, make().catch((e) => { memo.delete(key); throw e; }));
  return memo.get(key);
};

// A chart of several pages (packs/overlays/overlays.json `panels`) loads page by page: each page that lands redraws
// the map, a few landings at once in one redraw, so the sheet fills in rather than waiting for the last.
let panelLanded = 0;
const env = {
  onPanel: () => { clearTimeout(panelLanded); panelLanded = setTimeout(() => render(), 120); },
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

const DEFAULTS = { ink: '#3b2a1a', parchment: '#e9d8b4', density: 1, names: true, rhumb: true, scale: 'genoese', continentsZoom: CONTINENT_ZOOM_END, regions: 'latin', regionSet: 'today', regionsZoom: 7, title: 'PORTOLANI', autoTitle: true, land: 'ochre', islands: false, rivers: 'plain', lakes: 'marina', mountains: 'colour', trees: 'marina', seaTint: false, scaleBorder: 'bordered', townSize: TOWN_SIZES[0], voyages: [], voyageWidth: VOYAGE_WIDTH, voyageDraw: VOYAGE_DRAW.seconds, person: null, sight: null, site: null, pictures: null, ...OVERLAY_DEFAULTS, cartouchePos: DEFAULT_CARTOUCHE_CORNER, scalePos: DEFAULT_SCALE_CORNER, overlap: DEFAULT_OVERLAP };
// The cards of a subject chosen are dealt once the map is there: `dealing` is that subject's key until then (the map
// flying to it, or its records loading), and no card of it lies on the table nor rides in the link meanwhile (dealNow).
// `onTable`: the cards drawn on the table when it was last painted.
let dealing = null, onTable = 0;

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
// `charts=all` (in the hash or the query) also lists the charts of other traditions under the portolans; read once, and kept in the link
const ALL_CHARTS = [hashParams(), new URLSearchParams(location.search)].some((q) => q.get('charts') === 'all');
// the drawer's layout (`layout=`), a way of grouping the same controls; Default is written as no key
const LAYOUT_NAMES = ['default', 'question', 'moods', 'sheet'];
const layoutFromHash = () => (LAYOUT_NAMES.includes(hashParams().get('layout')) ? hashParams().get('layout') : 'default');
// whether a grouped list's section opens when a mouse rests on its heading (`hover=`); on is written as no key, `hover=0` is off
const hoverFromHash = () => hashParams().get('hover') !== '0';

function viewFromHash() {
  const q = hashParams(), m = /^(-?[\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)$/.exec(q.get('map') ?? '');
  const v = m && { zoom: Number(m[1]), lat: Number(m[2]), lon: Number(m[3]) };
  const at = v && Object.values(v).every(Number.isFinite) ? v : DEFAULT_VIEW; // e.g. #map=1.2.3/40/5
  return clampView({ ...at, projection: q.get('projection') });
}
const zoomOf = (v, dflt) => (v !== '' && Number.isFinite(Number(v)) ? Math.max(0, Math.min(MAX_ZOOM, Math.round(Number(v)))) : dflt);
const hex = (v, fallback) => (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(v ?? '') ? `#${v.length === 3 ? [...v].map((c) => c + c).join('') : v}`.toLowerCase() : fallback);
function styleFromHash() {
  const q = hashParams(), density = Number(q.get('density') ?? DEFAULTS.density);
  return {
    ink: hex(q.get('ink'), DEFAULTS.ink),
    parchment: hex(q.get('parchment'), DEFAULTS.parchment),
    density: density >= 0 && density <= 2 ? density : DEFAULTS.density,
    names: q.get('names') !== '0',
    rhumb: q.get('rhumb') !== '0',
    // older links: continents=0, and regions=off
    continentsZoom: q.has('continents') ? zoomOf(q.get('continents'), DEFAULTS.continentsZoom) : DEFAULTS.continentsZoom,
    regions: ['latin', 'english'].includes(q.get('regions')) ? q.get('regions') : DEFAULTS.regions,
    regionSet: REGION_SETS.includes(q.get('regionset')) ? q.get('regionset') : DEFAULTS.regionSet,
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
    voyageDraw: voyageDrawSeconds(q.get('voyagedraw')),
    // the subject chosen, one of: the person chosen in the People drawer (data/voyages/people.json) or the sight whose tile
    // was opened (scripts/sights.mjs); which of its pictures lie on the map, and where
    sight: Object.hasOwn(SIGHT_TILES, q.get('sight') ?? '') ? q.get('sight') : DEFAULTS.sight,
    site: Object.hasOwn(SIGHT_TILES, q.get('sight') ?? '') && /^\d$/.test(q.get('site') ?? '') ? Number(q.get('site')) : DEFAULTS.site, // which of a sight's marks dealt
    person: !Object.hasOwn(SIGHT_TILES, q.get('sight') ?? '') && /^[a-z][a-z0-9-]*$/.test(q.get('person') ?? '') ? q.get('person') : DEFAULTS.person,
    pictures: parsePictures(q.get('pictures'), DEFAULTS.pictures),
    pictureAt: parsePictureAt(q.get('pictureat')),
    // a chart's scan laid over the map (packs/overlays/overlays.json; an id the site lacks draws nothing), and how strongly
    ...overlayFromHash(q),
  };
}
// The voyages drawn, in the order chosen, by their ids (data/voyages/<id>.json; one the site lacks draws nothing),
// each with the colour picked for it or null for its own (voyageColours): voyages=columbus,drake:1f4e8c. A voyage
// hidden by its eye keeps its place, and so its colour, and ends in ~: voyages=columbus~,drake. An older
// link's single voyage=<id> is read as a list of one.
function voyagesFromHash(q) {
  const list = q.has('voyages') ? q.get('voyages').split(',') : q.has('voyage') ? [q.get('voyage')] : [];
  const seen = new Set();
  return list.map((t) => { const hidden = t.endsWith('~'), [id, c] = (hidden ? t.slice(0, -1) : t).split(':'); return { id, colour: /^[0-9a-f]{6}$/i.test(c ?? '') ? `#${c.toLowerCase()}` : null, ...(hidden && { hidden: true }) }; })
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
  if (!hoverOpen) q.set('hover', '0');
  if (!sameSet(selection, new Set(DEFAULT_SELECTION))) q.set('sprites', SPRITES.filter((s) => selection.has(s.key)).map((s) => encodeKey(s.key)).join(','));
  if (st.townSize !== DEFAULTS.townSize) q.set('townsize', st.townSize);
  if (!st.names) q.set('names', '0');
  if (!st.rhumb) q.set('rhumb', '0');
  if (st.continentsZoom !== DEFAULTS.continentsZoom) q.set('continents', st.continentsZoom);
  if (st.regions !== DEFAULTS.regions) q.set('regions', st.regions);
  if (st.regionSet !== DEFAULTS.regionSet) q.set('regionset', st.regionSet);
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
  if (st.voyages.length) q.set('voyages', st.voyages.map((v) => (v.colour ? `${v.id}:${v.colour.slice(1)}` : v.id) + (v.hidden ? '~' : '')).join(','));
  if (st.voyageWidth !== DEFAULTS.voyageWidth) q.set('voyagewidth', st.voyageWidth);
  if (st.voyageDraw !== DEFAULTS.voyageDraw) q.set('voyagedraw', st.voyageDraw);
  if (st.person || st.sight) {
    q.set(st.person ? 'person' : 'sight', st.person ?? st.sight);
    if (st.sight && st.site != null) q.set('site', st.site);
    const shown = st.pictures && (st.pictures.length ? st.pictures.join(',') : 'none'), at = pictureAtText(st.pictureAt);
    if (shown && !dealing) q.set('pictures', shown); // written once they are dealt, not while the map flies to them
    if (at && !dealing) q.set('pictureat', at);
  }
  overlayToHash(st, q);
  if (st.seaTint) q.set('seas', '1');
  if (st.scaleBorder !== DEFAULTS.scaleBorder) q.set('scaleborder', st.scaleBorder);
  if (st.scale !== DEFAULTS.scale) q.set('scale', st.scale);
  if (st.cartouchePos !== DEFAULTS.cartouchePos) q.set('cartouche', st.cartouchePos);
  if (st.scalePos !== DEFAULTS.scalePos) q.set('scalepos', st.scalePos);
  if (st.density !== DEFAULTS.density) q.set('density', st.density);
  if (st.ink !== DEFAULTS.ink) q.set('ink', st.ink.slice(1));
  if (st.parchment !== DEFAULTS.parchment) q.set('parchment', st.parchment.slice(1));
  if (ALL_CHARTS) q.set('charts', 'all');
  history.replaceState(null, '', `#${q.toString().replaceAll('%2C', ',').replaceAll('%2F', '/').replaceAll('%3A', ':').replaceAll('%3B', ';')}`);
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
// a section heading with its rows, and the pointer on the heading: clicking (off), or resting while its rows slide open (on)
const ARROW = '<path d="M17 3v10l2.4-2.2 1.7 3.8 1.5-.7-1.7-3.7H24Z" fill="currentColor"/>';
const HOVER_GLYPHS = {
  off: svg(`<path d="M2 4h13" ${stroke('currentColor', 1.4)}/>${ARROW}<path d="M14.5 1.5l1.2 1.2M13.5 5h1.6M14.5 8.5l1.2-1.2" ${stroke('currentColor', 0.8)}/>`),
  on: svg(`<path d="M2 4h13" ${stroke('currentColor', 1.4)}/><path d="M5 8.5h9M5 12h7M5 15.5h8" ${stroke('currentColor', 0.7)}/>${ARROW}<path d="M25 2.5a2.6 2.6 0 1 1-2.6-.1" ${stroke('currentColor', 0.8)}/>`),
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
  ride: svg(`<rect x="4" y="3" width="20" height="12" ${stroke('currentColor', 1)}/><path d="M2 13C8 3 14 14 26 4" ${stroke(RED, 1.8)}/>`), // a line drawn over a sheet
  lifted: svg(`<rect x="4" y="3" width="20" height="12" ${stroke('currentColor', 0.8)} stroke-dasharray="2 2"/><path d="M2 13C8 3 14 14 26 4" ${stroke(RED, 1.8)}/>`), // the sheet off, the line alone
  rose: svg(`<path d="M2 9h24M14 2v14M8 2v14M20 2v14M2 5h24M2 13h24" ${stroke('currentColor', 0.5)}/><path d="M14 6l1 3-1 3-1-3Z M11 9l3-1 3 1-3 1Z" fill="${RED}"/>`),
  zero: svg(`<path d="M2 9h24M14 2v14M8 2v14M20 2v14M2 5h24M2 13h24" ${stroke('currentColor', 0.5)}/><circle cx="14" cy="9" r="2.6" ${stroke(RED, 1.2)}/>`),
  curated: svg(`<rect x="3" y="3" width="22" height="12" ${stroke('currentColor', 1)}/><circle cx="14" cy="9" r="4" ${stroke('currentColor', 0.8)}/>`),
  grid: svg(`<rect x="3" y="3" width="22" height="12" ${stroke('currentColor', 1)}/><path d="M8.5 3v12M14 3v12M19.5 3v12M3 9h22" ${stroke('currentColor', 0.6)}/>`),
  roselines: svg(`<path d="M6 9h20M6 9l18-6M6 9l18 6M6 9l12-7M6 9l12 7" ${stroke('currentColor', 0.6)}/><circle cx="6" cy="9" r="1.6" fill="${RED}"/>`),
};
const ROSE_AT = `${Math.abs(ORIGINS.rose.lon)}°${ORIGINS.rose.lon < 0 ? 'W' : 'E'} ${Math.abs(ORIGINS.rose.lat)}°${ORIGINS.rose.lat < 0 ? 'S' : 'N'}`;
const NAME_SAMPLE = (text) => `<em class="nm">${text}</em>`; // a region name as the map letters it, italic
const CHOICES = {
  overlap: [['smallest', 'Smallest', 'only the smallest of the charts that overlap'], ['fit', 'Fit', 'the chart nearest one window wide'], ['cut', 'All, cut', 'every chart, its lines stopping at a smaller chart\'s edge'], ['uncut', 'All, uncut', 'every chart in full']].map(([value, label, note]) => [value, label, note, OVERLAP_GLYPHS[value]]),
  projection: [['mercator', 'Mercator', 'rhumb lines straight'], ['plate-carree', 'Plate carrée', 'equal degrees'], ['miller', 'Miller', 'poles tamed'], ['equal-area', 'Equal-area', 'Gall–Peters'], ['orthographic', 'Globe', 'orthographic'], ['azimuthal-equidistant', 'Azimuthal equidistant', 'true from the centre'], ['stereographic', 'Stereographic', 'the polar chart']].map(([value, label, note = '']) => [value, label, note, PROJECTION_GLYPHS[value]]),
  // each region chip shows a name it letters, in the lettering's italic; showRegionSamples keeps it to the chosen set and language
  regions: [['latin', 'Latin', REGION_SAMPLES.today.latin, NAME_SAMPLE(REGION_SAMPLES.today.latin)], ['english', 'English', REGION_SAMPLES.today.english, NAME_SAMPLE(REGION_SAMPLES.today.english)]],
  regionSet: [['today', 'Today', 'the regions as they are named today', NAME_SAMPLE(REGION_SAMPLES.today.latin)], ['catalan-1375', '1375 · Catalan Atlas', 'the realms the Catalan Atlas names, c. 1375', NAME_SAMPLE(REGION_SAMPLES['catalan-1375'].latin)]],
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
  sheetHides: [['0', 'Voyage rides over', 'a voyage is drawn over the sheet, wherever it lies, and the sheet stays', HOOD_GLYPHS.ride], ['1', 'Sheet hides', 'a voyage\'s fly takes the sheet off if it would cover the voyage\'s frame', HOOD_GLYPHS.lifted]],
  overlayMode: [['sheet', 'One sheet', 'the whole scan, opaque, laid level and centred, dragged by hand', HOOD_GLYPHS.sheets], ['pieces', 'Warped pieces', 'each piece warped onto today\'s coast, at the opacity below', HOOD_GLYPHS.rings]],
  tuneOrigin: [['rose', `Catalan rose (${ROSE_AT})`, 'every band\'s grid has a corner on the rose', HOOD_GLYPHS.rose], ['zero', '0° 0°', 'NOAA\'s own zero', HOOD_GLYPHS.zero]],
  tuneCurated: [['1', 'On', 'the curated charts take the place of the grid cells they hold', HOOD_GLYPHS.curated], ['0', 'Off', 'grid cells everywhere', HOOD_GLYPHS.grid]],
  hoverOpen: [['off', 'Off', 'a click opens a section', HOVER_GLYPHS.off], ['on', 'On', 'resting the pointer on a heading opens its section', HOVER_GLYPHS.on]],
  tuneRoselines: [['1', 'On', 'the rose\'s 32 lines as one more hub at every zoom', HOOD_GLYPHS.roselines], ['0', 'Off', 'only the sheet the rose falls in', HOOD_GLYPHS.off]],
  flyShape: [['step', 'Step', 'out about the place left, across at the top, down onto the place; Blend lets the pan run alongside the zoom'], ['hyperbolic', 'Hyperbolic', 'van Wijk & Nuij, as MapLibre flies: pan and zoom together on one curve, Curve setting its height']],
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
  cresquesproject: ['Cresques Project', 'https://www.cresquesproject.net/catalan-atlas-legends'],
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
  regions: ['1375: the realms the ', 'catalan', ' names, in its own spelling or read in English, from its legends as the ', 'cresquesproject', ' translates them.'],
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
  $('regionSet').value = style.regionSet; showRegionSamples();
  $('titleMode').value = style.autoTitle ? 'auto' : 'custom'; $('title').disabled = style.autoTitle;
  if (!style.autoTitle) $('title').value = style.title; // automatic shows the view's own name, once placed (render)
  $('townSize').checked = style.townSize !== 'rank';
  showHood();
  $('voyageWidth').value = String(style.voyageWidth);
  showVoyageDraw();
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
    continentsZoom: Number($('continentsZoom').value), regions: $('regions').value, regionSet: $('regionSet').value, regionsZoom: Number($('regionsZoom').value),
    // automatic shows the view's name in the box, which is not the typed title
    title: $('titleMode').value === 'auto' || style.autoTitle ? style.title : $('title').value, // switching to custom starts from the typed title, not the name shown
    autoTitle: $('titleMode').value === 'auto',
    // checked, by metro area; a link's townsize=population is kept until the box is touched
    townSize: $('townSize').checked ? (style.townSize === 'rank' ? 'area' : style.townSize) : 'rank',
    placement: style.placement, // chosen by the placement chips below
    overlap: $('overlap').value,
    cartouchePos: style.cartouchePos, scalePos: style.scalePos, // set by dragging the cartouche or the scale bar
    ...readHood(),
    voyages: style.voyages, voyageWidth: Number($('voyageWidth').value), voyageDraw: style.voyageDraw, // chosen in the voyages drawer
    overlays: style.overlays, sheets: style.sheets, // chosen in the charts drawer, and by dragging a sheet
  };
  // hills are the Catalan sprites: the chip selects all of them or none
  const hills = $('hills').value === 'catalan';
  if (hills !== CATALAN_KEYS.some((k) => selection.has(k))) for (const k of CATALAN_KEYS) hills ? selection.add(k) : selection.delete(k);
  view = clampView({ ...view, projection: $('projection').value });
  showRegionSamples();
  changed();
}
// The region chips' samples: a language chip shows a name of the chosen set, a set chip a name in the chosen language;
// under a period's names the Latin chip letters the atlas's own spelling, so it reads "As lettered". The samples are
// scene.mjs's REGION_SAMPLES.
function showRegionSamples() {
  const set = REGION_SAMPLES[style.regionSet] ? style.regionSet : 'today';
  for (const b of $('regions').children) {
    const label = b.dataset.value === 'latin' && set !== 'today' ? 'As lettered' : b.dataset.value === 'latin' ? 'Latin' : 'English';
    b.querySelector('.nm').textContent = REGION_SAMPLES[set][b.dataset.value];
    b.lastChild.textContent = label;
    b.title = `${label} (${REGION_SAMPLES[set][b.dataset.value]})`;
  }
  for (const b of $('regionSet').children) b.querySelector('.nm').textContent = (REGION_SAMPLES[b.dataset.value] ?? REGION_SAMPLES.today)[style.regions];
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
  $('sheetHides').value = style.sheetHides ? '1' : '0';
  $('overlayMode').value = style.overlayMode; $('overlayOpacityRow').hidden = style.overlayMode !== 'pieces';
  $('overlayOpacity').value = String(style.overlayOpacity); $('overlayOpacityOut').textContent = `${Math.round(style.overlayOpacity * 100)}%`;
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
  return { debug: parseDebug($('debug').value).text, tune: parseTune(pairs.map(([n, v]) => `${n}:${v}`).join(',')).text, overlayMode: $('overlayMode').value, sheetHides: $('sheetHides').value === '1', overlayOpacity: Number($('overlayOpacity').value) };
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
let hoverOpen = hoverFromHash();
let view = viewFromHash();
let style = styleFromHash();
let selection = selectionFromHash();
showStyle();
if (LEGACY_KEYS.some((k) => hashParams().has(k))) writeHash(); // an older link, rewritten in the new form
let ground = null; // { world, coarse, bg, anchored } from the last placement, all a moving frame needs
// the People drawer's data, once loaded ({ people, pictures, sources, voyages }), the frames of the people chosen, their
// pictures' images, and the picture held by hand (the section "people" below)
let peopleData = null, peopleLoad = null, holding = null, dealt = null, flips = new Map();
const frames = new Map(), pictureImgs = new Map();
let placed = null; // the view the canvas shows with its ornaments
let pinTitle = null; // the name of the place last flown to, on the cartouche until the map is moved by hand
let run = 0;

async function render() {
  const me = ++run;
  try {
    const t0 = performance.now();
    // a kind is drawn while any of its sprites is selected
    const kinds = KINDS.filter((k) => SPRITES.some((s) => s.kind === k && selection.has(s.key)));
    await learnBroken(style.voyages.map((v) => v.id)); // a voyage's ink waits on its file: the first render of a link has them right
    const ink = voyageInk(), inkKey = JSON.stringify(ink); // read from the sheet last drawn; checked again once this one lands
    const { scene, data, bg, world, coarse, timing } = await createScene(env, {
      ...style, ...parsePlacement(style.placement), relief: style.mountains === 'colour' ? ['marina'] : style.mountains === 'ink' ? ['engraved'] : [],
      continents: style.continentsZoom > 0, continentsZoom: style.continentsZoom,
      regions: style.regionsZoom > 0 ? style.regions : 'off', regionSet: style.regionSet, regionsZoom: style.regionsZoom,
      sprites: [...selection], kinds, view, pinned: !phone.matches, pinTitle: style.autoTitle ? pinTitle : null,
      voyages: style.voyages.filter((v) => !v.hidden).map((v) => ({ id: v.id, colour: ink[v.id], width: style.voyageWidth })), person: style.person, voyageWidth: style.voyageWidth,
      overlays: style.overlays.map((id) => ({ id, mode: style.overlayMode, sheet: style.sheets[id] ?? null, opacity: style.overlayOpacity })),
      sights: sightTiles().map(({ lon, lat, tile }) => ({ name: tile.title, lon, lat, ruin: tile.ruin ?? false, ...(tile.site != null && { site: tile.site }) })),
      debug: parseDebug(style.debug).debug, tune: parseTune(style.tune).tune,
    });
    if (me !== run) return; // a newer change or a move superseded this one
    ground = { world, coarse, bg, voyages: scene.voyages, marks: drawnMarks(scene), anchored: anchorScene(scene, data), overlays: scene.overlays, cards: { cartouche: kinds.includes('cartouche') ? scene.cartouche : null, scaleSprite: scene.scaleSprite, scale: style.scale, bg } };
    if (JSON.stringify(voyageInk()) !== inkKey) { showVoyage(); render(); return; } // the sheet laid or lifted changed which voyages cross it: draw again in their inks
    applyReveal();
    if (style.autoTitle) $('title').value = scene.cartouche.title; // the box shows what the cartouche letters, and cannot be edited
    placed = view;
    if (keepTile) keepTile = false; else hideTile(); // its mark may be gone: another voyage, or none; a sight's tile just opened stays
    if (reopen && !flightTo) { const t = reopen, m = sightHits(viewProjection(placed), { x0: 0, y0: 0, x1: W, y1: H }).find((h) => h.tile === t); reopen = null; if (m) showTileAt([m.x, m.y]); }
    cancelAnimationFrame(frame); frame = 0; // a moving frame still queued would paint over the scene
    const t1 = performance.now();
    const fading = scene.overlays.find((o) => o.mode === 'sheet' && o.id === fadeIn);
    if (fading) { fadeIn = null; fading.alpha = 0; } // drawn without the sheet, which fades in over it
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, scene, data, bg, { scale: 1, x: 0, y: 0 });
    if (fading) fadeSheet(fading, data.proj, me);
    drawPictures(ctx);
    drawSheetHandles(ctx);
    drawCards();
    placeSheetChips();
    preparePictures().then((fresh) => { if (fresh && me === run) repaint('pictures dealt'); }, () => {}); // the chosen subject's pictures, drawn once loaded
    const t2 = performance.now();
    $('status').textContent = `z${view.zoom.toFixed(1)}: load ${timing.load.toFixed(0)} ms, placement + parchment ${timing.place.toFixed(0)} ms, draw ${(t2 - t1).toFixed(0)} ms (total ${(t2 - t0).toFixed(0)} ms)`;
  } catch (e) {
    keepTile = false; // a sight's tile kept for this render is not kept for the next
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

// Seven buttons in the row and six drawers: the rose the settings, the chart the charts, the astrolabe the points of
// interest, the compass Go, the dividers and the medallion the timeline (voyages and people on one axis, each button
// opening it at its own lane), the anchor the anchorages.
// At most one is open. A click on a button opens its drawer and a second click shuts it; a click on another
// button shuts it and opens that one (the timeline's other button keeps it open and moves to its lane); Esc, or a
// click or a focus outside the row and the drawer, shuts it. A choice in it leaves it open, and the map does what
// was asked behind it (docs/spec/design.md, "A drawer stays open on a click or a choice"). On a wide screen the
// drawer hangs below the row, which it never covers or moves, and a touch on the map shuts it; on a phone it is a
// bottom sheet, and a tap or a drag on the map leaves it up (the user, 2026-10-30, reversing #262): that is how a
// control's effect is seen. An open drawer takes the focus (Go its
// text box, on a wide screen only, so a phone's keyboard does not cover the sheet); shut by the keyboard,
// the focus goes back to the button that opened it.
const where = $('where');
const drawers = [[$('open'), $('drawer')], [$('charts'), $('chartsDrawer')], [$('sights'), $('sightsPanel')], [$('go'), $('goPanel')], [$('voyages'), $('timelinePanel')], [$('people'), $('timelinePanel')], [$('anchor'), $('anchorPanel')]];
const openDrawer = () => drawers.find(([, d]) => d.classList.contains('open'))?.[1] ?? false;
let openedBy = null; // the button the open drawer was opened by: the timeline has two
const focusable = (d) => [...d.querySelectorAll('button, input, a[href]')].find((e) => !e.disabled && e.getClientRects().length);
function setDrawer(open, byKeyboard = false, by = drawers.find(([, d]) => d === open)?.[0] ?? null) { // the drawer to open, or false for none
  const was = openDrawer(), wasBy = openedBy;
  if (open === was && (!open || by === openedBy)) return;
  openedBy = open ? by : null;
  for (const [b, d] of drawers) { d.classList.toggle('open', d === open); b.setAttribute('aria-expanded', String(d === open && b === openedBy)); }
  if (open?.id === 'timelinePanel') fillTimeline(by === $('voyages') ? 'voyages' : 'people', open !== was); // the lists load on the first open
  if (open === was) return; // the timeline's other button: the same drawer, at the other lane
  document.documentElement.classList.toggle('sheet', !!open && !open.classList.contains('menu')); // on a phone the map makes room above the settings or the charts; a lighter drawer sits over its foot
  if (open?.id === 'chartsDrawer') chartsFresh = !style.overlays.length;
  if (open) (open.id === 'goPanel' ? (phone.matches ? null : $('coordsText')) : focusable(open))?.focus({ preventScroll: true });
  else if (byKeyboard) wasBy?.focus({ preventScroll: true });
  else if (was.contains(document.activeElement)) document.activeElement.blur(); // a phone's keyboard goes with it
}
for (const [b, d] of drawers) b.addEventListener('click', (e) => setDrawer(d === openDrawer() && b === openedBy ? false : d, e.detail === 0, b)); // detail 0: Enter or Space
addEventListener('keydown', (e) => { if (e.key === 'Escape' && openDrawer()) setDrawer(false, true); });
const outside = (t) => { const d = openDrawer(); return d && t instanceof Node && !where.contains(t) && !d.contains(t); };
// On a phone every drawer stays up while the map is tapped or moved.
addEventListener('pointerdown', (e) => { if (outside(e.target) && !(phone.matches && e.target === canvas)) setDrawer(false); });
addEventListener('focusout', (e) => { if (e.relatedTarget && outside(e.relatedTarget)) setDrawer(false); }); // tabbed out; a click that focuses nothing has no relatedTarget

// Reset: every control back to its default, the view (place and projection), the drawer's layout and hover kept. The hash holds the whole
// style, so a hash with only the view is the default style; the hashchange handler below redraws from it.
$('reset').addEventListener('click', () => {
  const m = hashParams().get('map'), p = hashParams().get('projection');
  $('shareUrl').hidden = true; $('shareNote').textContent = '';
  location.hash = [m && `map=${m}`, p && `projection=${p}`, layout !== 'default' && `layout=${layout}`, !hoverOpen && 'hover=0'].filter(Boolean).join('&');
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
    ['s:rose-catalan', 's:rose-catalan-small', 'v:rose-catalan', 'v:rose-catalan-small', 'v:cartouche-frame', 'v:merman', 'v:hippocampus', 'v:galley', 'v:caravel', ...HILLS, ...AGUIAR_SCAN],
    { density: 0.5, islands: true, seaTint: true, mountains: 'off' }), // the Catalan hills carry the relief
  fixedMood('Woodcut', 'printed: ink on paper, the Carta Marina’s and Paré’s creatures, hatched mountains', ['monster', 'ship'],
    ['p:rose', 's:cartouche-dewit', 's:serpent-a', 's:whale-b', 's:pistrix-c', 's:cete-e', 's:pare-truie', 's:pare-boar', 's:pare-lion', 's:pare-calf', 's:pare-elephant', 's:pare-bear', 's:pare-seaman', 's:pare-bishop', 'd:debry-monster', 's:ship-a', 's:ship-b', 's:ship-w-key', 's:ship-w-buss', 'd:debry-ship-a', 'd:debry-ship-b', 'd:debry-canoe', 'p:tower', 'p:tower-dome', 'p:house', 'p:church', 'p:castle', 'p:round-tower', 'p:tent'],
    { density: 1, land: 'off', rivers: 'marina', lakes: 'marina', mountains: 'ink', trees: 'ink', ink: '#1d1913', parchment: '#efe9dc' }),
  fixedMood('Illuminated', 'gilt land, blue rivers, coloured islands, the scanned roses, every Aguiar town', ['rose', 'monster', 'town'],
    ['s:rose-aguiar', 's:rose-catalan', 's:rose-catalan-small', 's:rose-prunes', 's:rose-aguiar-b', 'v:rose-fleurs', 'v:rose-fleurs-small', 'v:cartouche-frame', 'v:sea-dragon', 'v:sea-lion', 'v:dolphin', 'v:merman', 'v:hippocampus', 'v:walrus', 'v:galleon', 'v:caravel-heraldic', 'v:carrack', 'v:galley', 'v:caravel', ...HILLS, ...AGUIAR_SCAN, ...AGUIAR_DRAWN],
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
  frame = requestAnimationFrame(() => { frame = 0; paintFrame('moving'); });
}
function paintFrame(doing) {
  const t = performance.now();
  // the 10m cells placed last while they cover the view; 50m otherwise, until it stops and is placed again
  drawGround(ctx, covers(ground.world, view) ? ground.world : ground.coarse, view, ground.bg);
  // the placed ornaments, held to the earth; a flight leaves them out once it is more than fly.hold zoom levels from
  // where they were placed, since shrunk they crowd into a blot and grown they smear, and the coast keeps the place
  if (!flightTo || Math.abs(Math.log2(viewProjection(view).k / ground.anchored.k)) <= fly.hold) drawAnchored(ctx, ground.anchored, ground.bg, view);
  drawPictures(ctx);
  drawSheetHandles(ctx);
  drawCards(true);
  placeSheetChips();
  $('status').textContent = `z${view.zoom.toFixed(1)}: ${doing}, frame ${(performance.now() - t).toFixed(1)} ms`;
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

// A sheet (a chart's scan laid whole over the map) is moved by hand: held anywhere on it, it is dragged (the top one where they overlap);
// by the round handle at its bottom left corner it turns about its centre; by the square one at its bottom right
// it is resized. Where it is let go lands in the link (sheet=). Chips at its top left corner put it at the
// chart's own placement (Parallels, or Level) or at the fit of one of its coasts (overlays.json `snaps`).
const HANDLE = 12; // the handles' radius, canvas px
const sheetsShown = () => (ground?.overlays ?? []).filter((o) => o.mode === 'sheet' && o.sheet); // bottom to top
function sheetGeometry(o) {
  if (!o) return null;
  const proj = viewProjection(view), corners = sheetCorners(o, proj, o.sheet);
  return corners && { o, proj, corners };
}
function sheetHit([x, y]) {
  // every handle is drawn over every sheet, so a handle wins first, the top sheet's before a lower one's; then the top sheet under the point
  const geos = sheetsShown().reverse().map(sheetGeometry).filter(Boolean);
  const near = (c) => Math.hypot(c[0] - x, c[1] - y) <= HANDLE + cssPx(6);
  for (const geo of geos) {
    if (near(geo.corners[3])) return { kind: 'turn', ...geo };
    if (near(geo.corners[2])) return { kind: 'size', ...geo };
  }
  const geo = geos.find((g) => onSheet(g.o, g.proj, g.o.sheet, x, y));
  return geo ? { kind: 'move', ...geo } : null;
}
// The placements by id with `o`'s set to `sheet`; the chart's own placement is the default, left out of the link.
const withSheet = (o, sheet) => {
  const { [o.id]: _, ...rest } = style.sheets;
  return sheet && !sameSheet(sheet, ownSheet(o.id)) ? { ...rest, [o.id]: sheet } : rest;
};
let sheetTap = null; // where a press on the sheet began, until it moves far enough to be a drag: a tap there opens a note
let held = null; // { kind, o, proj, start, sheet (as taken), centre } while the sheet is held
let sheetFrameId = 0;
function holdSheet(hit, p) {
  held = { ...hit, start: p, sheet: { ...hit.o.sheet }, centre: hit.proj.project(hit.o.sheet.lon, hit.o.sheet.lat) };
  hideTile();
}
function dragSheet(p) {
  const { kind, proj, start, sheet, centre, o } = held;
  if (kind === 'move') {
    const [lon, lat] = proj.invert(centre[0] + p[0] - start[0], centre[1] + p[1] - start[1]);
    o.sheet = { ...sheet, lon, lat: Math.max(-85, Math.min(85, lat)) };
  } else if (kind === 'turn') {
    const a = Math.atan2(p[1] - centre[1], p[0] - centre[0]) - Math.atan2(start[1] - centre[1], start[0] - centre[0]);
    o.sheet = { ...sheet, turn: ((sheet.turn + (a * 180) / Math.PI + 540) % 360) - 180 };
  } else {
    const r = Math.hypot(p[0] - centre[0], p[1] - centre[1]) / Math.max(1, Math.hypot(start[0] - centre[0], start[1] - centre[1]));
    o.sheet = { ...sheet, scale: Math.max(sheet.scale / 8, Math.min(sheet.scale * 8, sheet.scale * r)) };
  }
  if (!sheetFrameId) sheetFrameId = requestAnimationFrame(() => { sheetFrameId = 0; paintFrame('the sheet held'); });
}
function dropSheet() {
  const { o } = held;
  held = null;
  cancelAnimationFrame(sheetFrameId); sheetFrameId = 0;
  style = { ...style, sheets: withSheet(o, o.sheet) };
  writeHash(); render();
}
// The handles, drawn over the scene and every moving frame: a ring with an arrow to turn, a square with a ⤢ to resize.
function drawSheetHandles(g) {
  for (const o of sheetsShown()) drawHandles(g, sheetGeometry(o));
}
function drawHandles(g, geo) {
  if (!geo) return;
  const [, , br, tr] = geo.corners, r = HANDLE; // the ring at the bottom left, the square at the bottom right
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.lineWidth = 1.5; g.strokeStyle = style.ink; g.fillStyle = style.parchment; g.lineCap = 'round';
  g.beginPath(); g.arc(tr[0], tr[1], r, 0, 2 * Math.PI); g.fill(); g.stroke();
  g.beginPath(); g.arc(tr[0], tr[1], r * 0.55, -Math.PI * 0.75, Math.PI * 0.6); g.stroke();
  const ax = tr[0] + r * 0.55 * Math.cos(Math.PI * 0.6), ay = tr[1] + r * 0.55 * Math.sin(Math.PI * 0.6);
  g.beginPath(); g.moveTo(ax - 4, ay - 0.5); g.lineTo(ax, ay + 0.5); g.lineTo(ax + 1, ay - 4); g.stroke();
  g.beginPath(); g.rect(br[0] - r, br[1] - r, 2 * r, 2 * r); g.fill(); g.stroke();
  const a = r * 0.55, h = r * 0.4; // the ⤢: a diagonal from bottom left to top right, an arrowhead at each end
  g.beginPath(); g.moveTo(br[0] - a, br[1] + a); g.lineTo(br[0] + a, br[1] - a); g.stroke();
  g.beginPath(); g.moveTo(br[0] + a - h, br[1] - a); g.lineTo(br[0] + a, br[1] - a); g.lineTo(br[0] + a, br[1] - a + h); g.stroke();
  g.beginPath(); g.moveTo(br[0] - a + h, br[1] + a); g.lineTo(br[0] - a, br[1] + a); g.lineTo(br[0] - a, br[1] + a - h); g.stroke();
  g.restore();
}
// The snap chips, at the top sheet's top left corner in the window (kept inside it), lit where that sheet lies now; the
// top sheet in view, where the top one's centre is past the horizon.
const sheetChips = $('sheetChips');
function placeSheetChips() {
  const geo = held ? null : sheetsShown().reverse().map(sheetGeometry).find(Boolean);
  if (!geo || geo.o.id !== sheetChips.dataset.id) { sheetChips.hidden = true; if (geo) buildSheetChips(geo.o); else return; }
  const [[x, y]] = geo.corners, rc = canvas.getBoundingClientRect();
  sheetChips.hidden = false;
  const w = sheetChips.offsetWidth, h = sheetChips.offsetHeight;
  sheetChips.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, rc.left + x * (rc.width / W) + 4))}px`;
  sheetChips.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, rc.top + y * (rc.height / H) - h - 6))}px`;
  for (const b of sheetChips.children) b.setAttribute('aria-checked', String(sameSheet(geo.o.sheet, b.dataset.snap == null ? ownSheet(geo.o.id) : geo.o.snaps[b.dataset.snap])));
}
function buildSheetChips(o) {
  sheetChips.dataset.id = o.id;
  const own = o.parallels ? ['Parallels', null, 'the chart\'s own placement: its drawn equator and tropic laid on today\'s'] : ['Level', null, 'the chart\'s own placement: level, centred between its coasts'];
  sheetChips.replaceChildren(...[own, ...o.snaps.map((sn, i) => [sn.label, i, `the scan at its ${sn.label} fit`])].map(([label, i, note]) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'chip', textContent: label, title: note });
    b.setAttribute('role', 'radio'); b.dataset.label = label; if (i != null) b.dataset.snap = i;
    return b;
  }));
}
sheetChips.addEventListener('click', (e) => {
  const b = e.target.closest('.chip'), o = sheetsShown().find((v) => v.id === sheetChips.dataset.id);
  if (!b || !o) return;
  const sn = b.dataset.snap == null ? null : o.snaps[b.dataset.snap];
  style = { ...style, sheets: withSheet(o, sn && { lon: sn.lon, lat: sn.lat, scale: sn.scale, turn: sn.turn }) };
  writeHash(); render();
});

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
  takeOver(); // a touch takes over from a flight
  if (!pointers.size && e.isPrimary && !held && !holding) {
    const p = toCanvas(e.clientX, e.clientY), pic = pictureHit(p), hit = pic ? null : sheetHit(p);
    if (looking != null && pic?.i !== looking) { endLook(); return; } // a press off the picture looked at lays it back, and only that
    if (pic) holdPicture(pic, p); else if (hit) { hideTile(); holdSheet(hit, p); sheetTap = p; }
    if (pic || hit) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; return; }
  }
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
  if (holding) { dragPicture(toCanvas(e.clientX, e.clientY)); return; }
  if (held) { const p = toCanvas(e.clientX, e.clientY); if (sheetTap && Math.hypot(p[0] - sheetTap[0], p[1] - sheetTap[1]) > cssPx(TAP_SLOP)) sheetTap = null; if (!sheetTap) dragSheet(p); return; }
  if (carried) { carried.corner = cornerAt(toCanvas(e.clientX, e.clientY)); showSnap(carried.corner, carried.w, carried.h); return; }
  if (!pointers.size) { const p = toCanvas(e.clientX, e.clientY); const pic = pictureHit(p)?.kind; canvas.style.cursor = cardAt(p) ? 'grab' : pic ? ({ move: 'grab', look: 'zoom-in', flip: 'pointer', link: 'pointer', away: 'pointer' }[pic] ?? '') : markAt(p) ? 'pointer' : { move: 'grab', turn: 'crosshair', size: 'nwse-resize' }[sheetHit(p)?.kind] ?? ''; return; } // a picture over the marks under it, as a press finds it
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
  if (holding) { canvas.style.cursor = ''; dropPicture(e); return; }
  if (held) { const at = sheetTap; sheetTap = null; canvas.style.cursor = ''; if (at) { held = null; if (e.type === 'pointerup') showTileAt(at); } else dropSheet(); return; } // a tap moved nothing: no render, which would hide the tile
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
  takeOver(); // the wheel takes over from a flight
  const [x, y] = toCanvas(e.clientX, e.clientY);
  const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines to px
  moved(zoomView(view, 2 ** (-px / 300), x, y));
  stopped(300);
}, { passive: false });

// ---------------------------------------------------------------- the tile

// A click or tap on a point of interest opens a small tile beside it with what there is to know: its heading,
// date, text and source, and for a voyage's mark a link to the source it cites. Nothing is lettered beside the mark itself. Today the points of interest are the
// voyages' events (scripts/scene.mjs voyageMarks) and the clouds by doubted legs (doubtMarks); the tile takes any { title, date, doubt, text, source }.
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
  const doubt = part('tile-text tile-doubt', t.doubt); // a doubted leg or event: who doubts it and why, first under the heading
  doubt?.prepend(Object.assign(document.createElement('strong'), { textContent: 'Scholars doubt this part: ' }));
  if (t.note) { // a note on a laid chart: what was drawn, what was there, and the source as a link; its title alone until it has copy
    const labelled = (label, body) => { const p = part('tile-text', body); if (!p) return null; const b = document.createElement('strong'); b.textContent = `${label} `; p.prepend(b); return p; };
    let src = null;
    if (t.link) {
      const a = document.createElement('a');
      a.href = t.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = t.source;
      src = document.createElement('p'); src.className = 'tile-source'; src.append('Source: ', a);
    }
    tileEl.replaceChildren(close, ...[head, labelled('Drawn.', t.drawn), labelled('Really.', t.real), src].filter(Boolean));
    tileEl.setAttribute('aria-label', t.title);
    return;
  }
  const source = part('tile-source', t.source && `Source: ${t.source}`);
  let more = null;
  if (t.cited) { // a voyage's event or death: the source it cites, as a link out
    const a = document.createElement('a');
    a.href = t.cited.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = t.cited.title;
    more = document.createElement('p'); more.className = 'tile-source'; more.append('Read: ', a);
  }
  const pics = t.sight ? sightPics(t.sight, t.site ?? null) : null; // a sight's pictures, each on the table or off it
  tileEl.replaceChildren(close, ...[head, doubt, meta, text, source, more, pics].filter(Boolean));
  tileEl.setAttribute('aria-label', t.title ?? 'Point of interest');
}
// A sight's pictures in its tile, as the person card shows a person's (picsHTML): once its records are loaded and it is
// the subject chosen; null otherwise
function sightPics(name, site) {
  const s = subject();
  if (!s || s.kind !== 'sight' || s.id !== name) return null;
  const div = document.createElement('div');
  div.className = 'pics'; div.setAttribute('role', 'group'); div.setAttribute('aria-label', 'Pictures, on the table or off it');
  div.innerHTML = picsHTML(s, picturesOf(s), siteSet(s, site));
  return div;
}
tileEl.addEventListener('click', (e) => {
  const pic = e.target.closest('[data-pic]'), s = subject();
  if (pic && s?.kind === 'sight') setOnTable(Number(pic.dataset.pic), !picturesOf(s).includes(Number(pic.dataset.pic)));
});
let tileShown = null; // the tile open, by its object
// every listed place with a tile, once by name (or once per spot its tile names), at the view its button flies to
let sightList = null;
function sightTiles() {
  sightList ??= [...new Map([...places.map(({ name, view: v }) => [name, v]), ...CHARTS.map(({ made }) => [made.title, made])]).entries()]
    .filter(([name]) => SIGHT_TILES[name]).flatMap(([name, v]) => { const { at, ...tile } = SIGHT_TILES[name], spots = at ? (Array.isArray(at[0]) ? at : [at]) : [[v.lon, v.lat]];
      return spots.map(([lon, lat], k) => ({ lon, lat, tile: { title: name, sight: name, ...(spots.length > 1 ? { site: k } : {}), ...tile } })); });
  return sightList;
}
// the mark at [x, y]: a voyage's event or a sight within reach; else the note on a laid chart whose figure holds the
// point (its whole hit box, drawn nowhere; the smallest where boxes nest); else a note's centre within reach (notes.mjs pickMark)
function markAt(at) {
  const proj = viewProjection(placed), rect = { x0: 0, y0: 0, x1: W, y1: H };
  const marks = [...(ground?.voyages ?? []).filter((v) => !(v.reveal < 1)).flatMap((v) => [...voyageMarks(v.voyage, proj, rect), ...doubtMarks(v, proj, rect)]), ...(placed.zoom >= POI_ZOOM ? sightHits(proj, rect) : []), ...laidNotes(proj, rect)];
  return pickMark(marks, at, cssPx(TAP_REACH));
}
// The marks the scene drew for the places with a tile, where it drew them (a sight's several marks spread apart, a
// ruin moved clear of a town): { x, y, h, name, site } in canvas px, centred on the icon, `h` its reach, the icon's
// half-diagonal and a margin, so a tap anywhere on it or just off it takes it
const MARK_MARGIN = 8;
const drawnMarks = (scene) => (scene.lesser ?? []).filter((l) => l.mark && l.label).map((l) => ({ x: l.label.cx, y: l.label.cy, h: 2 * (Math.hypot(l.label.hw, l.label.hh) + MARK_MARGIN), name: l.name, site: l.site ?? null }));
// Each listed place's mark to hit: the one drawn for it, by name and mark, where the scene drew one; else where the place
// is (a place lettered on the chart, or a stand-in left out for want of room)
function sightHits(proj, rect) {
  const drawn = ground?.marks ?? [];
  return sightTiles().flatMap((spot) => {
    const m = drawn.find((d) => d.name === spot.tile.title && d.site === (spot.tile.site ?? null));
    return m ? [{ x: m.x, y: m.y, h: m.h, tile: spot.tile }] : sightMarks([spot], proj, rect);
  });
}
// The laid charts' notes: each sheet's, less those an upper sheet covers, since only the top sheet's figure shows there
const laidNotes = (proj, rect) => (ground?.overlays ?? []).flatMap((o, i, all) => noteMarks(o, proj, rect)
  .filter((m) => !all.slice(i + 1).some((u) => u.mode === 'sheet' && u.sheet && onSheet(u, proj, u.sheet, m.x, m.y))));
function showTileAt(at) {
  const best = markAt(at);
  if (!best) return;
  tileShown = best.tile;
  if (best.tile.sight) { // the sight becomes the subject: its pictures onto the table, and into the tile once their records are read
    chooseSight(best.tile.sight, DEFAULTS.pictures, best.tile.site ?? null, best.tile);
    if (!sightData) loadSights().then(() => { if (tileShown === best.tile && !tileEl.hidden) showTileAt(at); }, () => {});
  }
  fillTile(best.tile);
  // beside the mark's hit area (what a tap on it would hit, markClear) and a margin clear of it: to its right, flipped to its left, below or above
  // where the window has no room (tileSpot), in client px
  const r = canvas.getBoundingClientRect(), kx = r.width / W, ky = r.height / H;
  const c = markClear(best, cssPx(TAP_REACH)), near = best.hit ? at : [best.x, best.y];
  tileEl.hidden = false;
  const spot = tileSpot({ x0: r.left + c.x0 * kx, y0: r.top + c.y0 * ky, x1: r.left + c.x1 * kx, y1: r.top + c.y1 * ky },
    [tileEl.offsetWidth, tileEl.offsetHeight], { w: innerWidth, h: innerHeight }, [r.left + near[0] * kx, r.top + near[1] * ky]);
  tileEl.style.left = `${spot.left}px`; tileEl.style.top = `${spot.top}px`;
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
// A group: [heading, rows, open, span] (an empty heading for none); at most one group open at a time, on load the first marked open,
// else the first; an era's span of years shows beside its heading with its count;
// a row: [name, view, title, text], the title the cartouche's when it differs from the name. A row with a tile
// in SIGHT_TILES takes the line under its name (the tile's date) and its caption (the tile's text) from it.
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
  ], 'open'],
  ['Seas and islands', [
    ['Guam', at(144.79, 13.44, 7)], // Islas de los Ladrones
    ['Cebu', at(123.89, 10.32, 7)],
    ['Maluku Islands', at(128, -3, 5)],
    ['Solomon Islands', at(160, -9, 5)],
    ['Marquesas Islands', at(-140, -9, 6)],
    ['Pukapuka Atoll', at(-138.8, -14.82, 6.5), 'Pukapuka'], // Magellan's San Pablo, 1521 (the Tuamotu one)
    ['Pitcairn Islands', viewOfFrame({ lonMin: -131.3, lonMax: -124.2, latMin: -26.6, latMax: -22.4 })], // all four; the latitudes padded so the longitudes bind
  ], 'open'],
];
// the places that are lettered on the chart whatever the city data holds are in scripts/pois.mjs
const port = (lon, lat) => at(lon, lat, 7.5);
const CHARTMAKING = 'charts made here'; // after a port's date, for a city known more for its mapmakers
const SIGHTS = [
  // the noteworthy ports, in four eras of six, most of them outside Europe; a port whose name has changed lists
  // as its title, the historic name first and today's in brackets
  ['The ancient world', [
    ['Alexandria', port(29.89, 31.20)],
    ['Tyre', port(35.20, 33.27)],
    ['Carthage', port(10.33, 36.84)],
    ['Ostia', port(12.29, 41.76)],
    ['Berenike', port(35.47, 23.91)],
    ['Barygaza', port(72.99, 21.71), 'Barygaza (Bharuch)'],
  ], null, 'c. 1000 BC – 2nd c. AD'],
  ['The medieval Indian Ocean and Asia', [
    ['Siraf', port(52.33, 27.67)],
    ['Aden', port(45.03, 12.78)],
    ['Kilwa', port(39.52, -8.96), 'Kilwa Kisiwani'],
    ['Calicut', port(75.78, 11.25), 'Calicut (Kozhikode)'],
    ['Malacca', port(102.25, 2.19), 'Malacca (Melaka)'],
    ['Quanzhou', port(118.68, 24.87)],
  ], null, '9th–15th c.'],
  ["Mali's trade network", [ // the Sahara's roads and the Niger's towns and goldfields (docs/learn/trans-saharan-trade.md); the roads are marked mid-route
    ['Niani', port(-9.15, 11.43)],
    ['Timbuktu', port(-3.01, 16.77)],
    ['Gao', port(-0.04, 16.27)],
    ['Walata', port(-7.03, 17.30)],
    ['Taghaza', port(-5.0, 23.6)],
    ['Bambuk', at(-11.5, 13.5, 7)],
    ['Bure', at(-10.0, 10.6, 7)],
    ['The western road', at(-5.8, 21.0, 6)],
    ['The road to Egypt', at(6.78, 17.52, 6)],
  ], null, '8th–16th c.'],
  ['The age of discovery', [
    ['Lisbon', port(-9.14, 38.72)], // also where charts were made
    ['São Jorge da Mina', port(-1.35, 5.08), 'São Jorge da Mina (Elmina)'],
    ['Goa', port(73.91, 15.50)],
    ['Manila', port(120.98, 14.60)],
    ['Acapulco', port(-99.88, 16.86)],
    ['Batavia', port(106.83, -6.18), 'Batavia (Jakarta)'],
    ['Seville', port(-5.98, 37.39), null, null, CHARTMAKING],
    ['Genoa', port(8.93, 44.41), null, null, CHARTMAKING],
    ['Venice', port(12.33, 45.44), null, null, CHARTMAKING],
    ['Majorca', at(3.0, 39.6, 7), null, null, CHARTMAKING],
    ['Dieppe', port(1.08, 49.93), null, null, CHARTMAKING],
  ], 'open', '1311–1619'],
  ['The modern world', [
    ['Suez', port(32.55, 29.97)],
    ['Panama', port(-79.53, 8.97)],
    ['Singapore', port(103.83, 1.28)],
    ['Hong Kong', port(114.20, 22.30)],
    ['Shanghai', port(121.47, 31.23)],
    ['Rotterdam', port(4.48, 51.92)],
  ], null, '1819–1914'],
];
// name, year, view, [the city it was made in, its view], text, the id of its scan in packs/overlays/overlays.json (none without one)
const CHARTS = [
  ['Carte Pisane', 'c. 1275', both([7.4, 40.0, 8], [27.4, 36.8, 7.5]), ['Genoa', port(8.93, 44.41)]], // maker unknown; Genoa the usual attribution, Pisa only its owners
  ['Vesconte', '1311', around(25.2, 37.5, 3), ['Genoa', port(8.93, 44.41)]], // signed "de Janua"; he later worked in Venice, and where this sheet was drawn is disputed
  ['Dulcert', '1339', around(14.5, 40.0, 17), ['Majorca', port(2.65, 39.57)]], // signed in the city of Majorca, today's Palma
  ['Catalan Atlas', '1375', both([-20.7, 42.1, 16], [-5.4, 42.3, 16]), ['Majorca', port(2.65, 39.57)], null, 'catalan-atlas'], // Cresques Abraham's workshop, Palma; its eight map pages side by side
  ['Catalan Atlas, Mediterranean, a copy of 1959', '1375, copied 1959', viewOfFrame({ lonMin: -24, lonMax: 42.8, latMin: 22.2, latMax: 55.6 }), ['Majorca', port(2.65, 39.57)], null, 'catalan-atlas-1959-copy'], // a painted copy (Library of Congress, CC BY 3.0), not the original; its view is its own sheet's frame (sheetFrame of its placement), Gibraltar to Cyprus
  ['Chart of Jorge de Aguiar', '1492', at(2.64, 31.29, 3.18), ['Lisbon', port(-9.14, 38.72)], null, 'aguiar'], // the Beinecke Library's chart; Lisbon, Portugal's chartmaking port, the usual attribution
  ['Map of Juan de la Cosa', '1500', both([-45, 23.4, 15], [65, 23.4, 15]), ['El Puerto de Santa María', port(-6.23, 36.60)], null, 'de-la-cosa'], // signed "la fizo en el puerto de S. Mª"
  ['Carta Marina', '1539', viewOfFrame({ lonMin: 0, lonMax: 40, latMin: 54, latMax: 72 }), ['Venice', port(12.33, 45.44)], null, 'carta-marina'], // Olaus Magnus had it printed there
  ['World map of Battista Agnese', 'c. 1544', at(-21.83, -6.47, 0.78), ['Venice', port(12.33, 45.44)], null, 'agnese-world'], // map 10 of his atlas, made in Venice (Library of Congress)
  ['Fernão Vaz Dourado, North Atlantic', '1580', at(-31.75, 55.58, 2.78), ['Goa', port(73.83, 15.50)], null, 'dourado-atlantic'], // chart 4 of his atlas, made at Goa (Bayerische Staatsbibliothek)
  ['De Bry, Virginia', '1590', at(-76, 36.28, 7.47), ['Frankfurt', port(8.68, 50.11)]], // de Bry's America, part I, printed at Frankfurt am Main
].map(([name, year, v, [city, made], text, overlay = null]) => ({ name, year, view: { ...v, title: name }, made: { ...made, title: city }, text, overlay }));
const places = []; // every anchorage and point of interest: { name, view }

// The voyages: any number drawn at once, none by default. They are the lower lane of the timeline (the section
// "timeline" below), data/voyages/index.json in the order the voyages set out (chronological; the file's order breaks
// ties), each on its own line at its years: a bar over them, and beside it the voyage's row, its short name and years
// (the title is its tooltip), an eye, then its ink, a swatch to pick another. A shown voyage has its summary and a link
// to its first source under its row. They load on the first open and stay cached. A click on the name shows that
// voyage alone (every other one is hidden), flies to frame the whole of it and draws its line on from start to end,
// every time, in the seconds the slider above the timeline sets. The eye only shows or hides that one voyage, at once: no
// flight, no pen, no other voyage touched. A voyage hidden keeps its place in the list, so its colour, and every other
// voyage's, stays put. The first voyage chosen is the chart's red, each further one a colour of its own (voyageColours).
// Above the timeline, the line weight for them all, how long the pen takes, and Clear. The choice rides in the link
// (`voyages=`, `voyagewidth=`, `voyagedraw=`) like any style.
let voyageList = null, voyageRows = null; // the load, and once loaded [[id, voyage]] in order with the sources
const escapeHTML = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
// the row at its place on the axis: the bar over its years, and the row to the bar's right where there is room, else to its left
const voyageItem = (id, full, brief, when, summary, link, [x0, x1]) => {
  const right = x1 < 0.6, at = right ? `left:calc(${pc(x1)} + 4px)` : `right:calc(${pc(1 - x0)} + 4px)`;
  return `<li data-row="${id}"><div class="vline"><span class="vbar" style="left:${pc(x0)};width:${pc(Math.max(0.006, x1 - x0))}"></span><span class="vctl" style="${at}">` +
  `<button type="button" class="vname" data-voyage="${id}" title="${full}${when ? `, ${when}` : ''}">` +
  `<svg viewBox="0 0 28 18" aria-hidden="true"><path d="M2 9h24" fill="none" stroke-linecap="round"/></svg>` +
  `<span class="full">${full}</span><span class="brief">${brief}${when ? `<span class="when">${when}</span>` : ''}</span></button>` +
  `<button type="button" class="eye" data-eye="${id}" aria-pressed="false" aria-label="Show ${full}" title="Show or hide ${full}">${EYE}</button>` +
  `<input type="color" data-ink="${id}" aria-label="Colour of ${full}" title="Colour of ${full}" hidden></span></div>` +
  (summary || link ? `<p class="vsum" style="${right ? `margin-left:${pc(x0)}` : `margin-left:auto;margin-right:${pc(1 - x1)}`}"><b>${full}</b>. ${summary}${link ? ` <a href="${escapeHTML(link.url)}" target="_blank" rel="noopener" title="${escapeHTML(link.label)}">Read more</a>` : ''}</p>` : '') + '</li>';
};
const voyagesTools = groupTools('Voyages', {
  all: () => style.voyages, dflt: [], get: () => style.voyages,
  set: () => { style = { ...style, voyages: [] }; showVoyage(); writeHash(); render(); },
});
$('timelinePanel').querySelector('.vtools').append(...voyagesTools.children);
// the ink of every voyage in the list, hidden ones too, so a colour stays with its voyage
// (a voyage with no colour picked takes one from the high-contrast palette while any of it crosses a sheet, or if a leg is dashed or dotted)
// the sheets laid as the style has them now (not as last drawn), each with the placement it lies at; none unless whole sheets
const laidSheets = () => (style.overlayMode !== 'sheet' ? [] : style.overlays.flatMap((id) => { const o = OVERLAYS.find((v) => v.id === id); return o ? [{ ...o, sheet: style.sheets[id] ?? o.sheet }] : []; }));
const brokenIds = new Set(); // the listed voyages with a dashed or dotted leg, which take a high-contrast ink
const brokenSeen = new Set(); // the voyages whose file has been read for that
// reads the files of voyages not yet seen, so a link's inks are right on the first render, with the drawer closed
const learnBroken = (ids) => Promise.all(ids.filter((id) => !brokenSeen.has(id)).map((id) => env.readJSON(`data/voyages/${id}.json`)
  .then((v) => { brokenSeen.add(id); if (isBroken(v)) brokenIds.add(id); }, () => brokenSeen.add(id))));
const voyageDots = new Map(); // id -> a thinned sample of its path, [lon, lat], once the list has loaded
const crossing = () => {
  const ids = new Set(brokenIds);
  if (!voyageDots.size) return ids; // before the list has loaded (and before OVERLAYS exists)
  const sheets = laidSheets();
  if (!sheets.length) return ids;
  const proj = viewProjection(view);
  for (const [id, dots] of voyageDots) if (dots.some(([lon, lat]) => { const p = proj.project(lon, lat); return p && sheets.some((o) => onSheet(o, proj, o.sheet, p[0], p[1])); })) ids.add(id);
  return ids;
};
const voyageInk = () => voyageColours(style.voyages.map((v) => v.id), Object.fromEntries(style.voyages.filter((v) => v.colour).map((v) => [v.id, v.colour])), crossing());
const isShown = (id) => style.voyages.some((v) => v.id === id && !v.hidden);
function showVoyage() {
  const ink = voyageInk();
  for (const b of $('voyageList').querySelectorAll('[data-voyage]')) {
    const id = b.dataset.voyage, listed = id in ink, on = isShown(id), line = b.querySelector('path'), row = b.closest('li'), pick = row.querySelector('[data-ink]'), eye = row.querySelector('[data-eye]');
    b.dataset.shown = String(on);
    row.classList.toggle('on', on);
    row.querySelector('.vbar').style.setProperty('--c', listed ? ink[id] : '#6b5a44');
    line.setAttribute('stroke', listed ? ink[id] : 'currentColor');
    line.setAttribute('stroke-width', String(style.voyageWidth));
    line.setAttribute('stroke-dasharray', on ? '' : '2 3');
    line.setAttribute('opacity', on ? '1' : '0.45');
    eye.setAttribute('aria-pressed', String(on));
    eye.setAttribute('aria-label', `${on ? 'Hide' : 'Show'} ${b.querySelector('.full').textContent}`);
    pick.hidden = !listed;
    if (listed) pick.value = ink[id];
  }
  for (const f of toolRefreshers) f();
}
function fillVoyages() {
  voyageList ??= Promise.all([env.readJSON('data/voyages/index.json'), env.readJSON('data/voyages/sources.json').catch(() => ({}))])
    .then(([ids, sources]) => Promise.all(ids.map((id) => env.readJSON(`data/voyages/${id}.json`).then((v) => [id, v], () => [id, { title: id, short: id }])))
      .then((voyages) => [chronological(voyages), sources]))
    .then(([voyages, sources]) => {
      for (const [id, v] of voyages) { brokenSeen.add(id); if (isBroken(v)) brokenIds.add(id); }
      for (const [id, v] of voyages) voyageDots.set(id, (v.legs ?? []).flatMap((leg) => (leg.points?.length > 1 ? legPath(leg) : [])).filter((_, i) => i % 4 === 0));
      voyageRows = { voyages, sources }; drawVoyages();
    }, (e) => { voyageList = null; $('voyageList').innerHTML = `<li>${escapeHTML(e.message)}</li>`; });
  showVoyage();
  return voyageList;
}
// the voyages' lane on the timeline's axis; an undated voyage sits at the axis's right end
function drawVoyages() {
  if (!voyageRows) return;
  const { voyages, sources } = voyageRows;
  $('voyageList').innerHTML = voyages.map(([id, v]) => {
    const [a, b] = voyageYears(v.when), x0 = Number.isFinite(a) ? timeAxis.x(a) : 1, x1 = Number.isFinite(b) ? timeAxis.x(b) : 1;
    return voyageItem(escapeHTML(id), escapeHTML(v.title ?? id), escapeHTML(v.short ?? v.title ?? id), escapeHTML(v.when), escapeHTML(v.summary), voyageLink(v, sources), [x0, x1]);
  }).join('');
  showVoyage();
}
// Sets which voyages are shown: `show` maps an id to true or false; a voyage not yet listed is added at the end, so it
// takes the next free colour. A hidden voyage keeps its place and its colour.
function showVoyages(show, others) {
  const listed = style.voyages.map((v) => v.id), on = (v) => show[v.id] ?? (others ?? !v.hidden);
  const voyages = [...style.voyages, ...Object.keys(show).filter((id) => show[id] && !listed.includes(id)).map((id) => ({ id, colour: null }))];
  style = { ...style, voyages: voyages.map((v) => (on(v) ? { id: v.id, colour: v.colour } : { id: v.id, colour: v.colour, hidden: true })) };
  showVoyage(); writeHash(); render();
}
$('voyageList').addEventListener('click', async (e) => {
  const eye = e.target.closest('[data-eye]'), b = e.target.closest('[data-voyage]');
  if (eye) { // that voyage on or off, whole and at once; the view stays, and no other voyage changes
    const id = eye.dataset.eye;
    if (voyagePen?.id === id) voyagePen = null; // a pen on it stops, and the line is whole
    showVoyages({ [id]: !isShown(id) });
    return;
  }
  if (!b) return;
  const id = b.dataset.voyage; // that voyage alone, framed, and drawn on afresh
  showVoyages({ [id]: true }, false);
  await flyToVoyage(id);
  if (isShown(id) && !matchMedia('(prefers-reduced-motion: reduce)').matches) drawOn(id);
});
// How long the pen takes, in seconds (VOYAGE_DRAW): the slider shows the seconds, and its sample line draws itself on
// at that pace each time it moves. Only the next drawing changes, so nothing is drawn again.
// (showStyle calls showVoyageDraw before this part of the page has run, so it reads the slider afresh)
function showVoyageDraw() {
  const slider = Object.assign($('voyageDraw'), { min: VOYAGE_DRAW.min, max: VOYAGE_DRAW.max, step: VOYAGE_DRAW.step });
  slider.value = String(style.voyageDraw);
  $('voyageDrawOut').textContent = `${style.voyageDraw} s`;
}
const drawSlider = $('voyageDraw');
let drawSample = null; // the sample line's animation, cancelled when the slider moves again
drawSlider.addEventListener('input', () => {
  style = { ...style, voyageDraw: voyageDrawSeconds(drawSlider.value) };
  showVoyageDraw(); writeHash();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    drawSample?.cancel();
    drawSample = $('voyageDrawSample').querySelector('path').animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: style.voyageDraw * 1000, easing: 'linear' });
  }
});
// The pen: a voyage's line drawn from its start to its end in the slider's seconds, at an even pace along the line,
// once the flight has landed and the scene is placed. The scene's voyage carries `reveal` (scene.mjs drawTrack).
let voyagePen = null; // { id, since, t0, ms } while drawing, t0 null until it starts
function applyReveal() {
  const v = voyagePen && ground?.voyages?.find((x) => x.id === voyagePen.id);
  if (v) v.reveal = voyagePen.t0 == null ? 0 : Math.min(1, (performance.now() - voyagePen.t0) / voyagePen.ms);
}
// every exit of the pen puts the line back whole: a pen that stops early must not leave its voyage hidden
function finish(id) { const v = ground?.voyages?.find((x) => x.id === id); if (v && 'reveal' in v) { delete v.reveal; render(); } }
function drawOn(id) {
  const pen = voyagePen = { id, since: performance.now(), t0: null, ms: style.voyageDraw * 1000 };
  const step = () => {
    if (voyagePen !== pen) { // stopped by a later click, which repaints: a new pen (on the same voyage it owns the reveal), or an eye's render
      const v = ground?.voyages?.find((x) => x.id === id);
      if (v && voyagePen?.id !== id) delete v.reveal;
      return;
    }
    const now = performance.now();
    if (pen.t0 == null) { // wait for the flight to land and the scene to be placed with this voyage in it
      if (flightTo == null && placed === view && ground?.voyages?.some((x) => x.id === id)) pen.t0 = now;
      else if (now - pen.since > 10000) { voyagePen = null; return finish(id); }
    }
    applyReveal();
    if (pen.t0 != null) paintFrame('drawing');
    if (pen.t0 != null && now - pen.t0 >= pen.ms) {
      voyagePen = null;
      finish(id); // whole again, with its marks
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
let picking = 0; // a colour is placed when the picker pauses, not on every step of a drag across it
// The name always flies to the view that frames the whole voyage, whatever of it is in view. The last choice wins,
// however the loads interleave: an earlier choice is dropped only once a later one has flown. Resolves once the
// flight is under way (or not needed).
let voyageChosen = 0, voyageFlown = 0;
function flyToVoyage(id) {
  const n = ++voyageChosen;
  return readVoyage(id, (path) => env.readJSON(path)).then((v) => {
    if (n < voyageFlown || !isShown(id)) return;
    const to = voyageView(v, flightTo ?? view, undefined, true, windowRect());
    if (to) { voyageFlown = n; if (style.sheetHides) clearSheetFor(to, true); goTo(to); }
  }, () => {});
}
$('voyageList').addEventListener('input', (e) => {
  const id = e.target.dataset?.ink;
  if (!id) return;
  style = { ...style, voyages: style.voyages.map((v) => (v.id === id ? { ...v, colour: e.target.value.toLowerCase() } : v)) };
  showVoyage(); writeHash();
  clearTimeout(picking); picking = setTimeout(render, 150);
});

// ---------------------------------------------------------------- people

// The people: the upper lane of the timeline (the section "timeline" below), one life bar per person
// (data/voyages/people.json, scripts/people.mjs) on the shared year axis, so who overlapped whom shows; a bar fades where
// the record leaves a birth or a death undated. A click on a bar chooses that person (a second click lets them go): their bar turns
// red, their voyages are drawn lit in the chart's red and every other voyage chosen is dimmed (the scene's `person`),
// their birth is marked, the map flies to frame them, and all their pictures are dealt onto the map as onto a chart
// table, a little askew, to drag by hand, resize by a corner and turn over to read what each is and follow it to its
// page. Under their bar their card: the name and the years, the bio, each voyage with its summary written out, and
// the pictures as thumbnails, each of which takes it off the table or puts it back.
// The choice rides in the link (`person=`, `pictures=`, `pictureat=`).
//
// A sight whose tile is opened (showTileAt) is chosen the same way: its pictures (data/sights/pictures.json, built into
// packs/overlays/sights/) are dealt in a row just south of its marks, and its tile shows them as thumbnails. The person
// or the sight is the subject (subject()); choosing either puts the other's pictures away. A sight rides as `sight=`.
function loadPeople() {
  peopleLoad ??= Promise.all([env.readJSON(PEOPLE_FILE), env.readJSON(PICTURES_FILE).catch(() => ({ pictures: {} })), env.readJSON('data/voyages/sources.json').catch(() => ({}))])
    .then(async ([records, { pictures }, sources]) => {
      const people = peopleOf(records, await whoOf(env.readJSON));
      const ids = [...new Set(people.flatMap((p) => p.voyages))];
      const vs = await Promise.all(ids.map((id) => readVoyage(id, (path) => env.readJSON(path)).catch(() => null)));
      peopleData = { people, pictures, sources, voyages: Object.fromEntries(ids.map((id, i) => [id, vs[i]]).filter(([, v]) => v)) };
      return peopleData;
    }, (e) => { peopleLoad = null; throw e; });
  return peopleLoad;
}
const personOf = (id) => peopleData?.people.find((p) => p.id === id) ?? null;
let sightData = null, sightLoad = null; // { images: { [name]: [record] }, pictures: the manifest }
function loadSights() {
  sightLoad ??= Promise.all([env.readJSON(SIGHT_PICTURES_FILE).catch(() => ({})), env.readJSON(SIGHT_MANIFEST_FILE).catch(() => ({ pictures: {} }))])
    .then(([records, { pictures }]) => { sightData = { images: sightPicturesOf(records), pictures }; return sightData; }, (e) => { sightLoad = null; throw e; });
  return sightLoad;
}
// The subject chosen, whose pictures lie on the table: { key, kind, id, images, manifest }, the person chosen or the sight
// whose tile was opened, once its records are loaded; null for none
const sightKey = () => `sight:${style.sight}${style.site == null ? '' : `@${style.site}`}`; // a mark's deal is its own
const subjectKey = () => (style.person ? `person:${style.person}` : style.sight ? sightKey() : null);
function subject() {
  if (style.person) { const p = personOf(style.person); return p && { key: `person:${p.id}`, kind: 'person', id: p.id, person: p, images: p.images, manifest: peopleData.pictures }; }
  if (style.sight && sightData && Object.hasOwn(sightData.images, style.sight)) return { key: sightKey(), kind: 'sight', id: style.sight, images: sightData.images[style.sight], manifest: sightData.pictures };
  return null;
}
async function loadSubject() { if (style.person) await loadPeople(); else if (style.sight) await loadSights(); return subject(); }
// A sight chosen: its pictures (`pictures`, else those of the mark opened, `site`, else all) onto the table, a person's
// off it. Opening the same mark's tile again changes nothing while any of its pictures lie on the table; once all are
// put away it deals them again. A sight with several marks (Tyre's city site and Al-Bass) splits its pictures between
// them by each record's `site`, the mark's place in its tile's `at`; the link carries it as `site=`.
let keepTile = false;
function chooseSight(name, pictures = DEFAULTS.pictures, site = null, tile = null) { // `tile`: the mark's tile it was opened from
  if (style.sight === name && style.site === site && !style.person && style.pictures?.length !== 0) return;
  const hadPerson = clearTable(false); // whatever lies on the table put away first, as the skull does; the tile just opened stays
  style = { ...style, sight: name, site, pictures };
  dealViews.delete(sightKey());
  dealing = sightKey(); // dealt where dealSight says: in place, or as the map arrives
  showPeople(); showSightCard(); writeHash();
  if (sightData) dealSight(tile); else loadSights().then(() => dealSight(tile), () => { dealing = null; });
  if (hadPerson) { keepTile = true; render(); } // the person's voyages back in their own inks
}
function dealNow(key = dealing) {
  if (!dealing || key !== dealing) return;
  dealing = null; dealt = null;
  writeHash();
  if (ground) repaint('pictures dealt');
  preparePictures().then(() => { if (ground) repaint('pictures dealt'); }, () => {});
}
// The table cleared, as the skull in the right margin clears it and as every fly does first: every card put away, the
// subject let go (no person lit, no sight chosen, no picture kept in the link) and, with `hide`, the tile shut; the
// broom sweeps across the map where any card lay. Voyages drawn stay. True when a person was chosen, whose voyages the
// scene drew lit: the caller draws the map again.
function clearTable(hide = true) {
  const hadPerson = Boolean(style.person), lay = onTable > 0;
  dealing = null; reopen = null;
  if (hide) hideTile();
  if (style.person || style.sight || style.pictures != null || Object.keys(style.pictureAt ?? {}).length) {
    style = { ...style, person: null, sight: null, site: null, pictures: DEFAULTS.pictures, pictureAt: {} };
    flips.clear(); links.clear(); raised = []; looking = null; focusedPic = null;
    showPeople(); showSightCard(); writeHash();
  }
  if (lay) { sweepBroom(); if (ground) repaint('pictures swept'); }
  return hadPerson;
}
// A sight's pictures are dealt along the foot of the view they are dealt in (sightDeal), the place clear above them:
// the view as it is, or, from afar, the place at SIGHT_ZOOM, flown to; where the row would cover the place, the map
// moves to put the place in the middle. Once dealt they stay put on the map, as a person's do.
const SIGHT_ZOOM = 9.5, FLY_WIDER = 1; // the zoom a sight is dealt at from afar; how much wider than it counts as afar
let reopen = null; // the tile of the mark whose deal the map is flying to, opened again beside the mark once it lands
const dealViews = new Map(); // the view a sight's pictures were dealt in, by subject
// where a sight's row is dealt under: the mark opened, else the middle of its marks
function placeOfSight(s, f) {
  const spot = style.site != null && sightTiles().find(({ tile }) => tile.sight === s.id && tile.site === style.site);
  return spot ? [spot.lon, spot.lat] : [(f.lonMin + f.lonMax) / 2, (f.latMin + f.latMax) / 2];
}
// a sight's pictures for one of its marks (`site`), by index; null for all of them
const siteSet = (s, site) => (site == null || !s.images.some((im) => im.site === site) ? null : s.images.flatMap((im, i) => (im.site === site ? [i] : [])));
function dealSight(tile = null) {
  const s = subject();
  if (s?.kind !== 'sight') return;
  if (dealViews.has(s.key)) { dealNow(s.key); return; }
  const f = frameOfSubject(s), at = placeOfSight(s, f), sizes = picturesOf(s).map((i) => pictureSize(s, i)).filter(Boolean);
  const zoom = Math.min(SIGHT_ZOOM, viewContaining(f, { w: W, h: H }).zoom);
  let to = view.zoom < zoom - FLY_WIDER ? { ...view, lon: at[0], lat: at[1], zoom } : view;
  if (!sightDeal(sizes, windowRect(), viewProjection(to).project(...at)).clear) to = { ...to, lon: at[0], lat: at[1] };
  dealViews.set(s.key, clampView({ ...to, projection: view.projection }));
  if (to === view) { dealNow(s.key); return; } // dealt here and now
  goTo(to, s.key); // dealt as the map arrives, and the mark's tile opened again there
  reopen = tile;
}
const mercOf = (lat) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const latOfMerc = (m) => ((2 * Math.atan(Math.exp((m * Math.PI) / 180)) - Math.PI / 2) * 180) / Math.PI;
// A sight's shown pictures on the map, from where sightDeal lays them in the view they were dealt in (the view now, for
// a sight that came in by the link)
function sightPlaces(s, f, sizes) {
  if (!dealViews.has(s.key)) dealViews.set(s.key, view);
  const proj = viewProjection(dealViews.get(s.key));
  return sightDeal(sizes, windowRect(), proj.project(...placeOfSight(s, f))).row.map(({ x, y, h }, k) => {
    const [lon] = proj.invert(x, y), m0 = mercOf(proj.invert(x, y + h / 2)[1]), m1 = mercOf(proj.invert(x, y - h / 2)[1]);
    return { lon, lat: latOfMerc((m0 + m1) / 2), scale: (m1 - m0) / sizes[k][1], turn: 0 };
  });
}
const spanOf = (p) => lifeSpan(p, p.voyages.flatMap((id) => voyageYears(peopleData.voyages[id]?.when)));
const lifeText = (p) => `${p.born?.date ?? 'birth unknown'} – ${deathOf(p)?.date ?? 'death unknown'}`;
const pc = (x) => `${(x * 100).toFixed(2)}%`;
function fillPeople() {
  return loadPeople().then(() => { if (!$('peopleStrip').childElementCount) drawPeople(); showPeople(); }, (e) => { $('peopleStrip').textContent = e.message; });
}
function drawPeople() {
  if (!peopleData) return;
  const people = [...peopleData.people].map((p) => [p, spanOf(p)]).sort((a, b) => a[1][0] - b[1][0]);
  const rows = people.map(([p, [a, b, fromKnown, toKnown]]) => {
    const x0 = timeAxis.x(a), x1 = timeAxis.x(b), right = x1 < 0.62; // the name to the bar's right where there is room, else to its left
    const open = `${fromKnown ? '' : ' open-start'}${toKnown ? '' : ' open-end'}`;
    return `<li><button type="button" class="life" data-person="${escapeHTML(p.id)}" aria-pressed="false" title="${escapeHTML(p.name)}, ${escapeHTML(lifeText(p))}">` +
      `<span class="bar${open}" style="left:${pc(x0)};width:${pc(Math.max(0.008, x1 - x0))}"></span>` +
      `<span class="who" style="${right ? `left:calc(${pc(x1)} + 5px)` : `right:calc(${pc(1 - x0)} + 5px)`}">${escapeHTML(p.name)}</span></button></li>`;
  }).join('');
  $('timelinePanel').append($('personCard')); // out of the lane before it is redrawn
  $('peopleStrip').innerHTML = `<ol class="lives lane">${rows}</ol>`;
}
// The years after a name, as an encyclopedia gives them: "(c. 1460s – 24 Dec 1524)", "(born c. 350 BC)", "(died 1510)",
// nothing where neither is dated; the places are the bio's and the map's
function lifeDates(p) {
  const b = p.born?.date, d = deathOf(p)?.date;
  return b && d ? `(${b} – ${d})` : b ? `(born ${b})` : d ? `(died ${d})` : '';
}
function showPeople() {
  for (const b of document.querySelectorAll('#peopleStrip [data-person]')) b.setAttribute('aria-pressed', String(b.dataset.person === style.person));
  const card = $('personCard'), p = personOf(style.person);
  card.hidden = !p;
  $('peopleStrip').querySelector('.cardrow')?.remove();
  if (!p) { card.replaceChildren(); $('timelinePanel').append(card); return; }
  const life = $('peopleStrip').querySelector(`[data-person="${CSS.escape(p.id)}"]`);
  if (life) life.parentElement.after(Object.assign(document.createElement('li'), { className: 'cardrow' }));
  ($('peopleStrip').querySelector('.cardrow') ?? $('timelinePanel')).append(card);
  // each voyage by its title (its years with it where the title has none), and its summary in full
  const voyages = p.voyages.map((id) => peopleData.voyages[id]).filter(Boolean).map((v) => {
    const link = voyageLink(v, peopleData.sources);
    return `<li><b>${escapeHTML(v.title)}</b>${/\d/.test(v.title) ? '' : ` <span class="when">${escapeHTML(v.when)}</span>`}` +
      `<p>${escapeHTML(v.summary ?? '')}${link ? ` <a href="${escapeHTML(link.url)}" target="_blank" rel="noopener">${escapeHTML(link.label)}</a>` : ''}</p></li>`;
  }).join('');
  const pics = picsHTML({ images: p.images, manifest: peopleData.pictures }, picturesOf(p));
  const roles = (Array.isArray(p.role) ? p.role : p.role ? [p.role] : []).map((r) => `<span class="chip role">${escapeHTML(r)}</span>`).join(' ');
  card.innerHTML = `<p class="pname"><b>${escapeHTML(p.name)}</b> ${escapeHTML(lifeDates(p))} ${roles}</p>` +
    (p.bio ? `<p class="bio">${escapeHTML(p.bio)}</p>` : '') +
    (voyages ? `<ul class="pvoyages">${voyages}</ul>` : '') +
    (pics ? `<div class="pics" role="group" aria-label="Pictures, on the table or off it">${pics}</div>` : '');
}
// A subject's pictures as thumbnails, each a button that takes it off the table or puts it back (`shown` those on it)
const picsHTML = (s, shown, only = null) => s.images.map((im, i) => { const m = s.manifest[im.file];
  return m && (!only || only.includes(i)) ? `<button type="button" class="pic" data-pic="${i}" aria-pressed="${shown.includes(i)}" title="${escapeHTML(pictureNote(im) ?? pictureCredit(im))}: on the table, or off it"><img src="packs/overlays/${escapeHTML(m.src)}" alt="" loading="lazy"></button>` : ''; }).join('');
$('peopleStrip').addEventListener('click', (e) => {
  const b = e.target.closest('[data-person]');
  if (!b) return;
  const id = b.dataset.person === style.person ? null : b.dataset.person;
  clearTable(); // whatever lies on the table put away first, and a second click lets the person go
  if (id) { style = { ...style, person: id }; dealing = `person:${id}`; } // their cards dealt as the map arrives
  showPeople(); showSightCard(); writeHash(); render();
  if (id) flyToSubject();
});
$('personCard').addEventListener('click', (e) => {
  const pic = e.target.closest('[data-pic]'), p = personOf(style.person);
  if (pic && p) setOnTable(Number(pic.dataset.pic), !picturesOf(p).includes(Number(pic.dataset.pic)));
});
// A picture onto the table (on top of the pile, as the last one touched) or off it, put away face up; choosing the
// person again deals every picture back
function setOnTable(i, on) {
  const s = subject();
  if (!s) return;
  const shown = picturesOf(s).filter((k) => k !== i);
  style = { ...style, pictures: on ? [...shown, i].sort((a, b) => a - b) : shown };
  if (on) raise(i); else { flips.delete(i); links.delete(i); raised = raised.filter((k) => k !== i); if (focusedPic === i) focusedPic = null; if (looking === i) looking = null; }
  showPeople(); showSightCard(); writeHash();
  for (const b of tileEl.querySelectorAll('[data-pic]')) b.setAttribute('aria-pressed', String(picturesOf(s).includes(Number(b.dataset.pic)))); // the open tile's thumbnails
  repaint('a picture put away');
  preparePictures().then((fresh) => { if (fresh) repaint('a picture dealt'); }, () => {});
}
// The skull in the right margin, always there, a memento mori under it: a click (or Enter, or Space) clears the table
// back to how the page opens (clearTable) and moves the line on to the next (MEMENTO, the first at random)
let memento = Math.floor(Math.random() * MEMENTO.length);
const showMemento = () => { $('mementoText').textContent = MEMENTO[memento]; };
showMemento();
$('sweep').addEventListener('click', () => {
  if (clearTable()) render(); // a person's voyages back in their own inks
  memento = mementoNext(memento); showMemento();
});
// The broom (the skull's old icon) sweeps once across the map from the right, about 0.6 s, while the cards go; none
// under reduced motion
function sweepBroom() {
  const el = $('broom');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = canvas.getBoundingClientRect(), left = Math.max(0, r.left), right = Math.min(innerWidth, r.right), tall = Math.min(r.bottom, innerHeight) - Math.max(0, r.top), size = tall * 0.3;
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, top: `${Math.max(0, r.top) + (tall - size) * 0.62}px`, left: `${left}px` });
  el.hidden = false;
  el.animate([{ transform: `translateX(${right - left}px) rotate(8deg)` }, { transform: `translateX(${(right - left) * 0.5 - size / 2}px) rotate(-10deg)`, offset: 0.5 }, { transform: `translateX(${-size}px) rotate(8deg)` }],
    { duration: 600, easing: 'ease-in-out' }).finished.then(() => { el.hidden = true; }, () => { el.hidden = true; });
}
// The box round a subject, once per subject: a person's birth, death and voyages; a sight's spots, padded (sightFrame)
function frameOfSubject(s) {
  if (!frames.has(s.key)) {
    if (s.kind === 'sight') frames.set(s.key, sightFrame(sightTiles().filter(({ tile }) => tile.sight === s.id).map(({ lon, lat }) => [lon, lat])));
    else {
      const p = s.person, vs = p.voyages.map((id) => peopleData.voyages[id]);
      const pts = [p.born && [p.born.lon, p.born.lat], deathOf(p) && [deathOf(p).lon, deathOf(p).lat], ...vs.flatMap((v) => (v?.legs ?? []).flatMap((l) => l.points))].filter(Boolean);
      frames.set(s.key, frameOf(pts.map(([lon, lat]) => [((((lon + 180) % 360) + 360) % 360) - 180, lat])));
    }
  }
  return frames.get(s.key);
}
const pictureSize = (s, i) => { const m = s.manifest[s.images[i]?.file]; return m ? [m.width, m.height] : null; };
// The pictures on the table: those the link names, else all of them (`s` a subject, or a person: anything with `images`)
const picturesOf = (s) => style.pictures ?? (s.kind === 'sight' ? siteSet(s, style.site) : null) ?? s.images.map((_, i) => i);
// Where a subject's shown pictures lie by default: a person's under their frame, sized from it (picturePlaces); a
// sight's along the foot of the view they were dealt in (sightPlaces)
const placesOf = (s, f, sizes) => (s.kind === 'sight' ? sightPlaces(s, f, sizes) : picturePlaces(f, sizes, ...pictureLay()));
// Each picture lies a little askew, as if dealt onto a chart table: degrees by its place in the record, and a nudge
// off the row's line as a share of its height
const ASKEW = [-4, 3, -2, 5, -3, 2], NUDGE = [0.06, -0.05, 0.08, -0.03, 0.04, -0.07];
const DEAL_MS = 450, DEAL_GAP = 110, FLIP_MS = 320;
const ease = (t) => 1 - (1 - t) ** 3;
// On a wide screen the pictures are dealt larger than on a phone, each laid a quarter over the one before so a long row
// still fits the window (picturePlaces' `grow` and `overlap`)
const PICTURE_GROW = 1.6, PICTURE_OVERLAP = 0.25, pictureLay = () => (phone.matches ? [1, 0] : [PICTURE_GROW, PICTURE_OVERLAP]);
// The pile: the pictures touched, grabbed or focused, the last on top; the rest lie under them in the record's order
let raised = [];
let pileFor = null; // the subject the pile, the picture looked at and the turned ones are for
const raise = (i) => { const was = raised.at(-1); raised = [...raised.filter((k) => k !== i), i]; return was !== i; };
// The shown pictures with their images loaded, bottom of the pile first: [{ i, o, sheet, im }], `o` an overlay of one
// piece (overlays.mjs) and `sheet` where it lies: where it was dragged, else its own place under the person's frame
// (placesOf)
function shownPictures() {
  if (pileFor !== subjectKey()) { pileFor = subjectKey(); raised = []; looking = null; flips.clear(); links.clear(); } // another subject, by any road
  if (dealing && dealing === subjectKey()) return []; // not dealt until the map is there
  const s = subject(), f = s && frames.get(s.key);
  if (!f) { looking = null; return []; }
  const shown = picturesOf(s).filter((i) => pictureSize(s, i)), places = placesOf(s, f, shown.map((i) => pictureSize(s, i)));
  const list = shown.map((i, k) => {
    const img = pictureImgs.get(`${s.key}/${i}`), [, h] = pictureSize(s, i);
    const at = style.pictureAt[i] ?? { ...places[k], lat: places[k].lat + NUDGE[i % 6] * h * places[k].scale };
    return img && { i, k, im: s.images[i], o: { img, width: img.width, height: img.height, scale: 1 }, sheet: { ...at, turn: 0 } };
  }).filter(Boolean);
  if (looking != null && !list.some((pic) => pic.i === looking)) looking = null; // put away, or gone from the link
  return list.sort((a, b) => pileOf(a.i) - pileOf(b.i)); // stable: the untouched keep their order, under the touched
}
function pileOf(i) { return i === looking ? Infinity : raised.indexOf(i); } // the one looked at over all
// The chosen subject's frame and shown pictures loaded; true when anything new came in (the map is then drawn again)
async function preparePictures() {
  const key = subjectKey();
  if (!key) return false;
  const s = await loadSubject();
  if (!s) return false;
  let fresh = !frames.has(s.key);
  frameOfSubject(s);
  await Promise.all(picturesOf(s).map(async (i) => {
    const m = s.manifest[s.images[i]?.file], imgKey = `${s.key}/${i}`;
    if (!m || pictureImgs.has(imgKey)) return;
    pictureImgs.set(imgKey, await env.loadImage(`packs/overlays/${m.src}`));
    fresh = true;
  }));
  return fresh && key === subjectKey();
}
// The map flies to frame a person and their pictures, wherever they are
async function flyToSubject() {
  const key = subjectKey(), s = await loadSubject().catch(() => null), f = s && frameOfSubject(s);
  if (key !== subjectKey()) return;
  if (!f) { dealNow(key); return; }
  const shown = picturesOf(s).filter((i) => pictureSize(s, i)), sizes = shown.map((i) => pictureSize(s, i));
  goTo(viewContaining(withPictures(f, placesOf(s, f, sizes), sizes), { w: W, h: H }), key); // their cards dealt as it arrives
}
// A picture on the canvas: its centre, its turn in radians and its size in canvas px, before any deal or flip. The one
// looked at lies upright in the middle of the part of the canvas in the window, as large as LOOK_FILL of that allows
// and never larger than its own pixels shown one to a CSS px.
const LOOK_FILL = 0.85;
// The part of the canvas the window shows, in canvas px: a phone crops the canvas to the window.
function windowRect() {
  const r = canvas.getBoundingClientRect(), kx = W / r.width, ky = H / r.height;
  return { x0: Math.max(0, -r.left) * kx, x1: (Math.min(innerWidth, r.right) - r.left) * kx, y0: Math.max(0, -r.top) * ky, y1: (Math.min(innerHeight, r.bottom) - r.top) * ky };
}
let looking = null; // the picture looked at, by its index
function pictureBox(pic, proj) {
  if (pic.i === looking) {
    const { x0, x1, y0, y1 } = windowRect();
    const k = Math.min(((x1 - x0) * LOOK_FILL) / pic.o.width, ((y1 - y0) * LOOK_FILL) / pic.o.height, cssPx(1));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, a: 0, w: pic.o.width * k, h: pic.o.height * k };
  }
  const c = sheetCorners(pic.o, proj, pic.sheet);
  if (!c) return null;
  return { x: (c[0][0] + c[2][0]) / 2, y: (c[0][1] + c[2][1]) / 2, a: (ASKEW[pic.i % 6] * Math.PI) / 180, w: c[1][0] - c[0][0], h: c[3][1] - c[0][1] };
}
// The round buttons on a picture's lower edge, in its own frame, from its right corner leftward: on the table Look and
// its Commons link; looked at face up, Put away, Turn over and the link; looked at face down, Turn over (the back
// carries its own link and Put away). Each glyph is one constant.
const FOOT_R = 13; // CSS px, a button's radius
const LOOK_GLYPH = '👁\uFE0E', FLIP_GLYPH = '⟳', AWAY_GLYPH = '✘'; // put away: an X for buried treasure (☠ the alternative)
const SYMBOLS = "'IM Fell English', Georgia, 'Segoe UI Symbol', 'Apple Symbols', 'Noto Sans Symbols 2', 'Noto Sans Symbols', 'DejaVu Sans', serif";
function feetOf(pic, b) {
  const kinds = pic.i !== looking ? ['look', 'link'] : flips.get(pic.i)?.back ? ['flip'] : ['away', 'flip', 'link'], r = cssPx(FOOT_R);
  return kinds.map((kind, n) => ({ kind, at: [b.w / 2 - r * 0.4 - n * r * 2.4, b.h / 2] }));
}
// ⧉ (in no font of the page's stack, so drawn): two joined squares in the link's red, in an em box of `size` at x, y
function linkGlyph(g, x, y, size) {
  const q = size * 0.5;
  g.save(); g.strokeStyle = PERSON_LINK; g.lineWidth = Math.max(1, size * 0.08);
  g.strokeRect(x, y + size * 0.42, q, q); g.strokeRect(x + size * 0.3, y + size * 0.12, q, q);
  g.restore();
}
// The back of a picture, in its own frame: what it is, when, by whom, under what licence and its note, in type sized in
// CSS px so it reads at any zoom (the largest of BACK_TYPE that fits the card, else the smallest, clipped above the
// foot), then a glyph that opens its Commons page, and at its foot the labelled button that puts it away. Returns, in
// the same frame, where a tap opens the page and where one puts it away.
const BACK_TYPE = [20, 18, 16, 15, 14, 13, 12]; // CSS px; the People drawer's own card text is 13 px
const LINK_GLYPH = '⧉', LINK_SAYS = 'Its page on Wikimedia Commons', AWAY_SAYS = 'Put away', LOOK_SAYS = 'Look', FLIP_SAYS = 'Turn over';
const pageOf = (im) => subject()?.manifest[im.file]?.page ?? commonsPage(im.file);
function drawBack(g, im, w, h) {
  const pad = Math.max(cssPx(8), w * 0.06), family = getComputedStyle(document.body).getPropertyValue('--serif') || 'serif';
  let size = 0, lines = [];
  for (const css of BACK_TYPE) {
    size = cssPx(css); g.font = `italic ${size}px ${family}`; lines = [];
    const wrap = (text) => {
      let line = '';
      for (const word of String(text).split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (g.measureText(next).width > w - 2 * pad && line) { lines.push(line); line = word; } else line = next;
      }
      if (line) lines.push(line);
    };
    wrap(pictureCredit(im));
    if (pictureNote(im)) { lines.push(''); wrap(pictureNote(im)); }
    if (2 * pad + (lines.length + 1) * size * 1.3 + size * 1.8 <= h) break; // the words, the glyph's line and the foot fit
  }
  const left = -w / 2 + pad, lead = size * 1.3, bh = size * 1.6, by = h / 2 - pad - bh;
  g.save(); g.beginPath(); g.rect(-w / 2, -h / 2, w, by - size * 0.2 + h / 2); g.clip();
  g.fillStyle = style.ink; g.textBaseline = 'top';
  lines.forEach((l, n) => g.fillText(l, left, -h / 2 + pad + n * lead));
  // the glyph after the last word where it fits on that line, else on the next
  const last = lines.at(-1) ?? '', gap = g.measureText(' ').width * 1.6, gw = size * 0.85;
  const inline = left + g.measureText(last).width + gap + gw <= w / 2 - pad;
  let gx = inline ? left + g.measureText(last).width + gap : left, gy = -h / 2 + pad + (inline ? lines.length - 1 : lines.length) * lead;
  const fits = gy + size <= by - size * 0.2;
  if (fits) linkGlyph(g, gx, gy, size);
  g.restore();
  // the button at the foot: the put-away glyph, and its word where the card leaves room left of Turn over (and of the
  // link, when the words leave it no room above)
  g.font = `${size}px ${family}`;
  const icon = size * 1.1, tw = g.measureText(AWAY_SAYS).width, room = w / 2 - cssPx(FOOT_R) * 1.6 - pad - left - (fits ? 0 : gw + size * 0.6);
  const bw = size * 0.5 + icon + (size * 0.4 + tw <= room - size * 1.4 - icon ? size * 0.4 + tw : 0) + size * 0.5;
  if (!fits) { gx = left + bw + size * 0.6; gy = by + (bh - size) / 2; linkGlyph(g, gx, gy, size); }
  const link = [gx - size * 0.35, gy - size * 0.35, gw + size * 0.7, size * 1.7]; // a tap a little off the glyph still opens it
  g.save(); g.lineWidth = Math.max(1, cssPx(1)); g.strokeStyle = style.ink; g.fillStyle = style.parchment;
  g.beginPath(); g.roundRect(left, by, bw, bh, bh / 2); g.fill(); g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1;
  g.fillStyle = style.ink; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.font = `${icon}px ${SYMBOLS}`; g.fillText(AWAY_GLYPH, left + size * 0.5 + icon / 2, by + bh / 2);
  g.textAlign = 'left'; g.font = `${size}px ${family}`;
  if (bw > size * 1.5 + icon) g.fillText(AWAY_SAYS, left + size * 0.9 + icon, by + bh / 2);
  g.restore();
  return { link, away: [left, by, bw, bh] };
}
const PERSON_LINK = '#8c2f1e';
const links = new Map(); // a turned picture's link and put-away button ({ link, away }), in its own frame, by its index
let focusedPic = null; // the picture whose item in the canvas's fallback has the keyboard's focus, ringed
// The pictures over everything on the map: each on a parchment mount with a soft shadow and an ink rule, a little
// askew, dealt in one after another when a subject is chosen, the one looked at upright and large over the rest; on
// each one's lower edge its round buttons (feetOf).
function drawPictures(g) {
  const list = shownPictures();
  mirrorPictures(list);
  onTable = list.length;
  if (!list.length) { dealt = null; return; }
  const now = performance.now(), proj = viewProjection(view), m = 5;
  if (dealt?.key !== subjectKey()) dealt = { key: subjectKey(), start: now };
  let moving = false;
  // in layers: the table, then the picture looked at; each layer's buttons over its pictures, so none hides another's
  const layers = looking == null ? [list] : [list.filter((pic) => pic.i !== looking), list.filter((pic) => pic.i === looking)];
  const r = cssPx(FOOT_R), GLYPHS = { look: LOOK_GLYPH, flip: FLIP_GLYPH, away: AWAY_GLYPH };
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (const layer of layers) {
    const feet = [];
    for (const pic of layer) {
      const b = pictureBox(pic, proj);
      if (!b) continue;
      const t = ease(Math.max(0, Math.min(1, (now - dealt.start - pic.k * DEAL_GAP) / DEAL_MS)));
      if (t <= 0) { moving = true; continue; }
      const flip = flips.get(pic.i), ft = flip ? Math.min(1, (now - flip.start) / FLIP_MS) : 1;
      if (t < 1 || ft < 1) moving = true;
      const back = flip ? (flip.back ? ft >= 0.5 : ft < 0.5) : false, squash = flip ? Math.abs(Math.cos(Math.PI * ft)) : 1;
      // dealt from the top right, where the drawer is, turning as it lands
      const x = W + (b.x - W) * t, y = b.y * t, s = 0.35 + 0.65 * t;
      g.save(); g.translate(x, y); g.rotate(b.a + (1 - t) * 0.6); g.scale(s * Math.max(0.02, squash), s);
      g.save(); g.shadowColor = 'rgba(59,42,26,0.35)'; g.shadowBlur = 8; g.shadowOffsetY = 2; g.fillStyle = style.parchment; g.fillRect(-b.w / 2 - m, -b.h / 2 - m, b.w + 2 * m, b.h + 2 * m); g.restore();
      if (back) links.set(pic.i, drawBack(g, pic.im, b.w, b.h));
      else { links.delete(pic.i); g.drawImage(pic.o.img, -b.w / 2, -b.h / 2, b.w, b.h); }
      g.save(); g.strokeStyle = style.ink; g.globalAlpha = 0.7; g.lineWidth = 1; g.strokeRect(-b.w / 2 - m, -b.h / 2 - m, b.w + 2 * m, b.h + 2 * m); g.restore();
      if (focusedPic === pic.i) { const f = m + cssPx(3); g.save(); g.strokeStyle = PERSON_LINK; g.lineWidth = cssPx(2.5); g.strokeRect(-b.w / 2 - f, -b.h / 2 - f, b.w + 2 * f, b.h + 2 * f); g.restore(); }
      if (t === 1 && ft === 1) feet.push([pic, b, x, y]);
      g.restore();
    }
    for (const [pic, b, x, y] of feet) {
      g.save(); g.translate(x, y); g.rotate(b.a);
      g.lineWidth = Math.max(1, cssPx(1.2)); g.strokeStyle = style.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${r * 1.15}px ${SYMBOLS}`;
      for (const { kind, at: [fx, fy] } of feetOf(pic, b)) {
        g.fillStyle = style.parchment; g.beginPath(); g.arc(fx, fy, r, 0, 2 * Math.PI); g.fill(); g.stroke();
        if (kind === 'link') linkGlyph(g, fx - r * 0.42, fy - r * 0.55, r * 1.1);
        else { g.fillStyle = style.ink; g.fillText(GLYPHS[kind], fx, fy + r * 0.05); }
      }
      g.restore();
    }
  }
  g.restore();
  if (moving && !dealFrame) dealFrame = requestAnimationFrame(() => { dealFrame = 0; if (ground) paintFrame('pictures dealt'); });
}
let dealFrame = 0;
// The picture under canvas px p, the top one first: by a button on its edge (feetOf), by its link or its put-away
// button when it lies face down, anywhere else on it to move it (or, the one looked at, to hold it where it is)
function pictureHit([x, y]) {
  const list = shownPictures();
  if (!list.length) return null;
  const proj = viewProjection(view), reach = cssPx(FOOT_R + 3);
  const local = list.reverse().map((pic) => {
    const b = pictureBox(pic, proj);
    if (!b) return null;
    const dx = x - b.x, dy = y - b.y, c = Math.cos(-b.a), s = Math.sin(-b.a);
    return { pic, b, u: dx * c - dy * s, v: dx * s + dy * c };
  }).filter(Boolean);
  // the layers as drawn (drawPictures), the picture looked at first; in each, the buttons lie over every picture
  for (const layer of looking == null ? [local] : [local.filter(({ pic }) => pic.i === looking), local.filter(({ pic }) => pic.i !== looking)]) {
    for (const { pic, b, u, v } of layer) {
      const foot = feetOf(pic, b).find(({ at }) => Math.hypot(u - at[0], v - at[1]) <= reach);
      if (foot) return { kind: foot.kind, ...pic, proj };
    }
    for (const { pic, b, u, v } of layer) {
      const back = links.get(pic.i), on = (r) => r && u >= r[0] && u <= r[0] + r[2] && v >= r[1] && v <= r[1] + r[3];
      if (on(back?.away)) return { kind: 'away', ...pic, proj };
      if (on(back?.link)) return { kind: 'link', ...pic, proj };
      if (Math.abs(u) <= b.w / 2 + 5 && Math.abs(v) <= b.h / 2 + 5) return { kind: pic.i === looking ? 'held' : 'move', ...pic, proj };
    }
  }
  return null;
}
function holdPicture(hit, p) {
  holding = { ...hit, start: p, centre: hit.proj.project(hit.sheet.lon, hit.sheet.lat) };
  hideTile();
  if (raise(hit.i)) repaint('a picture lifted'); // grabbed, so on top
}
function dragPicture(p) {
  const { kind, proj, start, sheet, centre, i } = holding;
  if (kind !== 'move') return;
  const [lon, lat] = proj.invert(centre[0] + p[0] - start[0], centre[1] + p[1] - start[1]);
  const next = { lon, lat: Math.max(-85, Math.min(85, lat)), scale: sheet.scale };
  style = { ...style, pictureAt: { ...style.pictureAt, [i]: next } };
  if (!sheetFrameId) sheetFrameId = requestAnimationFrame(() => { sheetFrameId = 0; paintFrame('a picture held'); });
}
function dropPicture(e) {
  const { kind, i, im } = holding;
  holding = null;
  cancelAnimationFrame(sheetFrameId); sheetFrameId = 0;
  if (kind !== 'move') { // a button acts on a release over it, as a page's button does, and not on a cancel or a drag off it
    const hit = e.type === 'pointerup' ? pictureHit(toCanvas(e.clientX, e.clientY)) : null;
    if (hit?.kind !== kind || hit.i !== i) return;
  }
  if (kind === 'flip') { turnOver(i); return; }
  if (kind === 'link') { window.open(pageOf(im), '_blank', 'noopener'); return; }
  if (kind === 'away') { setOnTable(i, false); return; }
  if (kind === 'look') { lookAt(i); return; }
  if (kind === 'held') return;
  writeHash(); render();
}
const repaint = (doing) => { if (ground) paintFrame(doing); };
// Look: the picture upright and large in the middle of the window, over the rest; a press off it, or Esc, lays it back
// on the table face up
function lookAt(i) { looking = i; raise(i); hideTile(); repaint('a picture looked at'); }
function endLook() {
  if (looking == null) return;
  flips.delete(looking); links.delete(looking); looking = null;
  repaint('a picture laid back');
}
function turnOver(i) {
  if (looking !== i) lookAt(i); // only a picture looked at turns over
  flips.set(i, { back: !flips.get(i)?.back, start: performance.now() });
  repaint('a picture turned over');
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && looking != null) { endLook(); e.stopImmediatePropagation(); } }, true); // first, and only that: the open drawer stays
// The pictures on the map again inside the canvas, as its fallback content: what a screen reader reads and the keyboard
// reaches, one item per picture in the record's order with its back's words, the glyph link to its Commons page
// (labelled in full) and its Look, Turn over and Put away buttons. `data-z` is its place in the pile, the top one
// highest. Focus on an item lifts its picture to the top and rings it.
const keys = $('pictureKeys');
let keysFor = '', focusNext = null;
function mirrorPictures(list) {
  const now = `${subjectKey()}|${list.map((pic) => pic.i).sort((a, b) => a - b)}`;
  if (now !== keysFor) {
    keysFor = now;
    const at = document.activeElement, li = keys.contains(at) && at.closest('[data-pic]'); // the focus, kept across the rebuild
    const was = li && (at.tagName === 'A' ? `[data-pic="${li.dataset.pic}"] a` : `[data-${Object.keys(at.dataset)[0]}="${li.dataset.pic}"]`);
    keys.innerHTML = [...list].sort((a, b) => a.i - b.i).map(({ i, im }) => `<li data-pic="${i}"><span>${escapeHTML(pictureCredit(im))}${pictureNote(im) ? `. ${escapeHTML(pictureNote(im))}` : ''}</span> ` +
      `<a href="${escapeHTML(pageOf(im))}" target="_blank" rel="noopener" title="${LINK_SAYS}" aria-label="${LINK_SAYS}">${LINK_GLYPH}</a> ` +
      ['look', 'flip', 'away'].map((k) => { const says = { look: LOOK_SAYS, flip: FLIP_SAYS, away: AWAY_SAYS }[k];
        return `<button type="button" data-${k}="${i}"${k === 'look' ? ' aria-pressed="false"' : ''} aria-label="${says}: ${escapeHTML(pictureCredit(im))}">${says}</button>`; }).join(' ') + '</li>').join('');
    if (focusNext != null) { keys.querySelector(`[data-away="${focusNext}"]`)?.focus(); focusNext = null; } else if (was) keys.querySelector(was)?.focus();
  }
  list.forEach((pic, n) => {
    const li = keys.querySelector(`[data-pic="${pic.i}"]`);
    if (li && li.dataset.z !== String(n)) li.dataset.z = String(n);
    li?.querySelector('[data-look]')?.setAttribute('aria-pressed', String(pic.i === looking));
  });
}
keys.addEventListener('focusin', (e) => {
  const li = e.target.closest('[data-pic]');
  if (!li) return;
  const i = Number(li.dataset.pic), lifted = raise(i);
  if (lifted || focusedPic !== i) { focusedPic = i; repaint('a picture lifted'); }
});
keys.addEventListener('focusout', (e) => {
  if (e.relatedTarget?.closest?.('#pictureKeys [data-pic]')?.dataset.pic === String(focusedPic)) return; // on within the same picture's item
  focusedPic = null; repaint('a picture let go');
});
keys.addEventListener('click', (e) => {
  const look = e.target.closest('[data-look]'), flip = e.target.closest('[data-flip]');
  if (look) { if (looking === Number(look.dataset.look)) endLook(); else lookAt(Number(look.dataset.look)); return; }
  if (flip) { turnOver(Number(flip.dataset.flip)); return; }
  const b = e.target.closest('[data-away]');
  if (!b) return;
  const li = b.closest('li'), next = li.nextElementSibling ?? li.previousElementSibling; // the focus goes on to a neighbour
  focusNext = next ? Number(next.dataset.pic) : null;
  setOnTable(Number(b.dataset.away), false);
});
if (style.person) loadPeople().then(showPeople, () => {}); // a link that names a person shows their card when the drawer opens

// ---------------------------------------------------------------- timeline

// The drawer the Voyages and People buttons share: one timeline on one linear year axis (scripts/people.mjs laneAxis),
// people above the axis and voyages below it, from the Lapita voyages to this year at true scale throughout, so a stretch
// with nobody in it reads as empty rather than cut out. Behind both lanes, the eras of the points of interest as faint
// colour bands, each named once at the top. The voyages' controls head their lane. Each button opens it at its own lane: People at the top, Voyages scrolled
// to the axis, its lane's name lit. The Earlier tab at the left end adds the long stretch before Lapita, back to
// 50,000 BC, at its own scale, with the windows of the peopling of Sahul, Beringia and the Americas marked on it and
// nothing yet placed there. A phone scrolls the timeline sideways, and opens it at its right end, where most of it is.
let timeAxis = laneAxis(), timeLane = 'people';
function drawAxis() {
  const tick = ([y, label]) => { const x = timeAxis.x(y); return `<span class="tick${x < 0.01 ? ' edge' : ''}" style="left:${pc(x)}">${label}</span>`; };
  $('timeAxis').innerHTML = timeAxis.ticks.map(tick).join('');
  const bands = eraBands(timeAxis).map(([name, a, b], i, all) => `<div class="band${i === all.length - 1 ? ' last' : ''}" data-era="${escapeHTML(name)}" style="left:${pc(timeAxis.x(a))};width:${pc(timeAxis.x(b) - timeAxis.x(a))}"><b>${escapeHTML(name)}</b></div>`);
  const earlier = timeAxis.stretches.length > 1;
  const marks = earlier ? EARLIER_MARKS.map(([label, y, title]) => { const x = timeAxis.x(y);
    return `<div class="mark${x < 0.01 ? ' edge' : ''}" data-mark="${escapeHTML(label)}" title="${escapeHTML(title)}" style="left:${pc(x)}"><b>${escapeHTML(label)}</b></div>`; }) : [];
  const brk = earlier ? `<span class="brk" style="left:${pc(timeAxis.stretches[1][2])}"></span>` : '';
  $('eras').innerHTML = bands.join('') + marks.join('') + brk;
  $('track').style.setProperty('--w', String(timeAxis.width));
}
function drawTimeline() { drawAxis(); drawVoyages(); drawPeople(); showPeople(); }
// The timeline at a lane: opened (`fresh`), both lanes load, then the drawer scrolls to the lane asked for; already
// open (the other button), it only scrolls there
function fillTimeline(lane, fresh) {
  timeLane = lane;
  $('peopleCap').classList.toggle('lit', lane === 'people');
  $('voyagesCap').classList.toggle('lit', lane === 'voyages');
  if (!$('timeAxis').childElementCount) drawAxis();
  const atEnd = () => { if (fresh && timeAxis.width === 1) $('timeScroll').scrollLeft = $('timeScroll').scrollWidth; }; // a phone: most entries are after AD 1000
  if (fresh) Promise.allSettled([fillVoyages(), fillPeople()]).then(() => { atEnd(); toLane(timeLane); }); // the lane asked for last, as the lanes now stand
  atEnd(); toLane(lane);
}
function toLane(lane) {
  const panel = $('timelinePanel'), to = lane === 'voyages' ? $('timeAxis') : null;
  panel.scrollTop = to ? panel.scrollTop + to.getBoundingClientRect().top - panel.getBoundingClientRect().top - 8 : 0;
}
$('earlier').addEventListener('click', () => {
  const on = $('earlier').getAttribute('aria-pressed') !== 'true';
  $('earlier').setAttribute('aria-pressed', String(on));
  $('earlier').title = on ? 'Back to Lapita: the timeline from 1500 BC' : 'Earlier history: the timeline back to 50,000 BC';
  $('earlier').querySelector('.chev').textContent = on ? '\u25C2' : '\u25B8'; // the tab is turned half round: these read as left, then right
  timeAxis = laneAxis({ earlier: on });
  drawTimeline();
  $('timeScroll').scrollLeft = 0; // the earlier stretch is the one asked to see
});

// The cartouche names the place flown to (its title, else the button's name), not whatever scores highest in the frame.
const caption = (text) => `<span class="notes">${text ?? CAPTION}</span>`;
const placeInfo = new Map(); // a listed place's details, by name: { title, date, text }
for (const [list, groups] of [[$('anchorages'), ANCHORAGES], [$('sightsList'), SIGHTS]]) {
  const rows = (items) => items.map(([name, v, title, text, tag]) => { const tile = SIGHT_TILES[name];
    if (list.id === 'sightsList') placeInfo.set(name, { title: title ?? name, date: [tile?.date, tag].filter(Boolean).join(' · '), text: text ?? tile?.text ?? CAPTION });
    return `<li><button type="button" data-place="${places.push({ name, view: { ...v, title: title ?? name } }) - 1}">${title?.startsWith(`${name} (`) ? title : name}${tile?.date ? `<small>${[tile.date, tag].filter(Boolean).join(' · ')}</small>` : ''}</button>${caption(text ?? tile?.text)}</li>`; }).join('');
  const first = groups.findIndex(([group, , open]) => group && open), opened = first >= 0 ? first : groups.findIndex(([group]) => group);
  list.innerHTML = groups.map(([group, items, , span], i) => (group ? `<li class="group${i === opened ? ' open' : ''}"><button type="button" class="fold" aria-expanded="${i === opened}">${group}<small>${[items.length, span].filter(Boolean).join(' · ')}</small></button><div class="rows"><div${i === opened ? '' : ' inert'}><ul class="places">${rows(items)}</ul></div></div></li>` : rows(items))).join('');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('[data-place]');
    if (!b) return;
    const { name, view: to } = places[b.dataset.place];
    clearSheetFor(to); goTo(to);
    if (list.id === 'sightsList') { placeShown = name; showSightCard(); $('sightCard').scrollIntoView({ block: 'nearest' }); }
  });
}
// The Points of interest drawer's details of the place last clicked in it, at the drawer's foot, as the person card shows
// a person: its name and date, its tile's text, and its pictures as thumbnails, each putting its picture on the table or
// taking it off. Choosing it in the drawer flies there and deals nothing; its mark on the map deals the pictures.
let placeShown = null;
function showSightCard() {
  const card = $('sightCard'), info = placeShown && placeInfo.get(placeShown);
  for (const b of $('sightsList').querySelectorAll('[data-place]')) {
    if (info && places[b.dataset.place].name === placeShown) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
  }
  card.hidden = !info;
  if (!info) { card.replaceChildren(); return; }
  if (!sightData) loadSights().then(showSightCard, () => {});
  const images = sightData?.images[placeShown], s = subject(), on = s?.kind === 'sight' && s.id === placeShown ? picturesOf(s) : [];
  const pics = images ? picsHTML({ images, manifest: sightData.pictures }, on) : '';
  card.innerHTML = `<p class="pname"><b>${escapeHTML(info.title)}</b> ${escapeHTML(info.date)}</p><p class="bio">${escapeHTML(info.text)}</p>` +
    (pics ? `<div class="pics" role="group" aria-label="Pictures, on the table or off it">${pics}</div>` : '');
}
$('sightCard').addEventListener('click', (e) => {
  const pic = e.target.closest('[data-pic]'), s = subject();
  if (!pic || !placeShown) return;
  const i = Number(pic.dataset.pic);
  if (s?.kind === 'sight' && s.id === placeShown) setOnTable(i, !picturesOf(s).includes(i));
  else chooseSight(placeShown, [i]); // another subject's pictures off the table, this one on it
});
// Any grouped list in a drawer opens at most one group at a time: a click on a shut group's heading slides the open
// one shut and this one open, together; a click on the open one slides it shut and leaves none open, so a search can
// move between groups quickly (docs/spec/design.md, "A grouped list in a drawer opens one group at a time").
// The rule is the list's, so a group added or moved needs no code.
function foldTo(group) {
  const shut = group.classList.contains('open');
  for (const g of group.parentElement.children) {
    if (!g.classList.contains('group')) continue;
    const on = g === group && !shut;
    g.classList.toggle('open', on);
    g.querySelector(':scope > .fold').setAttribute('aria-expanded', String(on));
    g.querySelector(':scope > .rows > div').inert = !on;
  }
}
// With a mouse (a screen that can hover), resting the pointer on a shut group's heading for HOVER_DWELL slides it open and
// the open one shut, as a click does, while the "Sections open on hover" chips are on; leaving the list shuts nothing.
// A heading counts only when the pointer moves onto it: one the slide carries under the pointer (an open group above
// shuts and the list rises) does not open on the next nudge, only once the pointer has left it and come back. A click on
// the heading the dwell just opened, before the pointer leaves it, is the click that was on its way, so it leaves the
// section open; the next click shuts it.
const HOVER_DWELL = 350; // ms
const HOVER_MEDIA = '(hover: hover) and (pointer: fine)'; // index.html hides the chips where this does not match
const canHover = matchMedia(HOVER_MEDIA);
const NO_DWELL = { group: null, timer: 0 };
let dwell = NO_DWELL, hoverOpened = null, slid = null, last = null; // last: the pointer's position and the group under it
const groupAt = (t) => t instanceof Element && t.closest('.group > .fold')?.parentElement || null;
const groupUnder = ([x, y]) => groupAt(document.elementFromPoint(x, y));
document.addEventListener('pointermove', (e) => {
  const at = [e.clientX, e.clientY];
  if (e.pointerType !== 'mouse' || (last && at[0] === last.at[0] && at[1] === last.at[1])) return;
  const g = groupAt(e.target);
  // the heading now under the pointer was already under its last position, though that position showed another: it came to the pointer
  if (g && last && g !== last.g && groupUnder(last.at) === g) slid = g;
  if (g !== slid) slid = null;
  if (g !== hoverOpened) hoverOpened = null;
  last = { at, g };
  const want = hoverOpen && canHover.matches && g && g !== slid && !g.classList.contains('open') ? g : null;
  if (want === dwell.group) return;
  clearTimeout(dwell.timer);
  dwell = !want ? NO_DWELL : { group: want, timer: setTimeout(() => {
    dwell = NO_DWELL;
    if (!want.classList.contains('open') && groupUnder(last.at) === want) { foldTo(want); hoverOpened = want; }
  }, HOVER_DWELL) };
});
document.addEventListener('pointerout', (e) => {
  const g = groupAt(e.target);
  if (g && g === dwell.group && groupAt(e.relatedTarget) !== g) { clearTimeout(dwell.timer); dwell = NO_DWELL; }
});
document.addEventListener('click', (e) => {
  const h = e.target.closest('.group > .fold'), g = h?.parentElement;
  if (!g) return;
  const swallow = g === hoverOpened && g.classList.contains('open') && e.detail !== 0; // detail 0: Enter or Space
  hoverOpened = null;
  if (!swallow) foldTo(g);
});
const showHover = () => { $('hoverOpen').value = hoverOpen ? 'on' : 'off'; };
showHover();
$('hoverOpen').addEventListener('input', () => { hoverOpen = $('hoverOpen').value === 'on'; writeHash(); });

// Each chart a row: its scan as a thumbnail (the drawer's chart glyph, greyed, until it has one) and its name, either
// of which shows that chart's sheet alone, at its own placement, and flies to frame it; the eye beside the name shows or
// hides that one sheet and nothing else: no other sheet, no placement, no move of the map. Under the name the city it
// was made in, a link that flies there and takes off any sheet that would cover the city (docs/spec/design.md, "A
// chart's row in the Charts drawer").
const skin = $('charts').querySelector('svg').outerHTML;
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path class="slash" d="M4 4l16 16"/></svg>';
let OVERLAYS = []; // packs/overlays/overlays.json, once loaded
const ownSheet = (id) => OVERLAYS.find((v) => v.id === id)?.sheet ?? null;
let chartsFresh = false; // the Charts drawer opened with no sheet shown, and none shown since: the next shown fades in
let fadeIn = null; // the overlay id whose sheet fades in when next placed
$('chartList').innerHTML = CHARTS.map(({ name, year, made, text, overlay }, i) => `<li class="chart"${overlay ? ` data-overlay="${overlay}"` : ''}><button type="button" class="thumb none" data-chart="${i}" data-to="view" title="The chart's frame">${skin}</button><div class="about"><span class="head"><button type="button" class="name" data-chart="${i}" data-to="view">${name}</button>${overlay ? `<button type="button" class="eye" data-chart="${i}" data-to="eye" aria-pressed="false" aria-label="Show ${name}" hidden>${EYE}</button>` : ''}</span><span class="where"><button type="button" class="city" data-chart="${i}" data-to="made">${made.title}</button>, ${year}</span>${caption(text)}</div></li>`).join('');
// The sheets laid, bottom to top, and where each lies; `fade` the id of one that fades in as it is placed. `draw` false
// when a flight follows at once: its landing draws them, and a render now would only be thrown away by its first frame.
function setSheets(overlays, sheets = style.sheets, fade = null, draw = true) {
  if (overlays.some((id) => !style.overlays.includes(id))) chartsFresh = false;
  style = { ...style, overlays, sheets };
  fadeIn = fade;
  showOverlay(); showVoyage(); writeHash();
  if (draw) render();
}
$('chartList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-chart]');
  if (!b) return;
  const chart = CHARTS[b.dataset.chart], o = OVERLAYS.find((v) => v.id === chart.overlay), shown = !!o && style.overlays.includes(o.id);
  if (b.dataset.to === 'eye') { // this sheet on or off, where it last lay; every other sheet and the view as they are
    if (o) setSheets(shown ? style.overlays.filter((id) => id !== o.id) : [...style.overlays, o.id]);
    return;
  }
  if (b.dataset.to === 'made') {
    const to = clampView({ ...chart.made, projection: view.projection });
    clearSheetFor(to);
    goTo(to);
    return;
  }
  if (!o) { goTo(chart.view); return; }
  const { [o.id]: _, ...sheets } = style.sheets; // back to its own placement
  setSheets([o.id], sheets, !shown && chartsFresh ? o.id : null, false); // shown alone: every other sheet hides
  goTo({ ...sheetView(o, o.sheet, { w: W, h: H }), title: chart.name }); // the whole sheet framed, 8% clear round it
});
env.readJSON('packs/overlays/overlays.json').then(({ overlays }) => {
  OVERLAYS = overlays;
  for (const li of $('chartList').children) {
    const o = overlays.find((v) => v.id === li.dataset.overlay);
    if (!o) continue;
    const b = li.querySelector('.thumb');
    b.classList.remove('none');
    b.replaceChildren(Object.assign(document.createElement('img'), { src: `packs/overlays/${o.thumb ?? o.file}`, alt: '', loading: 'lazy' })); // a chart of pages has a thumbnail strip of them all
    b.title = `${o.title} (${o.licence}): its frame, with the scan laid over the map`;
    li.querySelector('.eye').hidden = false;
  }
  for (const id of style.overlays) if (!overlays.some((o) => o.id === id)) console.warn(`overlay ${id}: not on this site`);
  showOverlay();
}).catch(() => {}); // no overlays on this site: no thumbnails, and the map unchanged
function showOverlay() {
  for (const eye of $('chartList').querySelectorAll('.eye')) {
    const li = eye.closest('li'), on = style.overlays.includes(li.dataset.overlay);
    eye.setAttribute('aria-pressed', String(on));
    eye.setAttribute('aria-label', `${on ? 'Hide' : 'Show'} ${li.querySelector('.name').textContent}`);
  }
}

// A sheet fading in over the scene just placed: the scene without it is kept, and the sheet drawn over it at a rising
// alpha; a move or a newer placement ends the fade with the sheet whole.
function fadeSheet(o, proj, me) {
  const base = Object.assign(document.createElement('canvas'), { width: W, height: H });
  base.getContext('2d').drawImage(canvas, 0, 0);
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500, t0 = performance.now();
  const step = (now) => {
    o.alpha = ms ? Math.min(1, (now - t0) / ms) : 1;
    if (me !== run) { o.alpha = 1; return; }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);
    drawSheet(ctx, o, proj, o.sheet);
    drawPictures(ctx);
    drawSheetHandles(ctx);
    if (o.alpha < 1) requestAnimationFrame(step);
  };
  step(t0);
}

// Other traditions (data/charts/world.json), shown only on a `charts=all` link: a row per chart, its title, culture and date,
// and a button that opens its source page: the scan's thumbnail for an open scan, "link" for a link-only chart, its title the reason.
if (ALL_CHARTS) env.readJSON('data/charts/world.json').then(({ charts }) => {
  $('worldList').innerHTML = charts.map((c) => `<li class="chart"><div><span>${escapeHTML(c.title)}</span><small>${escapeHTML([c.culture, c.date ?? c.year].filter(Boolean).join(' · '))}</small></div>
    <button type="button" class="scan" data-page="${escapeHTML(c.page)}" title="${escapeHTML(c.status === 'ship' ? `${c.title}: open on Wikimedia Commons${c.credit ? `, credit ${c.credit}` : ''}` : c.reason)}">${c.status === 'ship' && c.thumb ? `<img src="${escapeHTML(c.thumb)}" alt="" loading="lazy">` : `<span>${c.status === 'ship' ? 'open' : 'link'}</span>`}</button></li>`).join('');
  $('otherTraditions').hidden = false;
}).catch((e) => console.warn(`other traditions: ${e.message}`));
$('worldList').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) window.open(b.dataset.page, '_blank', 'noopener'); });

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
  if (phone.matches) $('coordsText').blur(); // the drawer stays up; a phone's keyboard goes, so the map shows
  clearSheetFor(target);
  goTo(target);
});
$('coordsText').addEventListener('input', () => { $('goMiss').hidden = true; });

// A sheet in the way: taken off (its eye shows it hidden) if it would cover the place a fly lands on, or with `frame`
// any of the frame it lands on; a fly that lands clear of the sheet leaves it shown (docs/spec/design.md, "A laid sheet
// and what the user flies to next").
function clearSheetFor(target, frame = false) {
  const sheets = laidSheets();
  if (!sheets.length) return;
  const to = clampView({ ...target, projection: view.projection }), proj = viewProjection(to);
  const spots = frame ? Array.from({ length: 25 }, (_, i) => [W * (0.1 + 0.2 * (i % 5)), H * (0.1 + 0.2 * Math.floor(i / 5))]) : [proj.project(to.lon, to.lat)];
  const covering = sheets.filter((o) => spots.some(([x, y]) => onSheet(o, proj, o.sheet, x, y)));
  if (covering.length) setSheets(style.overlays.filter((id) => !covering.some((o) => o.id === id)), style.sheets, null, false); // a fly follows at once, and draws
}
// A flight from the view to a target, in the view's projection (flight.mjs plans it: a near place eased to
// straight, a far one in an arc out, across and down, longer for longer): the ground is drawn on the way as
// for a drag, and the ornaments placed when it lands. Every fly on the page comes through here. Reduced motion jumps.
let flight = 0, flightTo = null; // the view a flight is bound for, while it flies
let lastFlight = null; // { from, target } of the last flight, for Fly again under the hood
// Every fly first clears the table (clearTable); one that carries a subject (`deal`, its key) deals its cards as it
// nears the target: once the zoom, having been further, comes within DEAL_NEAR levels of the target's, else on landing.
const DEAL_NEAR = 1;
function goTo(target, deal = null) {
  if (deal == null) clearTable();
  cancelAnimationFrame(flight);
  pinTitle = null;
  const from = view, to = clampView({ ...target, projection: view.projection });
  flightTo = to; lastFlight = { from, target };
  const plan = planFlight(from, to, { w: W, h: H, minZoom: ZOOM.min, ...fly });
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : plan.ms, t0 = performance.now();
  $('flyOut').textContent = `${plan.arc ? 'arc' : 'near'}, top z${plan.top.toFixed(2)}, ${(plan.ms / 1000).toFixed(1)} s`;
  let far = false;
  const step = (now) => {
    const u = ms ? Math.min(1, (now - t0) / ms) : 1, e = flyEase(u, fly.ease), at = u < 1 ? clampView({ ...plan.at(e), projection: to.projection }) : to;
    moved(at, true);
    if (deal) { if (Math.abs(at.zoom - to.zoom) > DEAL_NEAR) far = true; else if (far) dealNow(deal); }
    if (u < 1) flight = requestAnimationFrame(step); else { flightTo = null; pinTitle = target.title ?? null; placed = null; if (deal) dealNow(deal); stopped(); }
  };
  step(t0);
}
// A touch or the wheel takes over from a flight: a subject it was carrying is dealt where the map is
function takeOver() {
  const flying = flightTo != null;
  cancelAnimationFrame(flight); flightTo = null;
  if (flying) { reopen = null; dealNow(); }
}

// Under the hood, temporary: the flight's knobs (flight.mjs, FLY_KNOBS), kept in this browser rather than the link,
// with a line that says the settings as `name:value` to pass on, Defaults, and Fly again: back to where the last
// flight started, then the same flight once more, so a change is felt on the same flight.
const FLY_STORE = 'portolani.fly';
const fly = flyDefaults();
try { Object.assign(fly, Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(FLY_STORE)) ?? {}).filter(([n]) => n in FLY_KNOBS))); } catch { /* none kept, or storage refused */ }
const FLY_SLIDERS = Object.entries(FLY_KNOBS).filter(([, knob]) => knob.choices == null).map(([name]) => [name, `fly${name[0].toUpperCase()}${name.slice(1)}`]);
const FLY_OUT = { msPerUnit: (v) => `${v} ms a unit`, maxMs: (v) => `${(v / 1000).toFixed(2)} s at most`, hold: (v) => (v >= FLY_KNOBS.hold.max ? 'always drawn' : `${v} zoom levels`), ease: (v) => (v == 1 ? 'linear' : `power ${v}`) };
for (const [name, id] of FLY_SLIDERS) Object.assign($(id), { min: FLY_KNOBS[name].min, max: FLY_KNOBS[name].max, step: FLY_KNOBS[name].step });
function showFly() {
  $('flyShape').value = fly.shape;
  for (const [name, id] of FLY_SLIDERS) { $(id).value = fly[name]; $(`${id}Out`).textContent = (FLY_OUT[name] ?? String)(fly[name]); }
  for (const id of ['flyFit', 'flyBlend', 'flyClimb']) $(id).closest('.slider').hidden = fly.shape === 'hyperbolic';
  $('flyCurve').closest('.slider').hidden = fly.shape !== 'hyperbolic';
  const def = flyDefaults(), set = Object.entries(fly).filter(([n, v]) => v !== def[n]).map(([n, v]) => `${n}:${v}`);
  $('flySet').textContent = set.length ? set.join(' ') : 'defaults';
}
function readFly() {
  fly.shape = $('flyShape').value;
  for (const [name, id] of FLY_SLIDERS) fly[name] = Number($(id).value);
  try { localStorage.setItem(FLY_STORE, JSON.stringify(fly)); } catch { /* storage refused: the knobs hold for this page */ }
  showFly();
}
for (const [, id] of [['shape', 'flyShape'], ...FLY_SLIDERS]) $(id).addEventListener('input', readFly);
$('flyReset').addEventListener('click', () => { Object.assign(fly, flyDefaults()); readFly(); });
$('flyAgain').addEventListener('click', () => {
  if (!lastFlight) return;
  const { from, target } = lastFlight;
  cancelAnimationFrame(flight); flightTo = null;
  moved(from, true); placed = null;
  goTo(target);
});
showFly();

// My position: asked for on the button in Go; the fix is written into its box as latitude, longitude, at
// the precision the browser gives, and the map stays put: Go is what flies there (at z10 or closer, like any
// typed position) and writes it into the link (docs/decisions.md, 2026-10-29). Nothing is drawn there. The
// box is not focused, so a phone's keyboard does not come up over the map. While the browser looks, the
// button says so; a refusal or a failure is said in Go itself, where the eye is. The button is not offered
// where the browser has no geolocation (an insecure page has none).
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
    const full = (x) => (/e/.test(String(x)) ? x.toFixed(20).replace(/\.?0+$/, '') : String(x)); // every digit, never exponent form, which the box would not read
    $('coordsText').value = `${full(lat)}, ${full(lon)}`;
  }, (e) => {
    done();
    const say = e.code === e.PERMISSION_DENIED ? 'My position: not allowed' : `My position: ${e.message}`;
    miss.textContent = say; miss.hidden = false; // the text before the unhide, so a reader announces it
    $('status').textContent = say;
  }, { timeout: 15000, maximumAge: 60000 });
});

for (const id of Object.values(KNOB_SLIDERS)) $(id).addEventListener('input', (e) => { e.target.dataset.set = '1'; }); // moved, so set
for (const id of ['debug', 'overlap', 'overlayMode', 'sheetHides', 'overlayOpacity', ...Object.values(KNOB_CHIPS), ...Object.values(KNOB_SLIDERS), 'projection', 'ink', 'parchment', 'density', 'names', 'rhumb', 'scale', 'scaleBorder', 'land', 'islands', 'seaTint', 'rivers', 'lakes', 'trees', 'mountains', 'hills', 'continentsZoom', 'regions', 'regionSet', 'regionsZoom', 'titleMode', 'townSize', 'voyageWidth']) $(id).addEventListener('input', readControls);
let typing = 0; // a typed title is placed when the typing pauses, not on every key: a placement takes up to a few hundred ms
$('title').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(readControls, 400); });
addEventListener('hashchange', () => { dealing = null; layout = layoutFromHash(); showLayout(); hoverOpen = hoverFromHash(); showHover(); view = viewFromHash(); style = styleFromHash(); selection = selectionFromHash(); showStyle(); showPlacement(); showVoyage(); showPeople(); render(); });
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
