// Browser host for the shared scene code (scene.mjs): same scene as `npm run render`, drawn live.
// Drag to pan, wheel or pinch to zoom; while the map moves the land and coast are drawn and the placed
// ornaments slide with it, held to the earth; they are placed again when it stops. A row of seven instruments
// at the top right opens one drawer each, one at a time: the settings behind the rose, so the map has the
// window, the charts, the points of interest, Go, the voyages, the people and the anchorages. The view and the style are kept in the URL hash, e.g.
// #map=zoom/lat/lon&projection=miller&overlap=cut&sprites=s:serpent-a,v:kraken,v:rose-aguiar,p:tower&townsize=rank&names=0&rhumb=0&scale=chevron&scaleborder=blank&continents=5&regions=latin&regionset=catalan-1375&regionszoom=7&land=green&islands=1&rivers=aguiar&lakes=marina&mountains=ink&trees=ink&seas=1&autotitle=0&title=Mare+Nostrum&ink=5a1a1a&parchment=eee&density=1.5;
// a setting left at its default is left out, `sprites` too (keys with the pack shortened, v: s: p:); `mountains` is `ink`
// or `off` (colour is the default); the hills are the Catalan sprites in `sprites`. `continents` and `regionszoom` are the zoom
// they are drawn down from (0 off, the top always); `regionset=catalan-1375` letters the regions in a period's names (REGION_SETS), today's by default. `voyages=columbus,drake:1f4e8c` are the voyages in the order chosen, a picked
// colour after an id, `voyagewidth=3.2` their line weight, `voyagedraw=4` the seconds the pen takes to draw one on and `voyageplay=12` the seconds a play takes, the whole voyage on its own calendar. `overlay=carta-marina,aguiar` lays those charts' scans over the map,
// each as one sheet, the last on top; `sheet=;lon,lat,scale,turn` where each was dragged to, a slot per id; `overlaymode=pieces` the warped pieces instead, `overlayopacity=0.6`
// how strongly (0 to 1); off by default.
// Older links naming a `rendering` (or `pack`), `rose`, `monster`, `town` and `kinds` open as the
// selection those chose, and are written back in the new form.
// For a while, `debug=sheets[,rings]` and `tune=name:value,...` carry the under-the-hood section
// (docs/atlas/under-the-hood.md), off by default.
import { createScene, towerGlyph, REGION_LANGS, REGION_SETS, REGION_STYLES, REGION_SAMPLES, drawScene, drawGround, anchorScene, drawAnchored, panView, zoomView, clampView, viewOfFrame, viewProjection, voyageMarks, doubtMarks, SCALE_CARD_W, SCALE_CARD_H, drawCartoucheCard, drawScaleCard, covers, DEFAULT_VIEW, RENDERINGS, KINDS, DEFAULT_KINDS, LANDS, SCALE_BORDERS, MAX_ZOOM, OVERLAP_RULES, DEFAULT_OVERLAP, RIVER_STYLES, LAKE_STYLES, REEF_STYLES, PLAYA_STYLES, PEAK_STYLES, TREE_STYLES, TOWN_SIZES, readManifests, listSprites, defaultSprites, chooseSprites, PROJECTION_NAMES, SCALE_NAMES, parsePlacement, CORNERS, DEFAULT_CARTOUCHE_CORNER, DEFAULT_SCALE_CORNER, scaleRect, W, H, parseTune, parseDebug, TUNE_KNOBS, ROSE_SHARE, SHEET_ROSES, WIDE, VOYAGE_WIDTH, VOYAGE_WIDTHS, VOYAGE_DRAW, voyageDrawSeconds, VOYAGE_PLAY, voyagePlaySeconds, calendarOf, penOn, dayText, vaguer, voyageColours, settleInks, CONFIDENCE_PHRASES, isBroken, legPath, voyageView, CONTINENT_ZOOM_END, readVoyage, chronological, voyageLink, sightMarks, sightHits, drawnMarks, drawnPeaks, peakHits, SIGHT_TILES, noteMarks, pickMark, markClear, tileSpot, groupMarks, dateSpan, readDate, noteCount, drawNoteMark, drawNoteRing, notePulse, drawBadge, fitLineAt, fitLineMoving, drawFitLine, drawMarkGlyph, ZOOM } from './scene.mjs';
import { playedOn, playDateText, playPace, isLong } from './scene.mjs'; // the play's band and pen (scripts/voyages.mjs)
import { ORIGINS } from './atlas.mjs';
import { OVERLAY_DEFAULTS, effectiveOpacity, overlayFromHash, overlayToHash, sheetCorners, onSheet, sheetView, sameSheet, drawSheet } from './overlays.mjs';
import { POIS, POI_ZOOM } from './pois.mjs';
import { PEOPLE_FILE, PICTURES_FILE, SIGHT_PICTURES_FILE, SIGHT_MANIFEST_FILE, sightDeal, eraOf, eraYears, eraScale, barOn, lifeSpan, firstYear, yearsText, PERSON_RED, pictureCredit, pictureNote, commonsPage, voyageYears, parsePictures, parsePictureAt, pictureAtText, picturePlaces, frameOf, sightFrame, viewContaining, withPictures, peopleOf, whoOf, deathOf, sightPicturesOf, MEMENTO, MEMENTO_EN, mementoNext, mementoLines } from './people.mjs';
import { fold, bestPlace, withoutPartsOfFrames } from './placename.mjs';
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

// The styles chosen from a list, each by the id of its chips, the hash key it rides under and the list it is drawn from:
// read from the hash, shown and read back from the drawer by one loop each (writeHash keeps its own order, which links carry).
const ENUMS = { rivers: ['rivers', RIVER_STYLES], lakes: ['lakes', LAKE_STYLES], reefs: ['reefs', REEF_STYLES], playas: ['playas', PLAYA_STYLES], peaks: ['peaks', PEAK_STYLES], trees: ['trees', TREE_STYLES], overlap: ['overlap', OVERLAP_RULES], scaleBorder: ['scaleborder', SCALE_BORDERS], regionSet: ['regionset', REGION_SETS], regionStyle: ['regionstyle', REGION_STYLES] };
const DEFAULTS = { ink: '#3b2a1a', parchment: '#e9d8b4', density: 1, names: true, rhumb: true, scale: 'genoese', continentsZoom: CONTINENT_ZOOM_END, regions: 'latin', regionSet: 'today', regionStyle: 'combination', regionsZoom: 7, title: 'PORTOLANI', autoTitle: true, land: 'ochre', islands: false, rivers: 'plain', lakes: 'marina', reefs: 'crosses', playas: 'salt', peaks: 'catalan', mountains: 'colour', trees: 'marina', seaTint: false, scaleBorder: 'bordered', townSize: TOWN_SIZES[0], voyages: [], voyageWidth: VOYAGE_WIDTH, voyageDraw: VOYAGE_DRAW.seconds, voyagePlay: VOYAGE_PLAY.seconds, person: null, sight: null, site: null, pictures: null, ...OVERLAY_DEFAULTS, cartouchePos: DEFAULT_CARTOUCHE_CORNER, scalePos: DEFAULT_SCALE_CORNER, overlap: DEFAULT_OVERLAP };
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
const DEFAULT_SELECTION = defaultSprites(SPRITES), DEFAULT_SET = new Set(DEFAULT_SELECTION);
// the kinds a drawer lists, each with its heading; the mountain kind is the Catalan sprites, which stand on the hills, in the relief picker
const KIND_UI = [['monster', 'Monsters'], ['ship', 'Ships'], ['rose', 'Roses'], ['town', 'Towns'], ['mountain', 'Hill drawings'], ['cartouche', 'Cartouche']];
const FIGURE_KINDS = KIND_UI.map(([k]) => k).filter((k) => k !== 'cartouche');
const pickerOf = (kind) => $(kind === 'mountain' ? 'pick-relief' : `pick-${kind}`);
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
// whether a grouped list's section opens when a mouse rests on its heading (`hover=`); on is written as no key, `hover=0` is off
const hoverFromHash = () => hashParams().get('hover') !== '0';

function viewFromHash() {
  const q = hashParams(), m = /^(-?[\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)$/.exec(q.get('map') ?? '');
  const v = m && { zoom: Number(m[1]), lat: Number(m[2]), lon: Number(m[3]) };
  const at = v && Object.values(v).every(Number.isFinite) ? v : DEFAULT_VIEW; // e.g. #map=1.2.3/40/5
  return clampView({ ...at, projection: q.get('projection'), bearing: Number(q.get('bearing')) || 0 }); // bearing=270: west up
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
    regionsZoom: q.get('regions') === 'off' ? 0 : q.has('regionszoom') ? zoomOf(q.get('regionszoom'), DEFAULTS.regionsZoom) : DEFAULTS.regionsZoom,
    title: q.get('title') ?? DEFAULTS.title,
    // a link from before automatic was the default, with a title and no autotitle, keeps its title
    autoTitle: q.has('autotitle') ? q.get('autotitle') === '1' : !q.has('title') && DEFAULTS.autoTitle,
    land: LANDS.includes(q.get('land')) && q.get('land') !== 'islands' ? q.get('land') : DEFAULTS.land,
    islands: q.has('islands') ? q.get('islands') === '1' : q.get('land') === 'islands', // older: land=islands was the coloured islands
    ...Object.fromEntries(Object.entries(ENUMS).map(([k, [key, of]]) => [k, of.includes(q.get(key)) ? q.get(key) : DEFAULTS[k]])),
    // older links named the drawn styles in `relief`: colour wins where it is listed
    mountains: ['off', 'ink', 'shadow', 'me1937', 'me1954'].includes(q.get('mountains')) ? q.get('mountains')
      : q.has('relief') ? (q.get('relief').split(',').includes('marina') ? 'colour' : q.get('relief').includes('engraved') ? 'ink' : 'off') : DEFAULTS.mountains,
    seaTint: q.get('seas') === '1' || q.get('redsea') === '1',
    scale: q.get('scale') === 'off' || SCALE_NAMES.includes(q.get('scale')) ? q.get('scale') : DEFAULTS.scale,
    cartouchePos: CORNERS.includes(q.get('cartouche')) ? q.get('cartouche') : DEFAULTS.cartouchePos, // dragged to a corner of the map
    scalePos: CORNERS.includes(q.get('scalepos')) ? q.get('scalepos') : DEFAULTS.scalePos,
    townSize: TOWN_SIZES.includes(q.get('townsize')) ? q.get('townsize') : DEFAULTS.townSize,
    placement: parsePlacement(q.get('placement')).text,
    // under the hood, for a while: the sheets in red and the knobs fixed in the code, each as its canonical text
    debug: parseDebug(q.get('debug')).text,
    tune: parseTune(q.get('tune')).text,
    voyages: voyagesFromHash(q),
    voyageWidth: VOYAGE_WIDTHS.includes(Number(q.get('voyagewidth'))) ? Number(q.get('voyagewidth')) : DEFAULTS.voyageWidth,
    voyageDraw: voyageDrawSeconds(q.get('voyagedraw')),
    voyagePlay: voyagePlaySeconds(q.get('voyageplay')),
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
// each with the colour picked for it after a colon, or the ink it was given (settleInks) after a dot:
// voyages=columbus.8c2f1e,drake:1f4e8c. A voyage hidden by its eye keeps its place and its ink, and ends in ~:
// voyages=columbus.8c2f1e~,drake. A voyage with neither takes the next free ink. An older link's single voyage=<id> is
// read as a list of one.
function voyagesFromHash(q) {
  const list = q.has('voyages') ? q.get('voyages').split(',') : q.has('voyage') ? [q.get('voyage')] : [];
  const seen = new Set();
  const hex = (c) => (/^[0-9a-f]{6}$/i.test(c ?? '') ? `#${c.toLowerCase()}` : null);
  return list.map((t) => {
    const hidden = t.endsWith('~'), [named, c] = (hidden ? t.slice(0, -1) : t).split(':'), [id, ink] = named.split('.');
    return { id, colour: hex(c), ...(hex(ink) && { ink: hex(ink) }), ...(hidden && { hidden: true }) };
  })
    .filter((v) => /^[a-z][a-z0-9-]*$/.test(v.id) && v.id !== 'off' && !seen.has(v.id) && seen.add(v.id));
}
// The selection a hash names; an older link's rendering, styles and kinds become the selection they drew.
function selectionFromHash() {
  const q = hashParams();
  if (q.has('sprites')) return new Set(q.get('sprites').split(',').filter(Boolean).map(decodeKey).filter((k) => BY_KEY.has(k)));
  if (!LEGACY_KEYS.some((k) => q.has(k))) return new Set(DEFAULT_SET);
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
  if (v.bearing) q.set('bearing', String(Math.round(v.bearing * 10) / 10)); // the world turned: the compass direction at the top, north up written as no key
  if (!hoverOpen) q.set('hover', '0');
  if (!sameSet(selection, DEFAULT_SET)) q.set('sprites', SPRITES.filter((s) => selection.has(s.key)).map((s) => encodeKey(s.key)).join(','));
  if (st.townSize !== DEFAULTS.townSize) q.set('townsize', st.townSize);
  if (!st.names) q.set('names', '0');
  if (!st.rhumb) q.set('rhumb', '0');
  if (st.continentsZoom !== DEFAULTS.continentsZoom) q.set('continents', st.continentsZoom);
  if (st.regions !== DEFAULTS.regions) q.set('regions', st.regions);
  if (st.regionSet !== DEFAULTS.regionSet) q.set('regionset', st.regionSet);
  if (st.regionStyle !== DEFAULTS.regionStyle) q.set('regionstyle', st.regionStyle);
  if (st.regionsZoom !== DEFAULTS.regionsZoom) q.set('regionszoom', st.regionsZoom);
  // a title without autotitle reads as custom (styleFromHash), so a typed title carries the mode with it
  if (st.autoTitle !== DEFAULTS.autoTitle || st.title !== DEFAULTS.title) q.set('autotitle', st.autoTitle ? '1' : '0');
  if (st.title !== DEFAULTS.title) q.set('title', st.title);
  if (st.land !== DEFAULTS.land) q.set('land', st.land);
  if (st.islands !== DEFAULTS.islands) q.set('islands', st.islands ? '1' : '0');
  if (st.rivers !== DEFAULTS.rivers) q.set('rivers', st.rivers);
  if (st.lakes !== DEFAULTS.lakes) q.set('lakes', st.lakes);
  if (st.reefs !== DEFAULTS.reefs) q.set('reefs', st.reefs);
  if (st.playas !== DEFAULTS.playas) q.set('playas', st.playas);
  if (st.peaks !== DEFAULTS.peaks) q.set('peaks', st.peaks);
  if (st.mountains !== DEFAULTS.mountains) q.set('mountains', st.mountains);
  if (st.trees !== DEFAULTS.trees) q.set('trees', st.trees);
  if (st.placement) q.set('placement', st.placement);
  if (st.overlap !== DEFAULTS.overlap) q.set('overlap', st.overlap);
  if (st.debug) q.set('debug', st.debug);
  if (st.tune) q.set('tune', st.tune);
  if (st.voyages.length) q.set('voyages', st.voyages.map((v) => (v.colour ? `${v.id}:${v.colour.slice(1)}` : v.ink ? `${v.id}.${v.ink.slice(1)}` : v.id) + (v.hidden ? '~' : '')).join(','));
  if (st.voyageWidth !== DEFAULTS.voyageWidth) q.set('voyagewidth', st.voyageWidth);
  if (st.voyageDraw !== DEFAULTS.voyageDraw) q.set('voyagedraw', st.voyageDraw);
  if (st.voyagePlay !== DEFAULTS.voyagePlay) q.set('voyageplay', st.voyagePlay);
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
for (const kind of FIGURE_KINDS) {
  for (const fam of familiesOf(kind)) {
    const row = document.createElement('div'), head = document.createElement('label'), box = document.createElement('input'), count = document.createElement('span'), thumbs = document.createElement('div');
    row.className = 'family'; head.className = 'fam'; count.className = 'count'; thumbs.className = 'thumbs';
    box.type = 'checkbox';
    head.append(box, fam.label, count);
    thumbs.append(...fam.sprites.map((s) => thumb(s, fam.label)));
    row.append(head, thumbs);
    const pick = pickerOf(kind);
    // a family is a chip with its picture, its name and how many of it are on; the one open shows its pictures in the tray below the chips
    if (!pick.firstChild) pick.append(Object.assign(document.createElement('div'), { className: 'fam-chips' }), Object.assign(document.createElement('div'), { className: 'fam-tray' }));
    const chips = pick.firstChild, tray = pick.lastChild;
    const chip = Object.assign(document.createElement('button'), { type: 'button', className: 'chip fam-chip' }), tally = document.createElement('b');
    const pic = Object.assign(document.createElement('span'), { className: 'sample' });
    pic.append(thumbs.firstChild.firstChild.cloneNode(true));
    chip.append(pic, Object.assign(document.createElement('span'), { textContent: fam.label }), tally);
    chip.setAttribute('aria-expanded', 'false');
    chip.addEventListener('click', () => {
      const opening = chip.getAttribute('aria-expanded') !== 'true';
      for (const c of chips.children) c.setAttribute('aria-expanded', 'false');
      tray.replaceChildren();
      if (opening) { chip.setAttribute('aria-expanded', 'true'); tray.append(row); }
    });
    chips.append(chip);
    if (chips.children.length === 1) chip.click(); // the first family starts open
    const keys = fam.sprites.map((s) => s.key);
    familyBoxes.push({ box, count, keys, chip, tally });
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
  shadow: svg('<path d="M3 15 10 4l3 5 4-7 8 13Z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M3 15 10 4l-.5 3.5L6 15ZM13 9l-1.5 6H10ZM17 2l-1.3 4.5L14 15h-1.5Z" fill="#efe3c4"/>'),
  me1954: svg(`<path d="M3 15 10 4l3 5 4-7 8 13" ${stroke('currentColor', 0.8)}/><path d="M17 2l1 5M18 4l1.5 5M19.5 6l1.5 5M10 4l.5 4M11 6l1 4" ${stroke('currentColor', 0.7)}/>`),
  me1937: svg(`<path d="M3 15 10 4l3 5 4-7 8 13" ${stroke('currentColor', 1)}/><path d="M10 4l1 6 2 5h-3ZM17 2l1.5 8 3 5h-4Z" fill="currentColor"/><path d="M21 10l2 5M22.5 11l1.5 4M2 13l-1.5 1.5M4 11l-2 1" ${stroke('currentColor', 0.6)}/>`),
  colour: svg('<path d="M3 15 10 4l3 5 4-7 8 13Z" fill="#d2965a" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M17 2l3 13h5ZM10 4l2 11h-3Z" fill="rgba(150,70,32,.7)"/>'),
};
const HILL_GLYPH = svg('<path d="M3 15c3-9 8-9 11 0M12 15c3-7 7-7 10 0" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"/><path d="M6 11l1 2M9 11l1 2M16 11l1 2M19 11l1 2" stroke="currentColor" stroke-width=".6"/>');
// a lone peak, as the Catalan sprite that stands on each landmark summit
const PEAK_GLYPH = svg('<path d="M7 15.5 14 2.5l7 13Z" fill="#d6a368" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/><path d="M14 2.5l2.5 13H21Z" fill="rgba(150,70,32,.7)"/><path d="M4 16h20" stroke="#8fa86a" stroke-width="1.4"/>');
const WIGGLE = (c) => svg(`<path d="M2 9q3-6 6 0t6 0 6 0 6 0" ${stroke(c, 1.2)}/>`);
const RIVER_GLYPHS = { aguiar: WIGGLE('#3b2a1a'), marina: svg(`<path d="M2 7h24M2 11h24" ${stroke('#3b2a1a', 1)}/>`), plain: lineOf('#4a7fa0', 2) };
const LAKE_GLYPHS = {
  aguiar: svg('<path d="M14 3l5 6-5 6-5-6Z" fill="#a8432e" stroke="#3b2a1a" stroke-width=".8"/>'),
  marina: svg(`<ellipse cx="14" cy="9" rx="9" ry="5" ${stroke('#3b2a1a', 1)}/><path d="M7 7l5 4M10 5l7 6M15 5l5 4" ${stroke('#3b2a1a', 0.6)}/>`),
  plain: svg('<ellipse cx="14" cy="9" rx="9" ry="5" fill="#8fb4c8" stroke="#4a7fa0" stroke-width="1"/>'),
};
const REEF_GLYPHS = {
  crosses: svg(`<path d="M5 6l4 4M9 6l-4 4M13 6l4 4M17 6l-4 4M21 6l4 4M25 6l-4 4" ${stroke('#3b2a1a', 1.1)}/>`),
  dots: svg('<g fill="#a8432e"><circle cx="4" cy="9" r="1.3"/><circle cx="9" cy="9" r="1.3"/><circle cx="14" cy="9" r="1.3"/><circle cx="19" cy="9" r="1.3"/><circle cx="24" cy="9" r="1.3"/></g>'),
};
const PLAYA_GLYPHS = {
  salt: svg('<path d="M4 11q-2-6 5-7t9 1 7 4-4 6-9 1-8-5Z" fill="#f3eee2" stroke="#8a7f6a" stroke-width="1" stroke-dasharray="1.5 2.5"/>'),
  ruled: svg(`<path d="M4 11q-2-6 5-7t9 1 7 4-4 6-9 1-8-5Z" fill="#cdbb98" stroke="#3b2a1a" stroke-width="1"/><path d="M6 7h16M5 10h17M8 13h12" ${stroke('#3b2a1a', 0.7)} stroke-dasharray="5 3"/>`),
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
  wipe: svg(`<rect x="3" y="3" width="22" height="12" ${stroke('currentColor', 0.8)}/><rect x="3" y="3" width="11" height="12" fill="${RED}" fill-opacity="0.35"/><path d="M14 1v16" ${stroke(RED, 1.5)}/>`), // the chart left of a line, the map right
  swipe: svg(`<rect x="3" y="3" width="22" height="12" ${stroke('currentColor', 0.8)}/><rect x="3" y="3" width="11" height="12" fill="${RED}" fill-opacity="0.35"/><path d="M14 1v16" ${stroke(RED, 1.5)}/><path d="M10 9l-3-2v4ZM18 9l3-2v4Z" fill="${RED}"/>`), // the same, with a handle to drag
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
  // a period's names: plain ink, or as the atlas letters them (its italic in red and blue, a reading under each, a click opens its text)
  regionStyle: [['plain', 'Plain ink', 'the names in ink, as today\'s', NAME_SAMPLE('Turquia')], ['combination', 'Red and blue, with readings', 'italic in the atlas\'s alternating red and blue, an English reading under each name; click a name for its text', '<span class="rub"><em style="color:#8c2f1e">Turquia</em><small>ANATOLIA</small></span><span class="rub"><em style="color:#2f4a86">Rossia</em><small>RUS\'</small></span>']],
  titleMode: [['auto', 'Automatic', 'what the view shows'], ['custom', 'Custom']],
  mountains: [['off', 'Off', '', MOUNTAIN_GLYPHS.off], ['ink', 'Hatched', 'black and white hatching, as Engraved', MOUNTAIN_GLYPHS.ink], ['colour', 'Colour', 'ochre wash, as the Carta Marina', MOUNTAIN_GLYPHS.colour], ['shadow', 'Shadow', 'a flat ink shadow with a narrow lit side and a paper halo, after a Middle-earth tutorial', MOUNTAIN_GLYPHS.shadow], ['me1937', 'M.E. 1937', 'Middle-earth, the Hobbit map: sharp pen peaks, a solid east flank, foothill ridgelets', MOUNTAIN_GLYPHS.me1937], ['me1954', 'M.E. 1954', 'Middle-earth, the Lord of the Rings map: hairline peaks, a few hatch strokes down the east flank, the west blank', MOUNTAIN_GLYPHS.me1954]],
  hills: [['off', 'Off', '', MOUNTAIN_GLYPHS.off], ['catalan', 'Catalan drawings', 'Catalan Atlas, 1375', HILL_GLYPH]],
  peaks: [['off', 'Off', '', MOUNTAIN_GLYPHS.off], ['catalan', 'Landmark peaks', 'named summits; a click gives the height', PEAK_GLYPH]],
  land: [['off', 'Off', '', MOUNTAIN_GLYPHS.off], ['gilt', 'Gilt wash', '', LAND_GLYPHS.gilt], ['green', 'Green wash', 'Oliva, c.1590', LAND_GLYPHS.green], ['ochre', 'Ochre with shoals', 'Benincasa, 1466', LAND_GLYPHS.ochre]],
  islands: [['off', 'Plain islands'], ['on', 'Coloured islands', 'Beccari, 1403', ISLANDS_GLYPH]],
  seaTint: [['off', 'Plain seas'], ['on', 'Coloured seas', 'Red, Black and Caspian Seas, the Persian Gulf', SEAS_GLYPH]],
  rivers: [['off', 'Off'], ['aguiar', 'Wiggled ink', 'Aguiar, 1492', RIVER_GLYPHS.aguiar], ['marina', 'Double line', 'Carta Marina, 1539', RIVER_GLYPHS.marina], ['plain', 'Plain blue line', '', RIVER_GLYPHS.plain]],
  lakes: [['off', 'Off'], ['aguiar', 'Lozenges', 'Aguiar, 1492', LAKE_GLYPHS.aguiar], ['marina', 'True shapes, hatched', 'Carta Marina, 1539', LAKE_GLYPHS.marina], ['plain', 'True shapes, blue wash', '', LAKE_GLYPHS.plain]],
  reefs: [['off', 'Off'], ['crosses', 'Crosses', 'the portolan charts’ rocks and reefs', REEF_GLYPHS.crosses], ['dots', 'Red dots', 'as the shoals off an ochre coast', REEF_GLYPHS.dots]],
  playas: [['off', 'Off'], ['salt', 'Pale salt', 'a crust with a dotted edge', PLAYA_GLYPHS.salt], ['ruled', 'Ruled clay', 'broken lines, as the Carta Marina’s lakes', PLAYA_GLYPHS.ruled]],
  trees: [['off', 'Off', '', MOUNTAIN_GLYPHS.off], ['marina', 'Green crowns', 'Carta Marina, 1539', TREE_GLYPHS.marina], ['ink', 'Ink only', '', TREE_GLYPHS.ink]],
  scale: [['off', 'Off'], ['genoese', 'Genoese', 'drawn as vectors'], ['chequer', 'Chequer'], ['chevron', 'Chevron ladder', 'Genoese'], ['ribbon', 'Ribbon', 'Martines'], ['beads', 'Beads', 'Prunes'], ['ruled', 'Ruled', 'Beccari']].map(([value, label, note = '']) => [value, label, note, SCALE_GLYPHS[value]]),
  voyageWidth: VOYAGE_WIDTHS.map((w, i) => [String(w), ['Fine', 'Standard', 'Bold', 'Heavy'][i] ?? `${w} px`, `${w} px`, lineOf('#8c2f1e', w)]),
  scaleBorder: [['bordered', 'Bordered', 'parchment and a double rule'], ['blank', 'Blank', 'parchment, no rule'], ['transparent', 'Transparent', 'drawn over the map']].map(([value, label, note = '']) => [value, label, note, BORDER_GLYPHS[value]]),
  debug: [['off', 'Off', '', HOOD_GLYPHS.off], ['sheets', 'Outlines', 'each sheet of the atlas at this view, in red, with its name', HOOD_GLYPHS.sheets], ['sheets,rings', 'Outlines + rings', 'and each sheet\'s hidden circle: its hub and sixteen nodes', HOOD_GLYPHS.rings]],
  sheetHides: [['0', 'Voyage rides over', 'a voyage is drawn over the sheet, wherever it lies, and the sheet stays', HOOD_GLYPHS.ride], ['1', 'Sheet hides', 'a voyage\'s fly takes the sheet off if it would cover the voyage\'s frame', HOOD_GLYPHS.lifted]],
  compare: [['off', 'Off', 'the pieces over the whole map', HOOD_GLYPHS.off], ['wipe', 'Slider wipe', 'the pieces left of a line, the bare map right; the slider below moves it', HOOD_GLYPHS.wipe], ['swipe', 'Swipe', 'the same, and the line on the map is dragged', HOOD_GLYPHS.swipe]],
  overlayMode: [['sheet', 'One sheet', 'the whole scan, opaque, laid level and centred, dragged by hand', HOOD_GLYPHS.sheets], ['pieces', 'Warped pieces', 'each piece warped onto today\'s coast, at the opacity below', HOOD_GLYPHS.rings]],
  tuneOrigin: [['rose', `Catalan rose (${ROSE_AT})`, 'every band\'s grid has a corner on the rose', HOOD_GLYPHS.rose], ['zero', '0° 0°', 'NOAA\'s own zero', HOOD_GLYPHS.zero]],
  tuneCurated: [['1', 'On', 'the curated charts take the place of the grid cells they hold', HOOD_GLYPHS.curated], ['0', 'Off', 'grid cells everywhere', HOOD_GLYPHS.grid]],
  hoverOpen: [['off', 'Off', 'a click opens a section', HOVER_GLYPHS.off], ['on', 'On', 'resting the pointer on a heading opens its section', HOVER_GLYPHS.on]],
  tuneRoselines: [['1', 'On', 'the rose\'s 32 lines as one more hub at every zoom', HOOD_GLYPHS.roselines], ['0', 'Off', 'only the sheet the rose falls in', HOOD_GLYPHS.off]],
  flyShape: [['step', 'Step', 'out about the place left, across at the top, down onto the place; Blend lets the pan run alongside the zoom'], ['hyperbolic', 'Hyperbolic', 'van Wijk & Nuij, as MapLibre flies: pan and zoom together on one curve, Curve setting its height']],
};
CHOICES.projectionCharts = CHOICES.projection; // the same chips in the Charts drawer; the two are one setting
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
  $('projection').value = $('projectionCharts').value = view.projection;
  $('ink').value = style.ink; $('parchment').value = style.parchment;
  $('density').value = style.density; $('densityOut').textContent = style.density;
  $('names').checked = style.names; $('rhumb').checked = style.rhumb; $('scale').value = style.scale;
  $('land').value = style.land; $('islands').value = style.islands ? 'on' : 'off'; $('seaTint').value = style.seaTint ? 'on' : 'off';
  for (const k of Object.keys(ENUMS)) $(k).value = style[k];
  $('mountains').value = style.mountains; $('hills').value = CATALAN_KEYS.some((k) => selection.has(k)) ? 'catalan' : 'off';
  $('continentsZoom').value = style.continentsZoom; $('continentsOut').textContent = zoomLabel(style.continentsZoom);
  $('regions').value = style.regions; $('regionsZoom').value = style.regionsZoom; $('regionsOut').textContent = zoomLabel(style.regionsZoom);
  showRegionSamples();
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
  for (const { box, count, keys, chip, tally } of familyBoxes) {
    const on = keys.filter((k) => selection.has(k)).length;
    box.checked = on === keys.length; box.indeterminate = on > 0 && on < keys.length;
    count.textContent = `${on} of ${keys.length}`;
    tally.textContent = `${on}/${keys.length}`;
    chip.dataset.state = on === 0 ? 'none' : on === keys.length ? 'all' : 'part';
  }
}
function readControls() {
  style = {
    ink: $('ink').value, parchment: $('parchment').value, density: Number($('density').value),
    names: $('names').checked, rhumb: $('rhumb').checked, scale: $('scale').value,
    land: $('land').value, islands: $('islands').value === 'on', seaTint: $('seaTint').value === 'on', mountains: $('mountains').value,
    ...Object.fromEntries(Object.keys(ENUMS).map((k) => [k, $(k).value])),
    continentsZoom: Number($('continentsZoom').value), regions: $('regions').value, regionsZoom: Number($('regionsZoom').value),
    // automatic shows the view's name in the box, which is not the typed title
    title: $('titleMode').value === 'auto' || style.autoTitle ? style.title : $('title').value, // switching to custom starts from the typed title, not the name shown
    autoTitle: $('titleMode').value === 'auto',
    // checked, by metro area; a link's townsize=population is kept until the box is touched
    townSize: $('townSize').checked ? (style.townSize === 'rank' ? 'area' : style.townSize) : 'rank',
    placement: style.placement, // chosen by the placement chips below
    cartouchePos: style.cartouchePos, scalePos: style.scalePos, // set by dragging the cartouche or the scale bar
    ...readHood(),
    voyages: style.voyages, voyageWidth: Number($('voyageWidth').value), voyageDraw: style.voyageDraw, voyagePlay: style.voyagePlay, // chosen in the voyages drawer, and the link
    overlays: style.overlays, sheets: style.sheets, // chosen in the charts drawer, and by dragging a sheet
  };
  // hills are the Catalan sprites: the chip selects all of them or none
  const hills = $('hills').value === 'catalan';
  if (hills !== CATALAN_KEYS.some((k) => selection.has(k))) for (const k of CATALAN_KEYS) hills ? selection.add(k) : selection.delete(k);
  view = clampView({ ...view, projection: $('projection').value }, view.lat); // the same centre in any projection: no jump
  showRegionSamples();
  changed();
}
// The region chips' samples: a language chip shows a name of the chosen set, a set chip a name in the chosen language;
// under a period's names the Latin chip letters the atlas's own spelling, so it reads "As lettered". The samples are
// scene.mjs's REGION_SAMPLES.
function showRegionSamples() {
  $('regionStyle').hidden = style.regionSet === 'today'; // today's names are always plain
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
  $('compare').value = style.compare; $('compareRow').hidden = style.overlayMode !== 'pieces'; $('compare').hidden = style.overlayMode !== 'pieces'; $('comparePosRow').hidden = style.overlayMode !== 'pieces' || style.compare !== 'wipe';
  $('comparePos').value = String(style.comparePos); $('comparePosOut').textContent = `${Math.round(style.comparePos * 100)}%`; placeCompareLine();
  $('overlayOpacity').value = String(effectiveOpacity(style)); $('overlayOpacityOut').textContent = `${Math.round(effectiveOpacity(style) * 100)}%`;
  const t = parseTune(style.tune).tune, at = (name) => t[name] ?? TUNE_KNOBS[name].def;
  for (const [name, id] of Object.entries(KNOB_CHIPS)) $(id).value = String(at(name));
  for (const [name, id] of Object.entries(KNOB_SLIDERS)) {
    const v = at(name), el = $(id);
    el.value = v ?? { roseshare: ROSE_SHARE, sheetroses: SHEET_ROSES }[name];
    if (v == null) delete el.dataset.set; else el.dataset.set = '1';
    $(`${id}Out`).textContent = v == null ? BAND_OWN[name] : KNOB_OUT[name](v);
  }
}
// the slider's value only while its own mode is showing and it was moved off the mode's default; a mode change drops it, so one mode's opacity never lands on the other
function opacityRead() {
  if ($('overlayMode').value !== style.overlayMode || $('overlayOpacityRow').hidden) return $('overlayMode').value !== style.overlayMode ? null : style.overlayOpacity;
  const v = Number($('overlayOpacity').value);
  return v === effectiveOpacity(style) ? style.overlayOpacity : v;
}
function readHood() {
  const pairs = [...Object.entries(KNOB_CHIPS).map(([name, id]) => [name, $(id).value]),
    ...Object.entries(KNOB_SLIDERS).filter(([, id]) => $(id).dataset.set).map(([name, id]) => [name, $(id).value])];
  return { debug: parseDebug($('debug').value).text, tune: parseTune(pairs.map(([n, v]) => `${n}:${v}`).join(',')).text, overlayMode: $('overlayMode').value, compare: $('compare').value, comparePos: Number($('comparePos').value), sheetHides: $('sheetHides').value === '1', overlayOpacity: opacityRead() };
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
  all: () => keys, dflt: keys.filter((k) => DEFAULT_SET.has(k)), get: () => keys.filter((k) => selection.has(k)),
  set: (on) => { for (const k of keys) selection.delete(k); for (const k of on) selection.add(k); changed(); },
});
for (const [kind, label] of KIND_UI) if (kind !== 'cartouche') pickerOf(kind).prepend(spriteTools(label, kindKeys(kind)));

// the style switches: off, or the default (the first drawn style where the default is off)
const STYLE_SWITCHES = [
  ['mountains', 'Mountain style', MOUNTAIN_GLYPHS.colour], ['trees', 'Trees', TREE_GLYPHS.marina],
  ['rivers', 'Rivers', RIVER_GLYPHS.plain], ['lakes', 'Lakes', LAKE_GLYPHS.marina],
  ['reefs', 'Reefs', REEF_GLYPHS.crosses], ['playas', 'Salt flats', PLAYA_GLYPHS.salt], ['peaks', 'Landmark peaks', PEAK_GLYPH],
];
let showUiNow = () => {};
let showMoods = () => {}; // the Moods: its chips show which look is on
if (UI) {
  document.documentElement.dataset.ui = UI;
  $('ui').hidden = false;
  const body = $('ui-body'), refreshers = [];
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
      b.classList.add('preset'); if (m.all) b.classList.add('all'); b.title = `${label}: ${note}`;
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
      ...style, ...parsePlacement(style.placement), relief: style.mountains === 'colour' ? ['marina'] : style.mountains === 'ink' ? ['engraved'] : style.mountains === 'off' ? [] : [style.mountains],
      continents: style.continentsZoom > 0, continentsZoom: style.continentsZoom,
      regions: style.regionsZoom > 0 ? style.regions : 'off', regionSet: style.regionSet, regionStyle: style.regionStyle, regionsZoom: style.regionsZoom,
      sprites: [...selection], kinds, view, pinned: !phone.matches, pinTitle: style.autoTitle ? pinTitle : null,
      voyages: style.voyages.filter((v) => !v.hidden || litBy(v.id)).map((v) => ({ id: v.id, colour: ink[v.id], width: style.voyageWidth, ...(v.hidden && { hidden: true }) })), person: style.person, voyageWidth: style.voyageWidth,
      overlays: style.overlays.map((id) => ({ id, mode: style.overlayMode, sheet: style.sheets[id] ?? null, opacity: effectiveOpacity(style), clip: style.compare === 'off' ? null : style.comparePos })),
      sights: sightTiles().map(({ lon, lat, tile }) => ({ name: tile.title, lon, lat, ruin: tile.ruin ?? false, ...(tile.site != null && { site: tile.site }) })),
      debug: parseDebug(style.debug).debug, tune: parseTune(style.tune).tune,
    });
    if (me !== run) return; // a newer change or a move superseded this one
    ground = { world, coarse, bg, voyages: scene.voyages, marks: drawnMarks(scene, data), peaks: drawnPeaks(scene, data), anchored: anchorScene(scene, data), overlays: scene.overlays, cards: { cartouche: kinds.includes('cartouche') ? scene.cartouche : null, scaleSprite: scene.scaleSprite, scale: style.scale, bg } };
    if (JSON.stringify(voyageInk()) !== inkKey) { showVoyage(); render(); return; } // the sheet laid or lifted changed which voyages cross it: draw again in their inks
    applyReveal();
    if (style.autoTitle) $('title').value = scene.cartouche.title; // the box shows what the cartouche letters, and cannot be edited
    placed = view;
    if (keepTile) keepTile = false; else hideTile(); // its mark may be gone: another voyage, or none; a sight's tile just opened stays
    if (reopen && !flightTo) { const t = reopen, m = sightsHit(viewProjection(placed), FULL).find((h) => h.tile === t); reopen = null; if (m) showTileAt([m.x, m.y]); }
    cancelAnimationFrame(frame); frame = 0; // a moving frame still queued would paint over the scene
    const t1 = performance.now();
    const fading = scene.overlays.find((o) => o.mode === 'sheet' && o.id === fadeIn);
    if (fading) { fadeIn = null; fading.alpha = 0; } // drawn without the sheet, which fades in over it
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, scene, data, bg, { scale: 1, x: 0, y: 0 });
    if (fading) fadeSheet(fading, data.proj, me);
    drawPictures(ctx);
    drawCards();
    placeSheetChips(); showCompass();
    if (!fading || fading.alpha >= 1) placeLayer(); // a sheet fading in places it when whole
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

// Seven buttons in the row and seven drawers: the rose the settings, the chart the charts, the astrolabe the points of
// interest, the compass Go, the dividers the voyages and the medallion the people (each a vertical timeline), the
// anchor the anchorages.
// At most one is open. A click on a button opens its drawer and a second click shuts it; a click on another
// button shuts it and opens that one; Esc, or a
// click or a focus outside the row and the drawer, shuts it. A choice in it leaves it open, and the map does what
// was asked behind it (docs/spec/design.md, "A drawer stays open on a click or a choice"). On a wide screen the
// drawer hangs below the row, which it never covers or moves, and a touch on the map shuts it; on a phone it is a
// bottom sheet, and a tap or a drag on the map leaves it up (the user, 2026-10-30, reversing #262): that is how a
// control's effect is seen. An open drawer takes the focus (Go its
// text box, on a wide screen only, so a phone's keyboard does not cover the sheet); shut by the keyboard,
// the focus goes back to the button that opened it.
const where = $('where');
const drawers = [[$('open'), $('drawer')], [$('charts'), $('chartsDrawer')], [$('sights'), $('sightsPanel')], [$('go'), $('goPanel')], [$('voyages'), $('voyagesPanel')], [$('people'), $('peoplePanel')], [$('anchor'), $('anchorPanel')]];
const openDrawer = () => drawers.find(([, d]) => d.classList.contains('open'))?.[1] ?? false;
let openedBy = null; // the button the open drawer was opened by
const focusable = (d) => [...d.querySelectorAll('button, input, a[href]')].find((e) => !e.disabled && e.getClientRects().length);
function setDrawer(open, byKeyboard = false, by = drawers.find(([, d]) => d === open)?.[0] ?? null) { // the drawer to open, or false for none
  const was = openDrawer(), wasBy = openedBy;
  if (open === was && (!open || by === openedBy)) return;
  openedBy = open ? by : null;
  for (const [b, d] of drawers) { d.classList.toggle('open', d === open); b.setAttribute('aria-expanded', String(d === open && b === openedBy)); }
  if (open?.id === 'voyagesPanel') fillVoyages(); else if (open?.id === 'peoplePanel') fillPeople(); // the lists load on the first open
  placeBand();
  if (open === was) return; // the same drawer again
  document.documentElement.classList.toggle('sheet', !!open && !open.classList.contains('menu')); // on a phone the map makes room above the settings or the charts; a lighter drawer sits over its foot
  if (open?.id === 'chartsDrawer') chartsFresh = !style.overlays.length;
  if (open) (open.id === 'goPanel' ? (phone.matches ? null : $('coordsText')) : focusable(open))?.focus({ preventScroll: true });
  else if (byKeyboard) wasBy?.focus({ preventScroll: true });
  else if (was.contains(document.activeElement)) document.activeElement.blur(); // a phone's keyboard goes with it
}
for (const [b, d] of drawers) b.addEventListener('click', (e) => setDrawer(d === openDrawer() && b === openedBy ? false : d, e.detail === 0, b)); // detail 0: Enter or Space
addEventListener('keydown', (e) => { if (e.key === 'Escape' && openDrawer()) setDrawer(false, true); });
// the play band is not the map, nor is the skull: their buttons leave a drawer open, so the table is cleared mid-use
const outside = (t) => { const d = openDrawer(); return d && t instanceof Node && !where.contains(t) && !d.contains(t) && !$('voyageBand').contains(t) && !$('memento').contains(t); };
// On a phone every drawer stays up while the map is tapped or moved.
addEventListener('pointerdown', (e) => { if (outside(e.target) && !(phone.matches && e.target === canvas)) setDrawer(false); });
addEventListener('focusout', (e) => { if (e.relatedTarget && outside(e.relatedTarget)) setDrawer(false); }); // tabbed out; a click that focuses nothing has no relatedTarget

// Reset: every control back to its default, the view (place, projection and bearing), the hover kept. The hash holds the whole
// style, so a hash with only the view is the default style; the hashchange handler below redraws from it.
$('reset').addEventListener('click', () => {
  const m = hashParams().get('map'), p = hashParams().get('projection'), b = hashParams().get('bearing');
  $('shareUrl').hidden = true; $('shareNote').textContent = '';
  location.hash = [m && `map=${m}`, p && `projection=${p}`, b && `bearing=${b}`, !hoverOpen && 'hover=0'].filter(Boolean).join('&');
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

// ---------------------------------------------------------------- the drawer: moods, then Sea · Land · Margins

// Under the moods, the controls in three tabs by where the thing is drawn. Each control (a .ctl, with the lead
// paragraph written for it) is one element, moved from index.html's own sections into its tab's pane.
const LAND_GROUP = ['continents', 'regions', 'land', 'colour', 'rivers', 'lakes', 'reefs', 'playas', 'mountains', 'hills', 'peaks', 'trees', 'towns'];
const g = (d) => `<svg viewBox="0 0 34 22" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true">${d}</svg>`;
const TABS = [
  { label: 'Sea', sub: 'figures in the water', ids: ['density', 'monsters', 'ships', 'placement'],
    glyph: g('<path d="M3 14q3-3 6 0t6 0 6 0 6 0 6 0M3 18q3-3 6 0t6 0 6 0"/><path d="M12 11q2-7 9-6-3 2-2 6Z" fill="currentColor" fill-opacity=".4"/>') },
  { label: 'Land', sub: 'coast, relief, towns', ids: LAND_GROUP,
    glyph: g('<path d="M2 18l7-9 5 5 6-9 12 13Z" fill="currentColor" fill-opacity=".25"/><path d="M14 18v-4h3v4"/>') },
  { label: 'Margins', sub: 'roses, lines, frame', ids: ['cartouche', 'scale', 'roses', 'overlap', 'rhumb', 'names', 'projection', 'colours'],
    glyph: g('<rect x="2" y="2" width="30" height="18"/><rect x="5" y="5" width="24" height="12" stroke-width=".6"/><circle cx="25" cy="9" r="3"/><path d="M25 4v10M20 9h10"/>') },
];
const CTLS = new Map([...document.querySelectorAll('#drawer .ctl')].map((el) => [el.dataset.ctl, el]));
const LEADS = new Map([...document.querySelectorAll('#drawer [data-lead-for]')].map((el) => [el.dataset.leadFor, el]));

// Moods: five whole looks at a click, sparse to dense, and every control in the tabs below. A mood sets the
// density, the placement, the figures and every style of the land, the water and the colours, each at its default
// where the mood does not depart from it, so a mood replaces the whole look another left. Figures are named as the
// hash names them (v:merman). All the things: every figure of every kind (the cartouche as chosen), the density at
// the top, a new seed.
const FIGURES = SPRITES.filter((s) => FIGURE_KINDS.includes(s.kind)).map((s) => s.key);
const MOOD_STYLES = ['land', 'islands', 'seaTint', 'rivers', 'lakes', 'reefs', 'playas', 'peaks', 'mountains', 'trees', 'ink', 'parchment'];
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
  strip.className = m.all ? 'sample crammed' : 'sample';
  // All the things: one small picture of every figure there is, edge to edge
  if (m.all) for (const k of m.keys) strip.append(...sampleOf(BY_KEY.get(k)).children);
  // a figure of each kind it shows, the first of its own; for All the things one from outside the default set
  for (const kind of m.all ? [] : m.kinds) {
    const of = m.keys.map((k) => BY_KEY.get(k)).filter((s) => s.kind === kind), pick = (m.all ? of.filter((s) => !DEFAULT_SET.has(s.key)) : []).concat(of)[0];
    if (pick) strip.append(...sampleOf(pick).children);
  }
  const b = chipButton('radio', strip, Object.assign(document.createElement('b'), { textContent: m.label }), Object.assign(document.createElement('small'), { textContent: m.note }));
  b.classList.add('preset'); if (m.all) b.classList.add('all'); b.title = `${m.label}: ${m.note}`;
  b.addEventListener('click', () => {
    const { selection: next, ...look } = m.set();
    style = { ...style, ...look };
    selection = next;
    showPlacement(); changed();
  });
  moods.append(b);
}
showMoods = () => { MOODS.forEach((m, i) => moods.children[i].setAttribute('aria-checked', String(m.is()))); };
let tab = 0;
function buildDrawer() {
  const box = $('layoutGroups'), tabs = document.createElement('div');
  tabs.className = 'tabs'; tabs.setAttribute('role', 'tablist');
  const panes = TABS.map((t, i) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', id: `tab-${i}` });
    b.setAttribute('role', 'tab');
    b.insertAdjacentHTML('beforeend', t.glyph);
    b.append(Object.assign(document.createElement('span'), { textContent: t.label }), Object.assign(document.createElement('small'), { textContent: t.sub }));
    tabs.append(b);
    const pane = document.createElement('section');
    pane.setAttribute('role', 'tabpanel'); pane.setAttribute('aria-labelledby', b.id);
    for (const id of t.ids) pane.append(...[LEADS.get(id), CTLS.get(id)].filter(Boolean));
    return pane;
  });
  const show = (n) => {
    tab = n;
    [...tabs.children].forEach((b, i) => { b.setAttribute('aria-selected', String(i === n)); b.tabIndex = i === n ? 0 : -1; });
    panes.forEach((p, i) => { p.hidden = i !== n; });
  };
  [...tabs.children].forEach((b, i) => b.addEventListener('click', () => show(i)));
  const heading = Object.assign(document.createElement('h2'), { id: 'h-mood', textContent: 'Mood' });
  box.append(heading, Object.assign(document.createElement('p'), { className: 'lead', textContent: 'None lit is Default. A mood sets the whole look; every control below still moves.' }), moods, tabs, ...panes);
  for (const s of document.querySelectorAll('#drawer section.home')) s.hidden = true;
  box.hidden = false;
  show(tab);
}
showMoods(); buildDrawer();

// ---------------------------------------------------------------- moving

let frame = 0, settle = 0;
function moved(next, flying = false) {
  if (next.zoom === view.zoom && next.lon === view.lon && next.lat === view.lat && (next.bearing ?? 0) === (view.bearing ?? 0)) return; // e.g. wheel at a zoom bound
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
  const anchored = !flightTo || Math.abs(Math.log2(viewProjection(view).k / ground.anchored.k)) <= fly.hold;
  if (anchored) drawAnchored(ctx, ground.anchored, ground.bg, view);
  drawPictures(ctx);
  drawCards(true);
  placeSheetChips();
  showCompass();
  drawLayer(ctx, viewProjection(view), view.zoom, anchored);
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

// A sheet (a chart's scan laid whole over the map) is moved by hand: held anywhere on it, it is dragged (the top one where
// they overlap), and where it is let go lands in the link (sheet=). Held by any of its four corners, the world turns and
// every sheet with it, about the middle of the window, and settles at the nearest of the chart's quarter turns (docs/spec/
// design.md, "the user moves the sheet"). Nothing is drawn at the corners.
const CORNER = 12; // how near a corner a press takes it, canvas px, a touch's slop beyond
const TURN_CURSOR = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M5 14a7 7 0 1 1 3.5 6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M5 14a7 7 0 1 1 3.5 6M2 11l3 3 3-3" fill="none" stroke="#1d1913" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>')}") 12 12, alias`;
const offBy = (a, b) => Math.abs(((a - b + 540) % 360) - 180); // degrees between two angles, either way round
const sheetsShown = () => (ground?.overlays ?? []).filter((o) => o.mode === 'sheet' && o.sheet); // bottom to top
const sheetGeometry = (o) => { const proj = viewProjection(view), corners = o && sheetCorners(o, proj, o.sheet); return corners ? { o, proj, corners } : null; };
function sheetHit([x, y]) {
  // a corner wins first, the top sheet's before a lower one's; then the top sheet under the point
  const geos = sheetsShown().reverse().map(sheetGeometry).filter(Boolean);
  const near = (c) => Math.hypot(c[0] - x, c[1] - y) <= CORNER + cssPx(6);
  const corner = geos.find((g) => g.corners.some(near));
  if (corner) return { kind: 'turn', ...corner };
  const geo = geos.find((g) => onSheet(g.o, g.proj, g.o.sheet, x, y));
  return geo ? { kind: 'move', ...geo } : null;
}
// The placements by id with `o`'s set to `sheet`; the chart's own placement is the default, left out of the link.
const withSheet = (o, sheet) => {
  const { [o.id]: _, ...rest } = style.sheets;
  return sheet && !sameSheet(sheet, ownSheet(o.id)) ? { ...rest, [o.id]: sheet } : rest;
};
// The bearing that stands the scan as drawn on the window (its `up`, de la Cosa's west up), else level; a quarter turn
// from it reads the chart on another of its sides.
const drawnBearing = (o) => (((o.sheet.turn - (o.up ?? 0)) % 360) + 360) % 360;
const nearestQuarter = (o, b) => { const q = drawnBearing(o); return q + 90 * Math.round((b - q) / 90); };
const angleOnWindow = ([x, y]) => (Math.atan2(y - H / 2, x - W / 2) * 180) / Math.PI;
let sheetTap = null; // where a press on the sheet began, until it moves far enough to be a drag: a tap there opens a note
let held = null; // { kind, o, proj, start, sheet (as taken), centre, bearing } while the sheet is held
let sheetFrameId = 0;
function holdSheet(hit, p) {
  held = { ...hit, start: p, sheet: { ...hit.o.sheet }, centre: hit.proj.project(hit.o.sheet.lon, hit.o.sheet.lat), bearing: view.bearing ?? 0 };
  hideTile();
}
function dragSheet(p) {
  const { kind, proj, start, sheet, centre, o } = held;
  if (kind === 'turn') { // swept clockwise, the world turns clockwise, as the compass turns it
    const d = ((angleOnWindow(p) - angleOnWindow(start) + 540) % 360) - 180;
    moved(clampView({ ...view, bearing: held.bearing - d }));
    return;
  }
  const [lon, lat] = proj.invert(centre[0] + p[0] - start[0], centre[1] + p[1] - start[1]);
  o.sheet = { ...sheet, lon, lat: Math.max(-85, Math.min(85, lat)) };
  if (!sheetFrameId) sheetFrameId = requestAnimationFrame(() => { sheetFrameId = 0; paintFrame('the sheet held'); });
}
function dropSheet() {
  const { o, kind } = held;
  held = null;
  cancelAnimationFrame(sheetFrameId); sheetFrameId = 0;
  if (kind === 'turn') { turnWorld(nearestQuarter(o, view.bearing ?? 0)); return; }
  style = { ...style, sheets: withSheet(o, o.sheet) };
  writeHash(); render();
}
// The snap chips live in the Charts drawer, in the row of the chart they belong to, under its city and year after a
// "Chart position:" line (docs/spec/design.md, "A chart's position chips, and the line each was fitted to"). They follow
// the top sheet laid (the one in view first), lit where that sheet lies now, from the moment it is laid, before it is
// drawn; with no sheet laid the line is hidden.
const sheetChips = $('sheetChips');
const posBox = Object.assign(document.createElement('div'), { className: 'pos', hidden: true });
posBox.append(Object.assign(document.createElement('b'), { textContent: 'Chart position:' }), sheetChips);
function placeSheetChips() {
  const laid = held ? [] : laidSheets().reverse(), proj = viewProjection(view);
  const o = laid.find((v) => sheetCorners(v, proj, v.sheet)) ?? laid[0];
  if (o && o.id !== sheetChips.dataset.id) buildSheetChips(o);
  const li = o && $('chartList').querySelector(`li[data-overlay="${o.id}"]`);
  if (!li) { posBox.hidden = true; return; }
  const where = li.querySelector('.about .where');
  if (posBox.previousElementSibling !== where) where.after(posBox);
  posBox.hidden = false; sheetChips.hidden = false;
  showUp(o);
  const keep = sheetChips.querySelector('[data-notes=keep]');
  keep?.setAttribute('aria-pressed', String(notesKept.has(o.id)));
  for (const b of sheetChips.querySelectorAll('[role=radio]')) b.setAttribute('aria-checked', String(sameSheet(o.sheet, b.dataset.snap == null ? ownSheet(o.id) : o.snaps[b.dataset.snap])));
}
function buildSheetChips(o) {
  sheetChips.dataset.id = o.id;
  const own = o.parallels ? ['Parallels', null, 'the chart\'s own placement: its drawn equator and tropic laid on today\'s'] : ['Level', null, 'the chart\'s own placement: level, centred between its coasts'];
  const where = Object.assign(document.createElement('span'), { className: 'where' });
  where.setAttribute('role', 'radiogroup'); where.setAttribute('aria-label', 'Where the sheet lies');
  where.replaceChildren(...[own, ...o.snaps.map((sn, i) => [sn.label, i, `the scan at its ${sn.label} fit`])].map(([label, i, note]) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'chip', textContent: label, title: note });
    b.setAttribute('role', 'radio'); b.dataset.label = label; if (i != null) b.dataset.snap = i;
    return b;
  }));
  sheetChips.replaceChildren(where, ...turnChips(o), ...notesChips(o));
  showUp(o);
}
// Beside them, the walk-around chips, a quarter turn of the world and every sheet each way round about the middle of
// the window; and, for a chart drawn to be read another way up (overlays.json `up`, de la Cosa's west up), its up chip,
// lit while the world stands at that up however it got there, which turns the world to it and back to north up
// (docs/spec/design.md, "Every chart turns, a quarter at a time").
const WALK_GLYPH = (cw) => `<svg viewBox="0 0 28 18" aria-hidden="true"><rect x="11.5" y="6.5" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="${cw ? 'M9.4 13.6A6.5 6.5 0 1 1 18.6 13.6M21.4 13.6H18.6V10.8' : 'M18.6 13.6A6.5 6.5 0 1 0 9.4 13.6M6.6 13.6H9.4V10.8'}" fill="none" stroke="#8c2f1e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const UP_GLYPH = '<svg viewBox="0 0 28 18" aria-hidden="true"><rect x="9" y="3" width="10" height="14" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M14 13V1.2M10.8 4.4 14 1.2l3.2 3.2" fill="none" stroke="#8c2f1e" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const COMPASS_WORDS = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];
const upWord = (o) => `${COMPASS_WORDS[Math.round(drawnBearing(o) / 45) % 8]} up`;
// Whether the world stands at this chart's up (its chip lit): lifting the sheet then turns it back to north up.
const atUp = (o) => o?.up != null && offBy(view.bearing ?? 0, drawnBearing(o)) < 0.5;
function turnChips(o) {
  const chip = (glyph, text, title) => {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'chip', title });
    b.innerHTML = `${glyph}${text}`;
    if (!text) b.setAttribute('aria-label', title);
    return b;
  };
  const left = chip(WALK_GLYPH(false), '', 'Walk round the chart: the world and the sheet a quarter turn anticlockwise');
  const right = chip(WALK_GLYPH(true), '', 'Walk round the chart: the world and the sheet a quarter turn clockwise');
  left.dataset.walk = '-1'; right.dataset.walk = '1';
  if (o.up == null) return [left, right];
  const up = chip(UP_GLYPH, upWord(o), 'Turn the world under the sheet so the chart reads as it was drawn; again for north up');
  up.dataset.up = ''; up.setAttribute('aria-pressed', 'false');
  return [left, right, up];
}
function showUp(o) {
  const b = sheetChips.querySelector('[data-up]');
  if (!b) return;
  b.setAttribute('aria-pressed', String(atUp(o)));
  if (b.lastChild.textContent !== upWord(o)) b.lastChild.textContent = upWord(o);
}
// Beside them, for a chart with points of interest marked on it: "Points of interest" with their count in a red dot, which
// keeps their marks shown until clicked again (off after the pulse, and never on by default), and the compass of Go, which
// plays the pulse again (docs/spec/design.md, "the user asks for the notes back"). The chart's own note is its row's caption.
const NOTE_GLYPH = '<svg viewBox="0 0 28 18" aria-hidden="true"><circle cx="14" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="14" cy="9" r="2" fill="currentColor"/></svg>';
// The replay chip's compass is cloned from the bar, its gradient ids renamed so the clone stands alone.
const barIcon = (id, tag) => $(id).querySelector('svg').outerHTML.replace(/(brass\w+|hdChart|hcChart)/g, `$1${tag}`).replace('aria-hidden="true"', 'aria-hidden="true" class="icon"');
const PULSE_GLYPH = () => barIcon('go', 'Replay');
function notesChips(o) {
  const n = noteCount(o.id);
  if (!n) return [];
  const keep = Object.assign(document.createElement('button'), { type: 'button', className: 'chip', title: `Show the chart's ${n} points of interest, and keep their marks until clicked again` });
  keep.innerHTML = `${NOTE_GLYPH}Points of interest<span class="count" aria-label="${n}">${n}</span>`; keep.dataset.notes = 'keep'; keep.setAttribute('aria-pressed', String(notesKept.has(o.id)));
  const again = Object.assign(document.createElement('button'), { type: 'button', className: 'chip', title: 'Play the rings round the points of interest again' });
  again.innerHTML = PULSE_GLYPH(); again.dataset.notes = 'again'; again.setAttribute('aria-label', 'Play the rings round the points of interest again');
  return [keep, again];
}
sheetChips.addEventListener('click', (e) => {
  const b = e.target.closest('.chip'), id = sheetChips.dataset.id, o = sheetsShown().find((v) => v.id === id) ?? laidSheets().find((v) => v.id === id);
  if (!b || !o) return;
  if (b.dataset.walk) { turnWorld(nearestQuarter(o, (turningTo ?? view.bearing ?? 0) - 90 * Number(b.dataset.walk))); return; } // to the chart's next quarter turn; clockwise lowers the bearing, as the compass turns it
  if (b.dataset.up != null) { // as drawn, the sheet framed as it will stand; again, north up where the map is
    if (atUp(o)) turnWorld(0);
    else turnWorld(drawnBearing(o), sheetView(o, o.sheet, { w: W, h: H, bearing: drawnBearing(o) }));
    return;
  }
  if (b.dataset.notes) {
    const on = b.dataset.notes === 'again' || !notesKept.has(o.id);
    if (b.dataset.notes === 'keep') { if (on) notesKept.add(o.id); else notesKept.delete(o.id); b.setAttribute('aria-pressed', String(on)); }
    if (on) startPulse([o.id]); else repaintLayer();
    return;
  }
  // a placement: the sheet laid there and framed as the chart's name frames it, and the line it was fitted to drawn
  // over it once the map lands, from the start again on every click (docs/spec/design.md, "A chip shows what it was fitted to")
  const sn = b.dataset.snap == null ? null : o.snaps[b.dataset.snap], at = sn ? { lon: sn.lon, lat: sn.lat, scale: sn.scale, turn: sn.turn } : ownSheet(o.id) ?? o.sheet;
  const line = sn ? sn.line : OVERLAYS.find((v) => v.id === o.id)?.sheetLine;
  if (line?.length) fitLines.set(o.id, { line, sheet: at, t0: null }); else fitLines.delete(o.id);
  o.sheet = at; // the flight's frames show it there at once; the landing places it from the link
  style = { ...style, sheets: withSheet(o, at) };
  writeHash();
  goTo({ ...sheetView(o, at, { w: W, h: H, bearing: view.bearing }), title: CHARTS.find((c) => c.overlay === o.id)?.name });
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
  if (!pointers.size) { const p = toCanvas(e.clientX, e.clientY); const pic = pictureHit(p)?.kind; canvas.style.cursor = cardAt(p) ? 'grab' : pic ? ({ move: 'grab', look: 'zoom-in', flip: 'pointer', link: 'pointer', away: 'pointer' }[pic] ?? '') : markAt(p) ? 'pointer' : { move: 'grab', turn: TURN_CURSOR }[sheetHit(p)?.kind] ?? ''; return; } // a picture over the marks under it, as a press finds it
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
// voyages' events (scripts/scene.mjs voyageMarks) and the clouds by doubted legs (doubtMarks); the tile takes any { title, confidence, date, doubt, text, source }.
// Under the heading, how sure the record is as its fixed phrase (CONFIDENCE_PHRASES), then any doubt under its own heading.
// It shuts on the next touch of the map, on Esc, on its own close button, or when the map moves.
const TAP_SLOP = 8, TAP_REACH = 22; // CSS px, so a finger is as forgiving on a phone's small canvas as a mouse on a wide one: a touch that stays within the slop is a tap; a mark takes a tap within the reach
const cssPx = (n) => n * (W / canvas.getBoundingClientRect().width); // CSS px to the canvas px the view moves in
const tileEl = $('tile');
function hideTile() { tileEl.hidden = true; }
function fillTile(t, back = null) { // back: { label, go } for a story opened from a group's list
  const part = (cls, text) => { if (!text) return null; const p = document.createElement('p'); p.className = cls; p.textContent = text; return p; };
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'tile-close'; close.setAttribute('aria-label', 'Close'); close.textContent = '×';
  close.addEventListener('click', hideTile);
  const head = part('tile-title', t.title);
  const meta = part('tile-date', [t.date, t.alternative ? 'another account' : null].filter(Boolean).join(' · '));
  const text = part('tile-text', t.text);
  const about = part('tile-text tile-about', t.about); // a note of ours under the text: who a ruler was, what a place is now
  const sure = part('tile-sure', CONFIDENCE_PHRASES[t.confidence]); // how sure: "on record", "a guess"
  const doubt = part('tile-text tile-doubt', t.doubt); // a doubted leg or event: who doubts it and why, after how sure
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
  tileEl.replaceChildren(close, ...[head, sure, doubt, meta, text, about, source, more, pics].filter(Boolean));
  tileEl.setAttribute('aria-label', t.title ?? 'Point of interest');
  if (back) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'tile-back', textContent: `‹ ${back.label}` });
    b.addEventListener('click', back.go);
    close.after(b);
    b.focus();
  }
}
// One tap, every story (docs/spec/design.md, "Points of interest close together"): a group's tile, headed by the count and
// the span of their dates, a line for each story (its mark's glyph, its title, its date) in order of date; a line opens that
// story's tile in the same place, with a way back to the list.
const dateKey = (d) => { const r = readDate(d)[0]; return r ? r.y * 12 + (r.m ?? 0) : Infinity; };
function fillGroup(marks) {
  const close = Object.assign(document.createElement('button'), { type: 'button', className: 'tile-close', textContent: '×' });
  close.setAttribute('aria-label', 'Close'); close.addEventListener('click', hideTile);
  const span = dateSpan(marks.map((m) => m.tile.date).filter(Boolean)), label = `${marks.length} here`;
  const head = Object.assign(document.createElement('p'), { className: 'tile-title', textContent: span ? `${label} · ${span}` : label });
  const list = Object.assign(document.createElement('ul'), { className: 'tile-list' });
  const dpr = devicePixelRatio || 1;
  for (const m of [...marks].sort((a, b) => dateKey(a.tile.date) - dateKey(b.tile.date))) {
    const b = Object.assign(document.createElement('button'), { type: 'button' });
    const glyph = Object.assign(document.createElement('canvas'), { width: 22 * dpr, height: 22 * dpr });
    const g = glyph.getContext('2d'); g.scale(dpr, dpr); drawMarkGlyph(g, m, 11, 11);
    const words = document.createElement('span');
    words.append(Object.assign(document.createElement('span'), { className: 'title', textContent: m.tile.title ?? 'Point of interest' }));
    if (m.tile.date) words.append(Object.assign(document.createElement('small'), { textContent: m.tile.date }));
    b.append(glyph, words);
    b.addEventListener('click', () => fillTile(m.tile, { label, go: () => { fillGroup(marks); tileEl.querySelector('.tile-list button')?.focus(); } }));
    const li = document.createElement('li'); li.append(b); list.append(li);
  }
  tileEl.replaceChildren(close, head, list);
  tileEl.setAttribute('aria-label', head.textContent);
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
// The lettered regions that carry a tile (a period's names in the combination lettering): the whole of the lettering, the name
// and the reading under it, is the hit area. The tile reads the same for every click inside it.
function regionMarks(proj, rect) {
  return (ground?.anchored?.late.worldNames ?? []).filter(({ o }) => o.tile).flatMap(({ o, at: ll }) => {
    if (proj.visible && !proj.visible(ll[0], ll[1])) return [];
    const [x, y] = proj.toPx(ll), { hw, hh } = o.box;
    if (x < rect.x0 || x > rect.x1 || y < rect.y0 || y > rect.y1) return [];
    const hit = [[x - hw, y - hh], [x + hw, y - hh], [x + hw, y + hh], [x - hw, y + hh]];
    return [{ x, y, h: 2 * hh, hit, area: 4 * hw * hh, up: 0, tile: o.tile }];
  });
}
// `group`: the marks within a tap's reach of each other (groupMarks) that the one found is among, when it is a drawn mark
const FULL = { x0: 0, y0: 0, x1: W, y1: H };
function markAt(at) { return pickAt(at).best; }
function pickAt(at) {
  const proj = viewProjection(placed), reach = cssPx(TAP_REACH), points = pointMarks(proj, placed.zoom);
  const doubts = (ground?.voyages ?? []).filter((v) => !(v.reveal < 1)).flatMap((v) => doubtMarks(v, proj, FULL));
  const best = pickMark([...regionMarks(proj, FULL), ...points, ...doubts, ...peakHits(ground?.peaks ?? [], proj, FULL), ...laidNotes(proj, FULL)], at, reach);
  return { best, group: best && points.includes(best) ? groupMarks(points, reach).find((g) => g.marks.includes(best)) : null };
}
// The drawn marks a tap finds, which group and take a badge: the shown voyages' events, and the sights at POI_ZOOM and in
const pointMarks = (proj, zoom) => [...(ground?.voyages ?? []).filter((v) => !(v.reveal < 1)).flatMap((v) => voyageMarks(v.voyage, proj, FULL)),
  ...(zoom >= POI_ZOOM ? sightsHit(proj, FULL) : [])];
// Each listed place's mark to hit where the scene drew it (scene.mjs sightHits), in `proj`'s px
const sightsHit = (proj, rect) => sightHits(sightTiles(), ground?.marks ?? [], proj, rect);
// The laid charts' notes: each sheet's, less those an upper sheet covers, since only the top sheet's figure shows there
const notesOf = (o, i, all, proj, rect = FULL) => noteMarks(o, proj, rect)
  .filter((m) => !all.slice(i + 1).some((u) => u.mode === 'sheet' && u.sheet && onSheet(u, proj, u.sheet, m.x, m.y)));
const laidNotes = (proj, rect) => (ground?.overlays ?? []).flatMap((o, i, all) => notesOf(o, i, all, proj, rect));
function showTileAt(at) {
  const { best, group } = pickAt(at);
  if (!best) return;
  tileShown = best.tile;
  const many = group?.marks.length > 1 ? group.marks : null; // a group of one is the mark's own tile
  if (!many && best.tile.sight) { // the sight becomes the subject: its pictures onto the table, and into the tile once their records are read
    chooseSight(best.tile.sight, DEFAULTS.pictures, best.tile.site ?? null, best.tile);
    if (!sightData) loadSights().then(() => { if (tileShown === best.tile && !tileEl.hidden) showTileAt(at); }, () => {});
  }
  if (many) fillGroup(many); else fillTile(best.tile);
  // beside the hit area of the mark, or of every mark of its group (what a tap on it would hit, markClear) and a margin clear
  // of it: to its right, flipped to its left, below or above where the window has no room (tileSpot), in client px
  const r = canvas.getBoundingClientRect(), kx = r.width / W, ky = r.height / H;
  const cs = (many ?? [best]).map((m) => markClear(m, cssPx(TAP_REACH))), near = best.hit ? at : [best.x, best.y];
  const c = { x0: Math.min(...cs.map((b) => b.x0)), y0: Math.min(...cs.map((b) => b.y0)), x1: Math.max(...cs.map((b) => b.x1)), y1: Math.max(...cs.map((b) => b.y1)) };
  tileEl.hidden = false;
  const spot = tileSpot({ x0: r.left + c.x0 * kx, y0: r.top + c.y0 * ky, x1: r.left + c.x1 * kx, y1: r.top + c.y1 * ky },
    [tileEl.offsetWidth, tileEl.offsetHeight], { w: innerWidth, h: innerHeight }, [r.left + near[0] * kx, r.top + near[1] * ky]);
  tileEl.style.left = `${spot.left}px`; tileEl.style.top = `${spot.top}px`;
}
addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTile(); });

// ---------------------------------------------------------------- over the map: the badges and the notes' marks
// Drawn by the page over each placed scene and each moving frame, never part of the scene: the count badge on a group of
// drawn marks within a tap's reach of each other (gone once the zoom parts them), and a laid chart's notes' marks while
// they announce themselves (the pulse, rings alone, docs/spec/design.md, "A chart's notes get their moment") or while
// their Notes chip keeps them. A chart announces its notes when its sheet arrives by its name or icon (or fading in), never by
// its eye, and again from its row's chips; afterwards nothing stays drawn on the scan, though a tap still finds every note.
const notesKept = new Set(); // the charts whose marks their Notes chip keeps shown; off by default, and not in the link
const seen = new Set(); // the charts shown that have announced their notes since they were shown
let pulse = null, pulseFrame = 0; // { ids, t0 } while the notes of the charts `ids` announce themselves
let layerBase = null, layerPlaced = null; // the canvas as last placed, before this layer, and the view placed then
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function drawLayer(g, proj, zoom, badges = true, now = performance.now()) {
  const p = pulse && notePulse(now - pulse.t0, reducedMotion());
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  drawFitLines(g, proj, now);
  (ground?.overlays ?? []).forEach((o, i, all) => {
    const kept = notesKept.has(o.id), on = !!p && pulse.ids.has(o.id);
    if (!kept && !on) return;
    for (const m of notesOf(o, i, all, proj)) {
      if (on) drawNoteRing(g, m, p.ring, p.alpha); // the pulse is rings alone: no mark sits on the art
      if (kept) drawNoteMark(g, m);
    }
  });
  if (badges) for (const { marks, lead } of groupMarks(pointMarks(proj, zoom), cssPx(TAP_REACH))) if (marks.length > 1) drawBadge(g, lead, marks.length);
  g.restore();
}
// The line each sheet's placement was fitted to, set by its chip (the sheet's chip click, above): drawn while that sheet is
// shown and lies at that placement, fading with the sheet; it starts drawing itself once the map has landed (placeLayer).
// Hidden by its eye, the sheet takes its line off with it.
const fitLines = new Map(); // id -> { line, sheet (the placement), t0 (when it began drawing; null until the map lands) }
let fitFrame = 0;
function drawFitLines(g, proj, now) {
  const shown = new Map((ground?.overlays ?? []).filter((o) => o.mode === 'sheet' && o.sheet).map((o) => [o.id, o]));
  for (const [id, f] of fitLines) {
    const o = shown.get(id);
    if (!o) { if (ground && !style.overlays.includes(id)) fitLines.delete(id); continue; }
    if (f.t0 == null || !sameSheet(o.sheet, f.sheet)) continue;
    const { drawn, alpha } = fitLineAt(now - f.t0, reducedMotion());
    drawFitLine(g, f.line, proj, { drawn, alpha: alpha * (o.alpha ?? 1), scale: cssPx(1) });
  }
}
function startFitLines() {
  const now = performance.now();
  for (const f of fitLines.values()) f.t0 ??= now;
  if (!fitFrame && [...fitLines.values()].some((f) => fitLineMoving(now - f.t0, reducedMotion()))) fitFrame = requestAnimationFrame(fitStep);
}
function fitStep(now) {
  fitFrame = 0;
  if (voyagePen?.t0 == null && !pulseFrame) repaintLayer(now); // a pen or the notes' pulse paints every frame, this layer with it
  if ([...fitLines.values()].some((f) => f.t0 != null && fitLineMoving(now - f.t0, reducedMotion()))) fitFrame = requestAnimationFrame(fitStep);
}
// A scene just placed: kept without the layer, then the layer over it; a chart shown since the last placement announces its notes
function placeLayer() {
  if (!ground || !placed) return;
  const shown = new Set(ground.overlays.filter((o) => noteCount(o.id)).map((o) => o.id));
  for (const id of seen) if (!shown.has(id)) seen.delete(id);
  const fresh = [...shown].filter((id) => !seen.has(id));
  fresh.forEach((id) => seen.add(id));
  layerBase ??= Object.assign(document.createElement('canvas'), { width: W, height: H });
  const b = layerBase.getContext('2d'); b.clearRect(0, 0, W, H); b.drawImage(canvas, 0, 0);
  layerPlaced = placed;
  if (fresh.length) startPulse(fresh); else drawLayer(ctx, viewProjection(placed), placed.zoom);
  startFitLines();
}
function startPulse(ids) { // charts announcing while another's rings still play join them, all from the start, none cut off
  const now = performance.now(), live = pulse && notePulse(now - pulse.t0, reducedMotion()) ? pulse.ids : [];
  pulse = { ids: new Set([...live, ...ids]), t0: now };
  if (!pulseFrame) pulseFrame = requestAnimationFrame(pulseStep);
}
function pulseStep(now) {
  pulseFrame = 0;
  if (pulse && !notePulse(now - pulse.t0, reducedMotion())) pulse = null; // over: one last frame without it
  if (voyagePen?.t0 == null) repaintLayer(now); // a pen paints every frame, this layer with it
  if (pulse) pulseFrame = requestAnimationFrame(pulseStep);
}
// The layer drawn again: over the scene as placed, or, while the map or a sheet moves, in a moving frame
function repaintLayer(now = performance.now()) {
  if (!ground) return;
  if (view !== placed || held || holding || layerPlaced !== placed || !layerBase) { paintFrame('the notes'); return; }
  ctx.clearRect(0, 0, W, H); ctx.drawImage(layerBase, 0, 0);
  drawLayer(ctx, viewProjection(placed), placed.zoom, true, now);
}

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
  ['Catalan Atlas', '1375', both([ORIGINS.rose.lon, ORIGINS.rose.lat, 16], [-5.4, 42.3, 16]), ['Majorca', port(2.65, 39.57)], null, 'catalan-atlas'], // Cresques Abraham's workshop, Palma; its eight map pages side by side
  ['Catalan Atlas, Mediterranean, a copy of 1959', '1375, copied 1959', viewOfFrame({ lonMin: -24, lonMax: 42.8, latMin: 22.2, latMax: 55.6 }), ['Majorca', port(2.65, 39.57)], null, 'catalan-atlas-1959-copy'], // a painted copy (Library of Congress, CC BY 3.0), not the original; its view is its own sheet's frame (sheetFrame of its placement), Gibraltar to Cyprus
  ['Chart of Jorge de Aguiar', '1492', at(2.64, 31.29, 3.18), ['Lisbon', port(-9.14, 38.72)], null, 'aguiar'], // the Beinecke Library's chart; Lisbon, Portugal's chartmaking port, the usual attribution
  ['Map of Juan de la Cosa', '1500', both([-45, 23.4, 15], [65, 23.4, 15]), ['El Puerto de Santa María', port(-6.23, 36.60)], null, 'de-la-cosa'], // signed "la fizo en el puerto de S. Mª"
  ['Carta Marina', '1539', viewOfFrame({ lonMin: 0, lonMax: 40, latMin: 54, latMax: 72 }), ['Venice', port(12.33, 45.44)], null, 'carta-marina'], // Olaus Magnus had it printed there
  ['World map of Battista Agnese', 'c. 1544', at(-21.83, -6.47, 0.78), ['Venice', port(12.33, 45.44)], null, 'agnese-world'], // map 10 of his atlas, made in Venice (Library of Congress)
  ['Fernão Vaz Dourado, North Atlantic', '1580', at(-31.75, 55.58, 2.78), ['Goa', port(73.83, 15.50)], null, 'dourado-atlantic'], // chart 4 of his atlas, made at Goa (Bayerische Staatsbibliothek)
  ['Oliva family, Mediterranean', '1621–1665', at(16.73, 36.74, 3.7), ['Messina', port(15.55, 38.19)], null, 'oliva-mediterranean'], // a member of the Oliva family of chartmakers, Messina the usual attribution (Commons dates it between 1621 and 1665)
  ['Sebastião Lopes, Atlantic', 'c. 1565', at(-13.6, 36.76, 3.3), ['Lisbon', port(-9.14, 38.72)], null, 'lopes-atlantic'], // a chart of the Atlantic coasts, British Isles to the Gambia (Newberry Library)
  ['Bartolomé Olives, central and western Mediterranean', '1559', at(5.47, 40.35, 3.6), ['Venice', port(12.33, 45.44)], null, 'olives-1559'], // drawn south up, made at Venice (Bodleian Libraries, MS. Canon. Ital. 143)
  ['Banet Panades, Mediterranean', '1557', at(12.5, 40.5, 4.2), ['Messina', port(15.55, 38.19)], null, 'panades-1557'], // made at Messina (Galata Museo del Mare, Genoa), photographed by hand
  ['De Bry, Virginia', '1590', at(-76, 36.28, 7.47), ['Frankfurt', port(8.68, 50.11)]], // de Bry's America, part I, printed at Frankfurt am Main
].map(([name, year, v, [city, made], text, overlay = null]) => ({ name, year, view: { ...v, title: name }, made: { ...made, title: city }, text, overlay }));
const places = []; // every anchorage and point of interest: { name, view }

// The voyages: any number drawn at once, none by default. The Voyages drawer lists them as a vertical timeline, earliest
// at the top: data/voyages/index.json in the order the voyages set out (chronological; the file's order breaks ties),
// an era's heading before the first row in it, each row the voyage's short name and years
// (the title is its tooltip), an eye, a play button, then its ink, a swatch to pick another. A shown voyage has its summary and a link
// to its first source under its row. They load on the first open and stay cached. A click on the name shows that
// voyage alone (every other one is hidden), flies to frame the whole of it and draws its line on from start to end,
// every time, in the seconds the Drawn-in slider at the drawer's head sets. The eye only shows or hides that one voyage, at once: no
// flight, no pen, no other voyage touched. A voyage hidden keeps its place in the list, so its colour, and every other
// voyage's, stays put. A voyage shown takes the first colour no shown voyage has, the chart's red first (settleInks).
// The play button sails the voyage again on its own calendar (playVoyage, below), with a band at the map's foot.
// At the drawer's head, the line weight for them all and how long the pen takes; the skull clears them (clearMap). The
// choice rides in the link (`voyages=`, `voyagewidth=`, `voyagedraw=`) like any style.
let band = null; // the voyage the play button plays, { id, cal, ms, state: wait | run | paused | done, since, t0, at, title } (playVoyage)
const PLAY_GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
const PAUSE_GLYPH = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1"/><rect x="13.5" y="5.5" width="4" height="13" rx="1"/></svg>';
let voyageList = null, voyageRows = null; // the load, and once loaded [[id, voyage]] in order with the sources
const escapeHTML = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
// A voyage's row, in the Voyages drawer and in a chosen person's tile: with `name`, the name button (the short name and
// the years, the full title its tooltip) with its line sample, then the eye, the play button and the swatch (shown once
// the voyage has an ink), and its summary and where to read more, shown while it is on; without, the title and years as
// text, the eye and the play, and the summary always, as the person's notes for that voyage
function voyageItem(id, v, sources, { name = true, bar = '' } = {}) {
  const full = escapeHTML(v.title ?? id), brief = escapeHTML(v.short ?? v.title ?? id), when = escapeHTML(v.when), summary = escapeHTML(v.summary), link = voyageLink(v, sources);
  const more = link ? ` <a href="${escapeHTML(link.url)}" target="_blank" rel="noopener" title="${escapeHTML(link.label)}">Read more</a>` : '';
  const years = when && !/\d/.test(v.title ?? '') ? `<span class="when">${when}</span>` : '';
  return `<li data-row="${escapeHTML(id)}" data-title="${full}"><div class="vrow">` +
    (name ? `<button type="button" class="vname" data-voyage="${escapeHTML(id)}" title="${full}${when ? `, ${when}` : ''}">` +
      `<svg viewBox="0 0 28 18" aria-hidden="true"><path d="M2 9h24" fill="none" stroke-linecap="round"/></svg>` +
      `<span class="brief">${brief}${when ? `<span class="when">${when}</span>` : ''}</span></button>`
      : `<b class="vtitle">${full}</b>${years}`) +
    `<button type="button" class="eye" data-eye="${escapeHTML(id)}" aria-pressed="false" aria-label="Show ${full}" title="Show or hide ${full}">${EYE}</button>` +
    `<button type="button" class="play" data-play="${escapeHTML(id)}" aria-pressed="false" aria-label="Play ${full} on its own calendar" title="Play ${full} on its own calendar">${PLAY_GLYPH}</button>` +
    (name ? `<input type="color" data-ink="${escapeHTML(id)}" aria-label="Colour of ${full}" title="Colour of ${full}" hidden>` : '') + bar + '</div>' +
    (summary || more ? `<p class="vsum">${name ? `<b>${full}</b>. ` : ''}${summary}${more}</p>` : '') + '</li>';
}
// the ink of every voyage in the list, hidden ones too, so a colour stays with its voyage
// (a voyage with no colour picked takes one from the high-contrast palette while any of it crosses a sheet, or if a leg is dashed or dotted)
// the sheets laid as the style has them now (not as last drawn), each with the placement it lies at; none unless whole sheets
const laidSheets = () => (style.overlayMode !== 'sheet' ? [] : style.overlays.flatMap((id) => { const o = OVERLAYS.find((v) => v.id === id); return o ? [{ ...o, sheet: style.sheets[id] ?? o.sheet }] : []; }));
const brokenIds = new Set(); // the listed voyages with a dashed or dotted leg, which take a high-contrast ink
const brokenSeen = new Set(); // the voyages whose file has been read for that
// reads the files of voyages not yet seen, so a link's inks are right on the first render, with the drawer closed; read
// whole (readVoyage), so a leg shared with another voyage (`sameAs`) counts with its own confidence
const learnBroken = (ids) => Promise.all(ids.filter((id) => !brokenSeen.has(id)).map((id) => readVoyage(id, (path) => env.readJSON(path))
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
// settles the inks of the voyages listed (settleInks): `fresh` the ids just shown, which yield to those already shown;
// a settled ink rides in the link at once, so a link copied after a sheet is laid or panned onto reopens in the same colours
const settleVoyageInks = (fresh) => { const s = settleInks(style.voyages, crossing(), fresh); if (s !== style.voyages) { style = { ...style, voyages: s }; writeHash(); } };
const voyageInk = () => { settleVoyageInks(); return Object.fromEntries(style.voyages.map((v) => [v.id, v.colour ?? v.ink])); };
const isShown = (id) => style.voyages.some((v) => v.id === id && !v.hidden);
const isHidden = (id) => style.voyages.some((v) => v.id === id && v.hidden);
// the chosen person's voyages are drawn lit (the scene's `person`, people.mjs withPerson) unless an eye has hidden them
function litBy(id) { return Boolean(peopleData?.people.find((p) => p.id === style.person)?.voyages.includes(id)); }
const isDrawn = (id) => isShown(id) || (litBy(id) && !isHidden(id));
// Every voyage row, in the Voyages drawer and in the chosen person's tile, as the voyages stand: on or off, its ink,
// its eye, its play button (playing, paused) and its swatch
function showVoyage() {
  const ink = voyageInk();
  for (const row of document.querySelectorAll('#voyageList li[data-row], #personCard li[data-row]')) {
    const id = row.dataset.row, full = row.dataset.title, listed = id in ink, on = isDrawn(id);
    const b = row.querySelector('[data-voyage]'), line = row.querySelector('path'), pick = row.querySelector('[data-ink]'), eye = row.querySelector('[data-eye]'), play = row.querySelector('[data-play]');
    row.classList.toggle('on', on);
    if (b) b.dataset.shown = String(on);
    if (line) {
      line.setAttribute('stroke', litBy(id) && on ? PERSON_RED : listed ? ink[id] : 'currentColor');
      line.setAttribute('stroke-width', String(style.voyageWidth));
      line.setAttribute('stroke-dasharray', on ? '' : '2 3');
      line.setAttribute('opacity', on ? '1' : '0.45');
    }
    eye.setAttribute('aria-pressed', String(on));
    eye.setAttribute('aria-label', `${on ? 'Hide' : 'Show'} ${full}`);
    if (pick) { pick.hidden = !listed; if (listed) pick.value = ink[id]; }
    const playing = band?.id === id && (band.state === 'run' || band.state === 'wait');
    play.setAttribute('aria-pressed', String(playing));
    play.innerHTML = playing ? PAUSE_GLYPH : PLAY_GLYPH;
    play.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${full} on its own calendar`);
  }
  for (const f of toolRefreshers) f();
}
function fillVoyages() {
  voyageList ??= Promise.all([env.readJSON('data/voyages/index.json'), env.readJSON('data/voyages/sources.json').catch(() => ({}))])
    .then(([ids, sources]) => Promise.all(ids.map((id) => env.readJSON(`data/voyages/${id}.json`).then((v) => [id, v], () => [id, { title: id, short: id }])))
      .then((voyages) => [chronological(voyages), sources]))
    .then(([voyages, sources]) => Promise.all(voyages.map(([id]) => readVoyage(id, (path) => env.readJSON(path)).catch(() => null))).then((whole) => {
      // each voyage read whole, its shared legs (`sameAs`) resolved, for whether it is broken and where it runs
      for (const [i, [id]] of voyages.entries()) { brokenSeen.add(id); if (isBroken(whole[i])) brokenIds.add(id); }
      for (const [i, [id]] of voyages.entries()) voyageDots.set(id, (whole[i]?.legs ?? []).flatMap((leg) => (leg.points?.length > 1 ? legPath(leg) : [])).filter((_, k) => k % 4 === 0));
      voyageRows = { voyages, sources }; drawVoyages();
    }), (e) => { voyageList = null; $('voyageList').innerHTML = `<li>${escapeHTML(e.message)}</li>`; });
  showVoyage();
  return voyageList;
}
// the Voyages drawer's rows, earliest first, an era's heading before the first row in it; an undated voyage comes last
function drawVoyages() {
  if (!voyageRows) return;
  const { voyages, sources } = voyageRows;
  let era = null;
  $('voyageList').innerHTML = voyages.map(([id, v]) => {
    const ys = voyageYears(v.when), e = eraOf(ys[0]), head = e && e !== era ? eraItem(era = e) : '';
    return head + voyageItem(id, v, sources, { bar: spanBar(e, ys) });
  }).join('');
  showVoyage();
}
// Sets which voyages are shown: `show` maps an id to true or false; a voyage not yet listed is added at the end, so it
// takes the first free colour (added hidden when set to false: a chosen person's voyage put off by its eye). A hidden
// voyage keeps its place and its ink, which it takes back when shown again if no shown voyage has it meanwhile; the
// voyages already shown keep theirs.
function showVoyages(show, others) {
  const listed = style.voyages.map((v) => v.id), on = (v) => show[v.id] ?? (others ?? !v.hidden);
  const voyages = [...style.voyages, ...Object.keys(show).filter((id) => !listed.includes(id)).map((id) => ({ id, colour: null }))];
  const fresh = new Set(voyages.filter((v) => on(v) && (v.hidden || !listed.includes(v.id))).map((v) => v.id));
  style = { ...style, voyages: voyages.map((v) => { const { hidden, ...kept } = v; return on(v) ? kept : { ...kept, hidden: true }; }) };
  settleVoyageInks(fresh);
  showVoyage(); writeHash(); render();
}
// A click on a row's eye or play button, in either drawer: true when it was one. The eye puts that voyage on or off,
// whole and at once; the view stays, and no other voyage changes. Play pauses the voyage playing, goes on with it
// paused, or plays it from its start.
function voyageControl(e) {
  const eye = e.target.closest('[data-eye]'), play = e.target.closest('[data-play]');
  if (eye) {
    const id = eye.dataset.eye;
    if (band?.id === id) closeBand();
    if (voyagePen?.id === id) voyagePen = null; // a pen on it stops, and the line is whole
    // a chosen person's voyage hidden by its eye and turned back on: its hidden entry goes, rather than staying listed
    // as shown, so letting the person go takes it off the map with them
    if (litBy(id) && isHidden(id)) { style = { ...style, voyages: style.voyages.filter((v) => v.id !== id) }; showVoyage(); writeHash(); render(); }
    else showVoyages({ [id]: !isDrawn(id) });
    return true;
  }
  if (play) {
    const id = play.dataset.play;
    if (band?.id === id && band.state === 'paused') resumePlay();
    else if (band?.id === id && band.state !== 'done') pausePlay();
    else playVoyage(id);
    return true;
  }
  return false;
}
$('voyageList').addEventListener('click', async (e) => {
  if (voyageControl(e)) return;
  const b = e.target.closest('[data-voyage]');
  if (!b) return;
  const id = b.dataset.voyage; // that voyage alone, framed, and drawn on afresh
  closeBand();
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
  if (!v) return;
  if (voyagePen.band) { // a play: the line as far as the pen has come on the voyage's calendar (each branch of a migration on its own), and the events it has passed
    const b = voyagePen.band;
    Object.assign(v, playedOn(v.voyage, b.cal, playDay(b)));
  } else v.reveal = voyagePen.t0 == null ? 0 : Math.min(1, (performance.now() - voyagePen.t0) / voyagePen.ms);
}
// every exit of the pen puts the line back whole: a pen that stops early must not leave its voyage hidden
function finish(id) { const v = ground?.voyages?.find((x) => x.id === id); if (v && ('reveal' in v || 'played' in v)) { delete v.reveal; delete v.played; delete v.legReveal; render(); } }
function drawOn(id) {
  closeBand();
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
// The play button (docs/spec/design.md, "the play button sails the voyage on its own calendar"): the voyage shown if it
// was hidden (no other voyage hidden), the map flown to its frame unless the whole of it is in view, and its line drawn
// again from its start on its own calendar (calendarOf, scripts/voyages.mjs): the pen runs along a leg between its dates
// and sits still through every wait between legs, and the voyage's events appear as the pen reaches their dates. The
// whole voyage takes `voyageplay=` seconds (VOYAGE_PLAY, 9 by default), however long it was: Magellan's 1,083 days at
// about 120 days a second. The band at the map's foot (#voyageBand; the research in docs/voyage-play) shows the date the
// pen has reached, as precise as the leg's dates, and the leg it is on or the place it waits at; its button pauses and
// plays on, its square stops the play and closes the band, and its strip, the voyage's calendar with the legs, the
// waits dotted and the events ticked, scrubs to a day. At the end the line is whole with all its marks, and the band
// stays at the last day until it is closed or played again.
const playMs = (b, now = performance.now()) => (b.state === 'run' ? Math.min(b.ms, now - b.t0) : b.at);
const playDay = (b, now) => b.cal.t0 + ((b.cal.t1 - b.cal.t0) * playMs(b, now)) / b.ms;
function playVoyage(id) {
  return readVoyage(id, (path) => env.readJSON(path)).then((v) => {
    const cal = calendarOf(v);
    if (!cal || !(cal.t1 > cal.t0)) return;
    closeBand();
    band = { id, cal, ms: style.voyagePlay * 1000, state: 'wait', since: performance.now(), t0: 0, at: 0, title: v.title ?? id };
    voyagePen = { id, band };
    if (!isDrawn(id)) showVoyages({ [id]: true }); else render(); // the line cleared to its start
    fillBand(); showVoyage();
    const rect = playRect(), to = voyageInView(v, rect) ? null : voyageView(v, flightTo ?? view, undefined, true, rect);
    if (to) { if (style.sheetHides) clearSheetFor(to, true); goTo(to); }
    requestAnimationFrame(playStep);
  }, () => {});
}
// the map a play is framed in, in canvas px: the window, short of an open drawer's left edge on a wide screen, so the
// whole voyage sails in sight beside the drawer it was played from
function playRect() {
  const r = windowRect(), d = !phone.matches && openDrawer();
  if (!d) return r;
  const c = canvas.getBoundingClientRect(), x = ((d.getBoundingClientRect().left - c.left) * W) / c.width;
  return x > r.x0 + (r.x1 - r.x0) / 3 && x < r.x1 ? { ...r, x1: x } : r;
}
// whether the whole of a voyage's line is in `r` (the window), so the play needs no flight
function voyageInView(v, r = windowRect()) {
  const proj = viewProjection(flightTo ?? view), wrap = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
  return v.legs.every((leg) => (leg.points?.length > 1 ? legPath(leg) : []).every(([lon, lat]) => {
    if (proj.visible && !proj.visible(wrap(lon), lat)) return false;
    const [x, y] = proj.toPx([wrap(lon), lat]);
    return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
  }));
}
function playStep() {
  const b = band;
  if (!b || voyagePen?.band !== b || b.state === 'paused' || b.state === 'done') return; // stopped, paused or over: the loop ends
  const now = performance.now();
  if (b.state === 'wait') { // for the flight to land and the scene to be placed with this voyage in it
    if (flightTo == null && placed === view && ground?.voyages?.some((x) => x.id === b.id)) { b.state = 'run'; b.t0 = now - b.at; } // from the day a pause or a seek left it at, else the first
    else if (now - b.since > 10000) { closeBand(); return; }
    if (b.state === 'run' && reducedMotion()) return endPlay(); // reduced motion: the voyage whole at once, the band at its last day
  }
  if (b.state === 'run') {
    if (now - b.t0 >= b.ms) return endPlay();
    applyReveal(); paintFrame('playing');
  }
  showBand();
  requestAnimationFrame(playStep);
}
// the play over: the line whole with all its marks, the band at the last day with its button back to play
function endPlay() {
  band.at = band.ms; band.state = 'done';
  voyagePen = null; finish(band.id);
  showBand(); showVoyage();
}
function pausePlay() {
  if (band?.state !== 'run' && band?.state !== 'wait') return;
  band.waited = band.state === 'wait'; // paused before the flight landed: play again waits for it once more
  band.at = band.state === 'run' ? playMs(band) : 0; band.state = 'paused';
  showBand(); showVoyage();
}
function resumePlay() {
  if (band?.state === 'done') return playVoyage(band.id);
  if (band?.state !== 'paused') return;
  if (band.waited) { band.state = 'wait'; band.since = performance.now(); band.waited = false; }
  else { band.state = 'run'; band.t0 = performance.now() - band.at; }
  voyagePen = { id: band.id, band };
  showBand(); showVoyage();
  requestAnimationFrame(playStep);
}
// to a day on the strip, `f` of the way from the voyage's first day to its last; a play over is paused there
function seekPlay(f) {
  if (!band || band.state === 'wait') return;
  const at = Math.max(0, Math.min(1, f)) * band.ms;
  if (band.state === 'run') band.t0 = performance.now() - at;
  else {
    band.at = at;
    if (at >= band.ms) { if (band.state === 'paused') endPlay(); return; }
    if (band.state === 'done') { band.state = 'paused'; voyagePen = { id: band.id, band }; showVoyage(); }
  }
  applyReveal(); paintFrame('playing'); showBand();
}
function closeBand() {
  if (!band) return;
  const { id } = band;
  band = null;
  if (voyagePen?.band) { voyagePen = null; finish(id); }
  $('voyageBand').hidden = true;
  showVoyage();
}
// the band's strip for the voyage played: its legs, the waits between them dotted, its events ticked; twice, the copy in
// full ink cut at the pen's day
function fillBand() {
  const { cal } = band, span = cal.t1 - cal.t0, x = (d) => `${((100 * (d - cal.t0)) / span).toFixed(3)}%`, w = (a, b) => `${((100 * (b - a)) / span).toFixed(3)}%`;
  let reached = -Infinity; // a wait is a gap no leg is under way in: between legs in turn, or a migration's branches all landed
  const legs = cal.legs.map((l) => [l.a, l.b]).sort((p, q) => p[0] - q[0]).map(([a, b]) => {
    const wait = reached > -Infinity && a > reached ? `<span class="wait" style="left:${x(reached)};width:${w(reached, a)}"></span>` : '';
    reached = Math.max(reached, b);
    return `${wait}<span class="leg" style="left:${x(a)};width:${w(a, b)}"></span>`;
  }).join('');
  $('bandStrip').innerHTML = `<div class="ahead">${legs}</div><div class="sailed">${legs}</div>` + cal.events.map((d) => `<span class="tick" style="left:${x(d)}"></span>`).join('');
  $('bandStrip').style.setProperty('--c', voyageInk()[band.id] ?? '#8c2f1e');
  const ends = (p) => (isLong(cal) ? 'year' : p === 'day' ? 'month' : p); // a long calendar's ends as bare years, room left for its pace
  $('bandFrom').textContent = dayText(cal.t0, ends(cal.legs[0].precision));
  $('bandTo').textContent = dayText(cal.t1 - 1e-3, ends(cal.legs.at(-1).precision));
  $('bandPace').textContent = playPace(cal, style.voyagePlay); // a long calendar in years a second (scripts/voyages.mjs playPace)
  $('voyageBand').setAttribute('aria-label', `${band.title}, on its own calendar`);
  $('voyageBand').hidden = false;
  placeBand(); showBand();
}
// the band at the pen's day: the date, the stretch it is on or the place it waits at, the strip cut there and its thumb, and the button
function showBand() {
  if (!band) return;
  const { cal } = band, day = playDay(band), pen = penOn(cal, day), leg = cal.legs[pen.leg], f = (day - cal.t0) / (cal.t1 - cal.t0);
  const before = pen.waiting ? cal.legs[pen.before] : null;
  $('bandDate').textContent = playDateText(cal, Math.min(day, cal.t1 - 1e-3), before ? vaguer(before.precision, leg.precision) : leg.precision);
  $('bandLeg').textContent = band.state === 'done' ? `the end: ${leg.to}` : before ? `at ${before.to}, waiting` : `${pen.from} to ${pen.to}`;
  $('bandStrip').querySelector('.sailed').style.clipPath = `inset(0 ${(100 * (1 - f)).toFixed(3)}% 0 0)`;
  $('bandThumb').style.left = `${(100 * f).toFixed(3)}%`;
  const going = band.state === 'run' || band.state === 'wait', what = going ? 'Pause' : band.state === 'done' ? 'Play again' : 'Play on';
  $('bandPlay').innerHTML = going ? PAUSE_GLYPH : PLAY_GLYPH;
  $('bandPlay').setAttribute('aria-label', what); $('bandPlay').title = what;
}
// the band runs from the map's left edge; an open drawer over its foot ends it short of the drawer's left edge
function placeBand() {
  const el = $('voyageBand');
  if (el.hidden) return;
  el.style.maxWidth = '';
  const d = !phone.matches && openDrawer(), r = el.getBoundingClientRect(), dr = d && d.getBoundingClientRect();
  if (dr && dr.left > r.left && dr.left < r.right && dr.bottom > r.top) el.style.maxWidth = `${Math.max(280, dr.left - r.left - 12)}px`;
}
for (const [, d] of drawers) d.addEventListener('transitionend', placeBand);
addEventListener('resize', placeBand);
$('bandPlay').addEventListener('click', () => (band?.state === 'run' || band?.state === 'wait' ? pausePlay() : resumePlay()));
$('bandStop').addEventListener('click', closeBand);
{
  const strip = $('voyageBand').querySelector('.bstrip'), at = (e) => { const r = $('bandStrip').getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
  let scrubbing = false;
  strip.addEventListener('pointerdown', (e) => { if (!band) return; scrubbing = true; strip.setPointerCapture(e.pointerId); seekPlay(at(e)); });
  strip.addEventListener('pointermove', (e) => { if (scrubbing) seekPlay(at(e)); });
  for (const t of ['pointerup', 'pointercancel']) strip.addEventListener(t, () => { scrubbing = false; });
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

// The people: the People drawer, a vertical timeline of one row per person (data/voyages/people.json,
// scripts/people.mjs), earliest first with the eras as headings: the name and the years the record gives, a chip for a
// people (the Lapita) rather than one person. A click on a row chooses that person (a second click lets them go): their
// row is lit, their voyages are drawn lit in the chart's red and every other voyage chosen is dimmed (the scene's
// `person`), their birth is marked, the map flies to frame them, and all their pictures are dealt onto the map as onto
// a chart table, a little askew, to drag by hand, resize by a corner and turn over to read what each is and follow it
// to its page. Directly under their row their tile slides open: the bio, the pictures as thumbnails, each of which takes
// it off the table or puts it back, and then a row per voyage of theirs with its notes and the Voyages drawer's eye and play.
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
// skull flashes faintly over the map where any card lay (wipeSkull). Voyages drawn stay. True when a person was chosen, whose voyages the
// scene drew lit: the caller draws the map again.
function clearTable(hide = true, wipe = true) {
  const hadPerson = Boolean(style.person), lay = onTable > 0;
  dealing = null; reopen = null;
  if (hide) hideTile();
  if (style.person || style.sight || style.pictures != null || Object.keys(style.pictureAt ?? {}).length) {
    style = { ...style, person: null, sight: null, site: null, pictures: DEFAULTS.pictures, pictureAt: {} };
    flips.clear(); links.clear(); raised = []; looking = null; focusedPic = null;
    showPeople(); showSightCard(); writeHash();
  }
  if (lay) { if (wipe) wipeSkull(); if (ground) repaint('pictures swept'); }
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
  dealViews.set(s.key, clampView({ ...to, projection: view.projection, bearing: view.bearing }));
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
const yearsOf = (p) => p.voyages.flatMap((id) => voyageYears(peopleData.voyages[id]?.when));
const voyagesOf = (p) => p.voyages.map((id) => peopleData.voyages[id]).filter(Boolean);
function fillPeople() {
  return loadPeople().then(() => { if (!$('peopleList').childElementCount) drawPeople(); showPeople(); }, (e) => { $('peopleList').textContent = e.message; });
}
// The People drawer's rows, earliest first by birth (else by their first voyage), an era's heading before the first row
// in it; each row the name, the years and, for a people rather than a person, a chip
function drawPeople() {
  if (!peopleData) return;
  const people = [...peopleData.people].map((p) => [p, firstYear(p, yearsOf(p))]).sort((a, b) => (Number.isFinite(a[1]) ? a[1] : Infinity) - (Number.isFinite(b[1]) ? b[1] : Infinity));
  let era = null;
  $('peoplePanel').append($('personCard')); // out of the list before it is redrawn
  $('peopleList').innerHTML = people.map(([p, year]) => {
    const e = eraOf(year), head = e && e !== era ? eraItem(era = e) : '', years = yearsText(p, voyagesOf(p)), bar = spanBar(e, lifeSpan(p, yearsOf(p)));
    return `${head}<li data-row="${escapeHTML(p.id)}"><button type="button" class="life" data-person="${escapeHTML(p.id)}" aria-pressed="false" aria-expanded="false" title="${escapeHTML(p.name)}${years ? `, ${escapeHTML(years)}` : ''}">` +
      `<span class="who">${escapeHTML(p.name)}</span>${years ? `<span class="when">${escapeHTML(years)}</span>` : ''}${p.group ? '<span class="chip">a people</span>' : ''}${bar}</button>` +
      '<div class="rows"><div inert></div></div></li>';
  }).join('');
}
// an era's heading between the rows: its name and its years
// and under it the ruler of the era's own scale, which the life bars of its rows are drawn on
const eraItem = (name) => `<li class="era" data-era="${escapeHTML(name)}">${escapeHTML(name)}<small>${escapeHTML(eraYears(name))}</small>` +
  `<span class="ruler" aria-hidden="true">${eraScale(name).ticks.map(([y, label]) => `<span style="left:${pc(eraScale(name).x(y))}">${label}</span>`).join('')}</span></li>`;
const pc = (x) => `${(x * 100).toFixed(2)}%`;
// A row's span, a life or a voyage, as a bar on its era's ruler: an end the record leaves open, or that runs past the
// era, fades
function spanBar(era, span) {
  const b = barOn(era && eraScale(era), span);
  if (!b) return '';
  const [x0, x1, o0, o1] = b;
  return `<span class="span" aria-hidden="true"><span class="bar${o0 ? ' open-start' : ''}${o1 ? ' open-end' : ''}" style="left:${pc(x0)};width:${pc(Math.max(0.012, x1 - x0))}"></span></span>`;
}
// The chosen person's tile, slid open directly under their row and shut under everyone else's: the bio, the pictures as
// thumbnails, then one row per voyage of theirs with its title and years, its summary and where to read more, and the
// eye and play the Voyages drawer's rows have, so a voyage is shown, hidden or played from here
function showPeople() {
  const card = $('personCard'), p = personOf(style.person);
  for (const b of document.querySelectorAll('#peopleList [data-person]')) {
    const on = b.dataset.person === style.person;
    b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-expanded', String(on && Boolean(p)));
    b.parentElement.classList.toggle('open', on && Boolean(p));
    b.parentElement.querySelector(':scope > .rows > div').inert = !(on && p);
  }
  card.hidden = !p;
  if (!p) { card.replaceChildren(); $('peoplePanel').append(card); return; }
  const row = $('peopleList').querySelector(`li[data-row="${CSS.escape(p.id)}"] > .rows > div`);
  (row ?? $('peoplePanel')).append(card);
  const voyages = p.voyages.map((id) => [id, peopleData.voyages[id]]).filter(([, v]) => v).map(([id, v]) => voyageItem(id, v, peopleData.sources, { name: false })).join('');
  const pics = picsHTML({ images: p.images, manifest: peopleData.pictures }, picturesOf(p));
  card.innerHTML = (p.bio ? `<p class="bio">${escapeHTML(p.bio)}</p>` : '') +
    (pics ? `<div class="pics" role="group" aria-label="Pictures, on the table or off it">${pics}</div>` : '') +
    (voyages ? `<ul class="pvoyages" role="group" aria-label="${escapeHTML(p.name)}'s voyages">${voyages}</ul>` : '');
  showVoyage(); // the tile's eyes and play buttons as the voyages stand
}
// A subject's pictures as thumbnails, each a button that takes it off the table or puts it back (`shown` those on it)
const picsHTML = (s, shown, only = null) => s.images.map((im, i) => { const m = s.manifest[im.file];
  return m && (!only || only.includes(i)) ? `<button type="button" class="pic" data-pic="${i}" aria-pressed="${shown.includes(i)}" title="${escapeHTML(pictureNote(im) ?? pictureCredit(im))}: on the table, or off it"><img src="packs/overlays/${escapeHTML(m.src)}" alt="" loading="lazy"></button>` : ''; }).join('');
$('peopleList').addEventListener('click', (e) => {
  if (voyageControl(e)) return; // an eye or a play in the chosen person's tile
  const pic = e.target.closest('[data-pic]'), chosen = personOf(style.person);
  if (pic && chosen) { setOnTable(Number(pic.dataset.pic), !picturesOf(chosen).includes(Number(pic.dataset.pic))); return; }
  const b = e.target.closest('[data-person]');
  if (!b) return;
  const away = style.pictures?.length === 0; // every picture put away: the person is still chosen, and one click deals them back
  const id = b.dataset.person === style.person && !away ? null : b.dataset.person;
  clearTable(); // whatever lies on the table put away first, and a second click lets the person go
  if (id) { style = { ...style, person: id }; dealing = `person:${id}`; } // their cards dealt as the map arrives
  showPeople(); showSightCard(); writeHash(); render();
  if (id) flyToSubject();
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
// The skull in the right margin, always there, a memento mori under it, is the one clear for the whole map
// (docs/spec/design.md, "The skull is the one clear"): a click (or Enter, or Space) clears the table (clearTable), lifts
// every chart's sheet back to its own place and takes every voyage off, and moves the line on to the next (MEMENTO, the
// first at random). It leaves the settings (the rose, the projection, every style) and the view (place, zoom, bearing)
// as they are: a lifted sheet does not turn the world back to north here, as lifting one by its eye does.
let memento = Math.floor(Math.random() * MEMENTO.length);
const showMemento = () => { $('mementoText').textContent = MEMENTO[memento]; $('sweep').title = `Clear the map: ${MEMENTO_EN[memento]}`; };
showMemento();
// In stages, each drawn before the next, so the clear's effect can tell what went: the cards, then the lines (a
// person's back in their own inks), then the sheets; `snap(stage)` is called after each stage that changed the map
async function clearMap(snap = () => {}) {
  const hadPerson = clearTable(true, false), voyages = style.voyages.length > 0, charts = style.overlays.length > 0 || Object.keys(style.sheets).length > 0;
  snap('cards');
  if (voyages) { closeBand(); style = { ...style, voyages: [] }; }
  if (voyages || hadPerson) { showVoyage(); writeHash(); await render(); snap('lines'); }
  if (charts) { style = { ...style, overlays: [], sheets: {} }; showOverlay(); showVoyage(); writeHash(); await render(); snap('sheets'); }
}
// The clear is shown every time, the map already clear or not: the cards leave stage left, as they were dealt but
// mirrored; the lines fade; the sheets fade; the skull grows over the map and fades; and the phrase
// beside the skull, the one just clicked, is read large and red at the foot of the map, while the next takes its place
$('sweep').addEventListener('click', () => {
  const cards = cardsOnTable(), before = vanishFrom(), shots = { before };
  const done = clearMap((stage) => { if (before) shots[stage] = ctx.getImageData(0, 0, W, H); });
  skullRise(); wordsRise(MEMENTO[memento]);
  memento = mementoNext(memento); showMemento();
  if (before) Promise.race([done, new Promise((ok) => setTimeout(ok, 4000))]).then(() => vanish(shots, cards), () => vanish(shots, cards));
});
// The open drawer stops above the skull (--memento-h, index.html), whether the compass shows over it
new ResizeObserver(() => document.documentElement.style.setProperty('--memento-h', `${$('memento').offsetHeight}px`)).observe($('memento'));

// The clear's timing, chosen on #367: what goes (the lines and the charts' sheets) fades over 4 s; the skull is 0.4 s at
// 8% ink and grows to ×2.5; the phrase is 6 s, in at once and straight into a slow fade, and its size changes from
// 5% to 100% of that time, to ×1.05
const CLEAR_TUNE = { goneMs: 4000, skullMs: 400, wordsMs: 6000, ink: 8, skullGrow: 250, wordsGrow: 105, growFrom: 5, growTo: 100 };
const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// the map's box on the window, cut to the window
function mapBox() {
  const r = canvas.getBoundingClientRect(), left = Math.max(0, r.left), top = Math.max(0, r.top);
  return { r, left, top, wide: Math.min(innerWidth, r.right) - left, tall: Math.min(innerHeight, r.bottom) - top };
}
// The skull, almost as tall as the map or as wide, whichever bounds it, rises in and grows on past the map's edges as it fades
function skullRise() {
  const el = $('wipe');
  if (stillMotion()) return;
  const { left, top, wide, tall } = mapBox(), aspect = 200 / 254, h = Math.min(tall * 0.94, (wide * 0.94) / aspect), w = h * aspect;
  Object.assign(el.style, { width: `${w}px`, height: `${h}px`, left: `${left + (wide - w) / 2}px`, top: `${top + (tall - h) / 2}px` });
  el.hidden = false;
  el.getAnimations().forEach((x) => x.cancel());
  const ink = CLEAR_TUNE.ink / 100, g = CLEAR_TUNE.skullGrow / 100 - 1; // g 0: no change of size; 0.6: from 0.88 to 1.6
  el.animate([{ opacity: 0, transform: `scale(${1 - g * 0.2})` }, { opacity: ink, transform: 'scale(1)', offset: 0.3 }, { opacity: ink * 0.7, transform: `scale(${1 + g * 0.3})`, offset: 0.6 }, { opacity: 0, transform: `scale(${1 + g})` }],
    { duration: CLEAR_TUNE.skullMs, easing: 'cubic-bezier(.3,0,.6,1)' }).finished.then(() => { el.hidden = true; }, () => {});
}
// The phrase, on one line at the foot of the map, as large as fits it, grows and fades: slower than the skull, to be read
function wordsRise(text) {
  const el = $('mementoBig');
  const { left, top, wide, tall } = mapBox();
  el.textContent = mementoLines(text).join('\n'); el.hidden = false;
  el.getAnimations().forEach((x) => x.cancel());
  let size = Math.min(64, tall * 0.08) / (1 + 0.15 * (el.textContent.split('\n').length - 1));
  el.style.fontSize = `${size}px`;
  const fit = (wide * 0.86) / el.scrollWidth;
  if (fit < 1) { size *= fit; el.style.fontSize = `${size}px`; }
  Object.assign(el.style, { left: `${left + (wide - el.offsetWidth) / 2}px`, top: `${top + tall - el.offsetHeight - Math.max(56, tall * 0.12)}px` });
  // In, then straight into the fade, all one smooth curve: the fade eases in, so there is no
  // corner at the top. The size is its own animation: it holds at 1 until `growFrom` percent of the phrase's
  // time, then eases to its end size by `growTo` percent of it.
  const inAt = 0.06;
  const end = stillMotion() ? 1 : CLEAR_TUNE.wordsGrow / 100, from = CLEAR_TUNE.growFrom / 100, to = Math.max(from + 0.02, CLEAR_TUNE.growTo / 100);
  const smooth = 'cubic-bezier(.35,0,.65,1)', opts = { duration: CLEAR_TUNE.wordsMs, easing: 'linear', fill: 'both' };
  const done = () => { el.hidden = true; };
  el.animate([{ opacity: 0, easing: 'ease-out' }, { opacity: 1, offset: inAt, easing: smooth }, { opacity: 0 }], opts).finished.then(done, () => {});
  el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1)', offset: from, easing: smooth }, { transform: `scale(${end})`, offset: Math.min(1, to) }, { transform: `scale(${end})` }], opts);
}
// What goes: the map as it was is laid over itself before the clear (vanishFrom), so nothing jumps; once the map is
// drawn again, whatever changed is kept from it and leaves by the chosen effect over the same time, whatever it was
function vanishFrom() {
  if (stillMotion()) return null;
  const el = $('vanish'), { r } = mapBox();
  el.width = W; el.height = H;
  Object.assign(el.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const o = el.getContext('2d');
  o.clearRect(0, 0, W, H); o.drawImage(canvas, 0, 0);
  el.hidden = false;
  cancelAnimationFrame(vanishFrame);
  return o.getImageData(0, 0, W, H);
}
let vanishFrame = 0;
// The cards on the table as they lie, bottom of the pile first, for their exit
function cardsOnTable() {
  if (stillMotion() || !onTable) return [];
  const proj = viewProjection(view);
  return shownPictures().map((pic) => ({ img: pic.o.img, k: pic.k ?? 0, b: pictureBox(pic, proj) })).filter((c) => c.b);
}
// What changed between two shots of the map, kept from the first, and the box round it; null when nothing did
function goneBetween(before, after) {
  if (!before || !after) return null;
  const a = after.data, b = before.data, gone = new ImageData(W, H), g = gone.data;
  let x0 = W, x1 = -1, y0 = H, y1 = -1;
  for (let i = 0, p = 0; i < a.length; i += 4, p++) {
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) + Math.abs(a[i + 3] - b[i + 3]) <= 24) continue;
    g[i] = b[i]; g[i + 1] = b[i + 1]; g[i + 2] = b[i + 2]; g[i + 3] = b[i + 3];
    const x = p % W, y = (p / W) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) return null;
  const src = Object.assign(document.createElement('canvas'), { width: W, height: H });
  src.getContext('2d').putImageData(gone, 0, 0);
  return { src, gone, box: { x0, x1, y0, y1 } };
}
// Each card leaves as it was dealt, mirrored and at the deal's own pace (DEAL_MS, DEAL_GAP): off to the top left,
// shrinking and turning, one after another; `ms` since the exit began
const cardsLeft = (cards) => (cards.length ? DEAL_MS + (cards.length - 1) * DEAL_GAP : 0);
// a thing at box `b` dealt off to the top left, `e` 0 where it lies to 1 gone: x, y, scale and its turn
const dealtOff = (b, e) => [b.x + (-b.w * 0.25 - b.x) * e, b.y * (1 - e), 1 - 0.65 * e, -e * 0.6];
function drawCardsLeaving(o, cards, ms) {
  const m = 5;
  cards.forEach(({ img, b }, k) => {
    const u = Math.max(0, Math.min(1, (ms - k * DEAL_GAP) / DEAL_MS)), e = u ** 3; // ease in, the deal's ease out mirrored
    if (u >= 1) return;
    const [x, y, s, turn] = dealtOff(b, e);
    o.save(); o.translate(x, y); o.rotate(b.a + turn); o.scale(s, s);
    o.save(); o.shadowColor = 'rgba(59,42,26,0.35)'; o.shadowBlur = 8; o.shadowOffsetY = 2; o.fillStyle = style.parchment; o.fillRect(-b.w / 2 - m, -b.h / 2 - m, b.w + 2 * m, b.h + 2 * m); o.restore();
    o.drawImage(img, -b.w / 2, -b.h / 2, b.w, b.h);
    o.strokeStyle = style.ink; o.globalAlpha = 0.7; o.lineWidth = 1; o.strokeRect(-b.w / 2 - m, -b.h / 2 - m, b.w + 2 * m, b.h + 2 * m);
    o.restore();
  });
}
// What goes, over one time: the sheets by the chosen effect, the lines fading over them, the cards leaving over both
function vanish(shots, cards) {
  const el = $('vanish'), o = el.getContext('2d');
  const now = ctx.getImageData(0, 0, W, H), cardsShot = shots.cards ?? now, linesShot = shots.lines ?? cardsShot;
  const lines = goneBetween(cardsShot, linesShot), sheets = goneBetween(linesShot, shots.sheets ?? linesShot);
  if (!lines && !sheets && !cards.length) { el.hidden = true; return; } // nothing was there to go
  const play = sheets && sheetFades(o, sheets.src), t0 = performance.now();
  const tick = (now) => {
    const ms = now - t0, t = Math.min(1, ms / CLEAR_TUNE.goneMs);
    o.clearRect(0, 0, W, H);
    if (play) play(t);
    if (lines) { o.globalAlpha = (1 - t) ** 1.5; o.drawImage(lines.src, 0, 0); o.globalAlpha = 1; }
    drawCardsLeaving(o, cards, ms);
    if (t < 1 || ms < cardsLeft(cards)) vanishFrame = requestAnimationFrame(tick); else el.hidden = true;
  };
  vanishFrame = requestAnimationFrame(tick);
}
// A chart's sheet fades, `t` 0 to 1 over the clear's time, blurring and swelling a little into nothing
const sheetFades = (o, src) => (t) => {
  const s = 1 + 0.04 * t;
  o.globalAlpha = (1 - t) ** 1.5; o.filter = `blur(${(t * 10).toFixed(1)}px)`;
  o.setTransform(s, 0, 0, s, (W * (1 - s)) / 2, (H * (1 - s)) / 2); o.drawImage(src, 0, 0);
  o.setTransform(1, 0, 0, 1, 0, 0); o.filter = 'none'; o.globalAlpha = 1;
};
// The wipe: the skull itself, large and almost unseen, flashes once over the middle of the map while the cards go,
// about half a second; none under reduced motion
function wipeSkull() {
  const el = $('wipe');
  if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = canvas.getBoundingClientRect(), left = Math.max(0, r.left), top = Math.max(0, r.top), wide = Math.min(innerWidth, r.right) - left, tall = Math.min(innerHeight, r.bottom) - top, size = Math.min(wide, tall) * 0.7;
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, left: `${left + (wide - size) / 2}px`, top: `${top + (tall - size) / 2}px` });
  el.hidden = false;
  el.getAnimations().forEach((x) => x.cancel());
  el.animate([{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 0.1, transform: 'scale(1)', offset: 0.35 }, { opacity: 0, transform: 'scale(1.04)' }],
    { duration: 500, easing: 'ease-out' }).finished.then(() => { el.hidden = true; }, () => {});
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
const CLEAR_MS = 250; // a chart's flight waits this long on the old sheet's clearing, the cleared frame shows before it flies
let flyAfterClear = 0;
$('chartList').innerHTML = CHARTS.map(({ name, year, made, text, overlay }, i) => `<li class="chart"${overlay ? ` data-overlay="${overlay}"` : ''}><button type="button" class="thumb none" data-chart="${i}" data-to="view" title="The chart's frame">${skin}</button><div class="about"><span class="head"><button type="button" class="name" data-chart="${i}" data-to="view">${name}</button>${overlay ? `<button type="button" class="eye" data-chart="${i}" data-to="eye" aria-pressed="false" aria-label="Show ${name}" hidden>${EYE}</button>` : ''}</span><span class="where"><button type="button" class="city" data-chart="${i}" data-to="made">${made.title}</button>, ${year}</span>${overlay ? `<div class="slider fade" hidden><input type="range" min="0" max="1" step="0.05" aria-label="Opacity of ${name}'s sheet: lower lets the map show through"><output></output></div>` : ''}${caption(text)}</div></li>`).join('');
// The sheets laid, bottom to top, and where each lies; `fade` the id of one that fades in as it is placed. `draw` false
// when a flight follows at once: its landing draws them, and a render now would only be thrown away by its first frame.
// A sheet lifted while the world stands turned to its up turns the world back to north up: at once, or, where a flight
// follows in the same task (a chart's name, a place under the sheet), as that flight's bearing (docs/spec/design.md,
// "The world turned to the chart"); the eye's `north` false leaves the world as it stands. The row's chips follow at once.
let northNext = false;
function setSheets(overlays, sheets = style.sheets, fade = null, draw = true, north = true) {
  if (overlays.some((id) => !style.overlays.includes(id))) chartsFresh = false;
  const lifted = sheetsShown().filter((o) => !overlays.includes(o.id));
  if (north && lifted.some(atUp)) {
    northNext = true;
    queueMicrotask(() => { if (northNext) { northNext = false; turnWorld(0); } });
  }
  style = { ...style, overlays, sheets };
  fadeIn = fade;
  showOverlay(); showVoyage(); writeHash(); placeSheetChips();
  if (draw) render();
}
$('chartList').addEventListener('click', (e) => {
  const b = e.target.closest('[data-chart]');
  if (!b) return;
  const chart = CHARTS[b.dataset.chart], o = OVERLAYS.find((v) => v.id === chart.overlay), shown = !!o && style.overlays.includes(o.id);
  if (b.dataset.to === 'eye') { // this sheet on or off, where it last lay; every other sheet and the view as they are, its notes quiet
    if (!o) return;
    if (!shown) seen.add(o.id);
    setSheets(shown ? style.overlays.filter((id) => id !== o.id) : [...style.overlays, o.id], style.sheets, null, true, false);
    return;
  }
  if (b.dataset.to === 'made') {
    const to = clampView({ ...chart.made, projection: view.projection, bearing: view.bearing });
    clearSheetFor(to);
    goTo(to);
    return;
  }
  if (!o) { goTo(chart.view); return; }
  const { [o.id]: _, ...sheets } = style.sheets; // back to its own placement
  const others = laidSheets().some((v) => v.id !== o.id);
  seen.delete(o.id); // its notes announce themselves again once it lands
  setSheets([o.id], sheets, !shown && chartsFresh ? o.id : null, false); // shown alone: every other sheet hides
  const bearing = northNext ? 0 : view.bearing ?? 0;
  northNext = false;
  const flyTo = () => goTo({ ...sheetView(o, o.sheet, { w: W, h: H, bearing }), bearing, title: chart.name }); // the whole sheet framed, 8% clear round it, the world turned as it is
  if (!others) { flyTo(); return; }
  // another chart's sheet: cleared first as the skull clears the table, then the flight (docs/spec/design.md, "a new chart's icon or name clears the old one, then flies")
  clearTable(true, false); // no skull flash: the clear, the flight and the sheet follow one another with no animation of their own
  if (ground) { ground = { ...ground, overlays: [], anchored: { ...ground.anchored, overlays: [] } }; paintFrame('a chart cleared'); }
  clearTimeout(flyAfterClear);
  flyAfterClear = setTimeout(flyTo, reducedMotion() ? 0 : CLEAR_MS);
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
    const fade = li.querySelector('.fade'), at = effectiveOpacity(style); // the sheet's opacity, while its sheet is shown
    fade.hidden = !on || style.overlayMode !== 'sheet';
    if (document.activeElement !== fade.firstChild) fade.firstChild.value = String(at);
    fade.lastChild.textContent = `${Math.round(at * 100)}%`;
  }
}
let fadeTimer = 0;
$('chartList').addEventListener('input', (e) => {
  if (!e.target.matches('.fade input')) return;
  style = { ...style, overlayOpacity: Number(e.target.value) };
  showOverlay(); showHood(); writeHash();
  clearTimeout(fadeTimer); fadeTimer = setTimeout(render, 80); // drawn when the slider pauses
});

// A sheet fading in over the scene just placed: the scene without it is kept, and the sheet drawn over it at a rising
// alpha; a move or a newer placement ends the fade with the sheet whole.
function fadeSheet(o, proj, me) {
  const base = Object.assign(document.createElement('canvas'), { width: W, height: H });
  base.getContext('2d').drawImage(canvas, 0, 0);
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500, t0 = performance.now();
  const step = (now, first = false) => {
    o.alpha = ms ? Math.min(1, (now - t0) / ms) : 1;
    if (me !== run) { o.alpha = 1; return; }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0);
    drawSheet(ctx, o, proj, o.sheet);
    drawPictures(ctx);
    if (o.alpha < 1) { drawLayer(ctx, proj, placed.zoom); requestAnimationFrame(step); } else if (!first) placeLayer(); // whole: its notes announce themselves
  };
  step(t0, true);
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
  const frames = [...places.map(({ view: v }) => ({ name: v.title, view: v })), ...places, ...CHARTS.map(({ name, view }) => ({ name, view }))];
  const candidates = [
    ...frames,
    ...withoutPartsOfFrames(POIS.map((p) => ({ name: p.name, view: { lon: p.lon, lat: p.lat, zoom: 7, title: p.name } })), frames),
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
  const to = clampView({ ...target, projection: view.projection, bearing: target.bearing ?? view.bearing }), proj = viewProjection(to);
  const spots = frame ? Array.from({ length: 25 }, (_, i) => [W * (0.1 + 0.2 * (i % 5)), H * (0.1 + 0.2 * Math.floor(i / 5))]) : [proj.project(to.lon, to.lat)];
  const covering = sheets.filter((o) => spots.some(([x, y]) => onSheet(o, proj, o.sheet, x, y)));
  if (covering.length) setSheets(style.overlays.filter((id) => !covering.some((o) => o.id === id)), style.sheets, null, false); // a fly follows at once, and draws
}
// A flight from the view to a target, in the view's projection (flight.mjs plans it: a near place eased to
// straight, a far one in an arc out, across and down, longer for longer): the ground is drawn on the way as
// for a drag, and the ornaments placed when it lands. Every fly on the page comes through here. Reduced motion jumps.
let flight = 0, flightTo = null; // the view a flight is bound for, while it flies
let turningTo = null; // the bearing a turn is bound for, while it turns, so a second quarter turn adds to the first
let lastFlight = null; // { from, target } of the last flight, for Fly again under the hood
// Every fly first clears the table (clearTable); one that carries a subject (`deal`, its key) deals its cards as it
// nears the target: once the zoom, having been further, comes within DEAL_NEAR levels of the target's, else on landing.
const DEAL_NEAR = 1;
function goTo(target, deal = null) {
  if (deal == null) clearTable();
  cancelAnimationFrame(flight); turningTo = null;
  pinTitle = null;
  const from = view, to = clampView({ ...target, projection: view.projection, bearing: northNext ? 0 : target.bearing ?? view.bearing }); // the world stays turned as it is, unless a lifted sheet turned it
  northNext = false;
  flightTo = to; lastFlight = { from, target };
  const plan = planFlight(from, to, { w: W, h: H, minZoom: ZOOM.min, ...fly });
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : plan.ms, t0 = performance.now();
  $('flyOut').textContent = `${plan.arc ? 'arc' : 'near'}, top z${plan.top.toFixed(2)}, ${(plan.ms / 1000).toFixed(1)} s`;
  let far = false;
  const step = (now) => {
    const u = ms ? Math.min(1, (now - t0) / ms) : 1, e = flyEase(u, fly.ease), at = u < 1 ? clampView({ ...plan.at(e), projection: to.projection, bearing: to.bearing }) : to;
    moved(at, true);
    if (deal) { if (Math.abs(at.zoom - to.zoom) > DEAL_NEAR) far = true; else if (far) dealNow(deal); }
    if (u < 1) flight = requestAnimationFrame(step); else { flightTo = null; pinTitle = target.title ?? null; placed = null; if (deal) dealNow(deal); stopped(); }
  };
  step(t0);
}
// The world turned to a bearing, the short way round, in TURN_MS (reduced motion jumps); `frame`, a view to end on
// (a sheet framed as it will stand), is eased to along the way. The ornaments are placed again when it stops.
const TURN_MS = 700;
function turnWorld(bearing, frame = null) {
  takeOver();
  turningTo = bearing;
  const from = view, d = ((bearing - (from.bearing ?? 0) + 540) % 360) - 180, to = frame ? clampView({ ...frame, projection: from.projection, bearing }) : null;
  const dl = to ? ((to.lon - from.lon + 540) % 360) - 180 : 0;
  const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : TURN_MS, t0 = performance.now();
  const step = (now) => {
    const u = ms ? Math.min(1, (now - t0) / ms) : 1, e = u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2;
    const at = to ? { lon: from.lon + dl * e, lat: from.lat + (to.lat - from.lat) * e, zoom: from.zoom + (to.zoom - from.zoom) * e } : {};
    moved(clampView({ ...from, ...at, bearing: (from.bearing ?? 0) + d * e }), true);
    if (u < 1) flight = requestAnimationFrame(step); else { turningTo = null; stopped(); }
  };
  flight = requestAnimationFrame(step);
}
// The compass in the gutter, shown while a sheet is laid or the world is turned: its needle points north on the
// window; a click turns the world back to north up, a drag round it turns the world, and every sheet on it, by the
// angle swept, so a chart with no up (the Catalan Atlas) can be walked round (docs/spec/design.md, "A chart with no up
// turns for the reader").
const compass = $('compass');
let spin = null; // { a, bearing, moved } while the compass is held: the pointer's angle about it and the bearing then
function showCompass() {
  const b = view.bearing ?? 0;
  compass.hidden = !b && !sheetsShown().length;
  compass.querySelector('svg').style.transform = `rotate(${-b}deg)`;
  compass.setAttribute('aria-label', b ? `North is ${Math.round(b)}° from the top: click for north up, or drag round to turn the world` : 'North up: drag round to turn the world and the chart with it');
  compass.title = b ? 'North up (drag round to turn)' : 'Drag round to turn the world';
}
const angleAbout = (el, e) => { const r = el.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
compass.addEventListener('pointerdown', (e) => {
  takeOver();
  compass.setPointerCapture(e.pointerId);
  spin = { a: angleAbout(compass, e), bearing: view.bearing ?? 0, moved: false };
});
compass.addEventListener('pointermove', (e) => {
  if (!spin) return;
  const d = ((angleAbout(compass, e) - spin.a + 540) % 360) - 180;
  if (!spin.moved && Math.abs(d) < 4) return; // a click's wobble
  spin.moved = true;
  moved(clampView({ ...view, bearing: spin.bearing - d })); // swept clockwise, the world turns clockwise
  showCompass();
});
const letGo = (e) => {
  if (!spin) return;
  const { moved: turned } = spin;
  spin = null;
  if (turned) stopped(); else if (e.type === 'pointerup' && view.bearing) turnWorld(0);
};
compass.addEventListener('click', (e) => { if (e.detail === 0 && view.bearing) turnWorld(0); }); // Enter or Space: north up
compass.addEventListener('pointerup', letGo);
compass.addEventListener('pointercancel', letGo);
compass.addEventListener('keydown', (e) => { // the arrow keys turn it by 15°, as the drag does
  const d = { ArrowLeft: 15, ArrowRight: -15 }[e.key];
  if (d == null) return;
  e.preventDefault();
  turnWorld((view.bearing ?? 0) + d);
});

// A touch or the wheel takes over from a flight: a subject it was carrying is dealt where the map is
function takeOver() {
  const flying = flightTo != null;
  cancelAnimationFrame(flight); flightTo = null; turningTo = null; clearTimeout(flyAfterClear);
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
// either set of projection chips drives (first, so readControls sees both agree) the other
for (const [from, to] of [['projection', 'projectionCharts'], ['projectionCharts', 'projection']]) $(from).addEventListener('input', () => { $(to).value = $(from).value; });
for (const id of ['debug', 'overlap', 'overlayMode', 'compare', 'comparePos', 'sheetHides', 'overlayOpacity', ...Object.values(KNOB_CHIPS), ...Object.values(KNOB_SLIDERS), 'projection', 'projectionCharts', 'ink', 'parchment', 'density', 'names', 'rhumb', 'scale', 'scaleBorder', 'land', 'islands', 'seaTint', 'rivers', 'lakes', 'reefs', 'playas', 'peaks', 'trees', 'mountains', 'hills', 'continentsZoom', 'regions', 'regionSet', 'regionStyle', 'regionsZoom', 'titleMode', 'townSize', 'voyageWidth']) $(id).addEventListener('input', readControls);
// The compare line: over the map at the wipe's position, pieces mode only. In swipe it is dragged; in wipe the slider moves it.
function placeCompareLine() {
  const line = $('compareLine'), on = style.overlayMode === 'pieces' && style.compare !== 'off' && style.overlays.length > 0;
  line.hidden = !on; line.classList.toggle('drag', style.compare === 'swipe');
  if (!on) return;
  const r = canvas.getBoundingClientRect();
  line.style.left = `${r.left + style.comparePos * r.width}px`; line.style.top = `${Math.max(0, r.top)}px`; line.style.height = `${Math.min(innerHeight, r.bottom) - Math.max(0, r.top)}px`;
}
addEventListener('resize', placeCompareLine);
new ResizeObserver(placeCompareLine).observe(canvas); // on a phone a drawer opening or closing resizes the canvas without a window resize
$('compareLine').addEventListener('pointerdown', (e) => {
  if (style.compare !== 'swipe') return;
  e.preventDefault(); e.stopPropagation();
  const move = (m) => {
    const r = canvas.getBoundingClientRect();
    style.comparePos = Math.max(0, Math.min(1, (m.clientX - r.left) / r.width));
    $('comparePos').value = String(style.comparePos);
    placeCompareLine(); // the line follows at once; the render is at most one a frame, and one more on release
    frame ||= requestAnimationFrame(() => { frame = 0; readControls(); });
  };
  let frame = 0;
  const up = () => { cancelAnimationFrame(frame); readControls(); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
});
let typing = 0; // a typed title is placed when the typing pauses, not on every key: a placement takes up to a few hundred ms
$('title').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(readControls, 400); });
addEventListener('hashchange', () => { dealing = null; hoverOpen = hoverFromHash(); showHover(); view = viewFromHash(); style = styleFromHash(); selection = selectionFromHash(); showStyle(); showPlacement(); showVoyage(); showPeople(); render(); });
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
