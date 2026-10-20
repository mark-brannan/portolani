// Browser host for the shared scene code (scene.mjs): same scene as `npm run render`, drawn live.
// Drag to pan, wheel or pinch to zoom; while the map moves the land and coast are drawn and the placed
// ornaments slide with it, held to the earth; they are placed again when it stops. The settings live in a
// drawer behind the rose button, so the map has the window; two buttons top right go to the user's
// position, marked in red ink, and back to an origin. The view and the style are kept in the URL hash, e.g.
// #map=zoom/lat/lon&projection=miller&sprites=s:serpent-a,v:kraken,v:rose-aguiar,p:tower&townsize=rank&names=0&rhumb=0&scale=chevron&scaleborder=blank&continents=5&regions=latin&regionszoom=7&land=green&islands=1&rivers=aguiar&lakes=marina&mountains=ink&trees=ink&seas=1&autotitle=0&title=Mare+Nostrum&ink=5a1a1a&parchment=eee&density=1.5;
// a setting left at its default is left out, `sprites` too (keys with the pack shortened, v: s: p:); `mountains` is `ink`
// or `off` (colour is the default); the hills are the Catalan sprites in `sprites`. `continents` and `regionszoom` are the zoom
// they are drawn down from (0 off, the top always).
// Older links naming a `rendering` (or `pack`), `rose`, `monster`, `town` and `kinds` open as the
// selection those chose, and are written back in the new form.
import { createScene, towerGlyph, REGION_LANGS, drawScene, drawGround, anchorScene, drawAnchored, panView, zoomView, clampView, viewOfFrame, viewProjection, SCALE_CARD_W, SCALE_CARD_H, drawCartoucheCard, drawScaleCard, covers, DEFAULT_VIEW, RENDERINGS, KINDS, DEFAULT_KINDS, LANDS, SCALE_BORDERS, MAX_ZOOM, RIVER_STYLES, LAKE_STYLES, TREE_STYLES, TOWN_SIZES, readManifests, listSprites, defaultSprites, chooseSprites, PROJECTION_NAMES, SCALE_NAMES, parsePlacement, W, H } from './scene.mjs';
import { POIS } from './pois.mjs';

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
// A phone (under 520 px wide): the drawer is a bottom sheet, and the cartouche and the scale bar sit on
// cards beside the map, not on the sea.
const phone = matchMedia('(max-width: 520px)');

const DEFAULTS = { ink: '#3b2a1a', parchment: '#e9d8b4', density: 1, names: true, rhumb: true, scale: 'genoese', continentsZoom: 5, regions: 'latin', regionsZoom: 7, title: 'PORTOLANI', autoTitle: true, land: 'ochre', islands: false, rivers: 'plain', lakes: 'marina', mountains: 'colour', trees: 'marina', seaTint: false, scaleBorder: 'bordered', townSize: TOWN_SIZES[0] };

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
    townSize: TOWN_SIZES.includes(q.get('townsize')) ? q.get('townsize') : DEFAULTS.townSize,
    placement: parsePlacement(q.get('placement')).text,
  };
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
  if (st.seaTint) q.set('seas', '1');
  if (st.scaleBorder !== DEFAULTS.scaleBorder) q.set('scaleborder', st.scaleBorder);
  if (st.scale !== DEFAULTS.scale) q.set('scale', st.scale);
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
const CHOICES = {
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
  scaleBorder: [['bordered', 'Bordered', 'parchment and a double rule'], ['blank', 'Blank', 'parchment, no rule'], ['transparent', 'Transparent', 'drawn over the map']].map(([value, label, note = '']) => [value, label, note, BORDER_GLYPHS[value]]),
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
  $('mountains').value = style.mountains; $('hills').value = CATALAN_KEYS.some((k) => selection.has(k)) ? 'catalan' : 'off';
  $('continentsZoom').value = style.continentsZoom; $('continentsOut').textContent = zoomLabel(style.continentsZoom);
  $('regions').value = style.regions; $('regionsZoom').value = style.regionsZoom; $('regionsOut').textContent = zoomLabel(style.regionsZoom);
  $('titleMode').value = style.autoTitle ? 'auto' : 'custom'; $('title').disabled = style.autoTitle;
  if (!style.autoTitle) $('title').value = style.title; // automatic shows the view's own name, once placed (render)
  $('townSize').checked = style.townSize !== 'rank';
  showUiNow();
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
  };
  // hills are the Catalan sprites: the chip selects all of them or none
  const hills = $('hills').value === 'catalan';
  if (hills !== CATALAN_KEYS.some((k) => selection.has(k))) for (const k of CATALAN_KEYS) hills ? selection.add(k) : selection.delete(k);
  view = clampView({ ...view, projection: $('projection').value });
  changed();
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
// the style switches: off, or the default (the first drawn style where the default is off)
const STYLE_SWITCHES = [
  ['mountains', 'Mountain style', MOUNTAIN_GLYPHS.colour], ['trees', 'Trees', TREE_GLYPHS.marina],
  ['rivers', 'Rivers', RIVER_GLYPHS.plain], ['lakes', 'Lakes', LAKE_GLYPHS.marina],
];
let showUiNow = () => {};
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
      box.append(head, fams, grid);
      body.append(box);
    }
  }
  showUiNow = () => { for (const f of refreshers) f(); };
}

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
    });
    if (me !== run) return; // a newer change or a move superseded this one
    ground = { world, coarse, bg, anchored: anchorScene(scene, data), cards: { cartouche: kinds.includes('cartouche') ? scene.cartouche : null, scaleSprite: scene.scaleSprite, scale: style.scale, bg } };
    if (style.autoTitle) $('title').value = scene.cartouche.title; // the box shows what the cartouche letters, and cannot be edited
    placed = view;
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
addEventListener('resize', () => drawCards()); // the cards' width follows the window, in rotation too
phone.addEventListener('change', () => { drawCards(); if (ground) render(); }); // the sheet is placed again with or without them

// ---------------------------------------------------------------- the drawer

// Shut by default; Esc or the close button shuts it (on a wider screen a touch on the map does too), and focus goes back to the rose button.
const drawer = $('drawer'), opener = $('open');
const isOpen = () => drawer.classList.contains('open');
function setDrawer(open) {
  if (open === isOpen()) return;
  drawer.classList.toggle('open', open);
  document.documentElement.classList.toggle('sheet', open); // on a phone the map makes room above the sheet
  opener.setAttribute('aria-expanded', String(open));
  (open ? $('close') : opener).focus({ preventScroll: true });
}
opener.addEventListener('click', () => setDrawer(!isOpen()));
$('close').addEventListener('click', () => setDrawer(false));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) setDrawer(false); });
// On a phone the sheet stays up while the map is moved above it: that is how a control's effect is seen.
canvas.addEventListener('pointerdown', () => { if (!phone.matches) setDrawer(false); });

// Reset: every control back to its default, the place kept. The hash holds the whole style, so a
// hash with only the view is the default style; the hashchange handler below redraws from it.
$('reset').addEventListener('click', () => {
  const m = hashParams().get('map');
  $('shareUrl').hidden = true; $('shareNote').textContent = '';
  location.hash = m ? `map=${m}` : '';
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

// ---------------------------------------------------------------- moving

let frame = 0, settle = 0;
function moved(next, flying = false) {
  if (next.zoom === view.zoom && next.lon === view.lon && next.lat === view.lat) return; // e.g. wheel at a zoom bound
  if (!flying) pinTitle = null; // a drag or a wheel leaves the place flown to
  view = next;
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
const pinch = () => {
  const [[ax, ay], [bx, by]] = pointers.values();
  return { d: Math.hypot(bx - ax, by - ay), x: (ax + bx) / 2, y: (ay + by) / 2 };
};

canvas.addEventListener('pointerdown', (e) => {
  cancelAnimationFrame(flight); // a touch takes over from a flight
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, toCanvas(e.clientX, e.clientY));
  clearTimeout(settle);
});
canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = toCanvas(e.clientX, e.clientY);
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
  if (!pointers.delete(e.pointerId)) return;
  if (pointers.size === 0) stopped();
};
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cancelAnimationFrame(flight); // the wheel takes over from a flight
  const [x, y] = toCanvas(e.clientX, e.clientY);
  const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines to px
  moved(zoomView(view, 2 ** (-px / 300), x, y));
  stopped(300);
}, { passive: false });

// ---------------------------------------------------------------- going somewhere

// The origins: the chart's home frame, the frames of the scans the ornaments come from, the centres
// read off the scans (docs/atlas/centres.md), and some places worth the flight.
const around = (lon, lat, r) => viewOfFrame({ lonMin: lon - r, lonMax: lon + r, latMin: lat - r, latMax: lat + r });
const at = (lon, lat, zoom) => ({ lon, lat, zoom });
const ORIGINS = [
  ['', [
    ['Mediterranean', DEFAULT_VIEW, 'The Mediterranean'],
    ['The North', viewOfFrame({ lonMin: 0, lonMax: 40, latMin: 54, latMax: 72 }), 'The North'], // Carta Marina
    ['Virginia', at(-76, 36.28, 7.47)], // de Bry
    ['The world', at(10, 25, 0), 'The World'],
  ]],
  ['Chart centres', [
    ['Carte Pisane, west', around(7.4, 40.0, 8), 'Carte Pisane'],
    ['Carte Pisane, east', around(27.4, 36.8, 7.5), 'Carte Pisane'],
    ['Vesconte 1311', around(25.2, 37.5, 3)],
    ['Dulcert 1339', around(14.5, 40.0, 17)],
    ['Catalan Atlas, rose', around(-20.7, 42.1, 16), 'Catalan Atlas'],
    ['Catalan Atlas, network', around(-5.4, 42.3, 16), 'Catalan Atlas'],
    ['Carta Marina, Bothnian rose', around(19.7, 61.7, 6), 'Carta Marina'],
    ['De la Cosa, west', around(-45, 23.4, 15), 'De la Cosa'],
    ['De la Cosa, east', around(65, 23.4, 15), 'De la Cosa'],
  ]],
  // the places that are lettered on the chart whatever the city data holds are in scripts/pois.mjs
  ['Elsewhere', [
    ['Lisbon', at(-9.14, 38.72, 7.5)],
    ['Seville', at(-5.98, 37.39, 7.5)],
    ['Majorca', at(3.0, 39.6, 7)], // Catalan Atlas, 1375
    ['Dieppe', at(1.08, 49.93, 7.5)], // Vallard Atlas, 1547
    ['Guam', at(144.79, 13.44, 7)], // Islas de los Ladrones
    ['Cebu', at(123.89, 10.32, 7)],
    ['Maluku Islands', at(128, -3, 5)],
    ['Solomon Islands', at(160, -9, 5)],
    ['Marquesas Islands', at(-140, -9, 6)],
    ['Pukapuka Atoll', at(-138.8, -14.82, 6.5), 'Pukapuka'], // Magellan's San Pablo, 1521 (the Tuamotu one)
    ['Pitcairn Island', at(-130.1, -25.07, 6.5), 'Pitcairn'],
  ]],
];
const originViews = [];

// The two menus: the anchor opens the chart views, the dividers Go. Each opens on a click and shuts on a
// choice, a second click, a click anywhere outside it, or Esc; opening one shuts the other.
const where = $('where');
const menus = [[$('places'), $('flyout')], [$('go'), $('goPanel')]];
function setFlyout(open) { // the panel to open, or false for none
  for (const [button, panel] of menus) {
    panel.classList.toggle('open', panel === open);
    button.setAttribute('aria-expanded', String(panel === open));
  }
  if (!open && where.contains(document.activeElement)) document.activeElement.blur();
}
for (const [button, panel] of menus) button.addEventListener('click', () => {
  setFlyout(panel.classList.contains('open') ? false : panel);
  if (panel.id === 'goPanel' && panel.classList.contains('open') && !phone.matches) $('coordsText').focus();
});
addEventListener('pointerdown', (e) => { if (!where.contains(e.target)) setFlyout(false); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') setFlyout(false); });

// The cartouche names the place flown to (its title, else the button's name), not whatever scores highest in the frame.
$('origins').innerHTML = ORIGINS.map(([group, items]) =>
  (group ? `<li class="group">${group}</li>` : '') + items.map(([name, v, title]) => `<li><button type="button" data-origin="${originViews.push({ ...v, title: title ?? name }) - 1}">${name}</button></li>`).join('')).join('');
$('origins').addEventListener('click', (e) => { const b = e.target.closest('[data-origin]'); if (b) { setFlyout(false); goTo(originViews[b.dataset.origin]); } });

// A typed position: "36.28, -76" or "36.28N 76W" (latitude first).
function parseLatLon(text) {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*°?\s*([NSns])?\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*°?\s*([EWew])?\s*$/.exec(text);
  if (!m || (m[2] && m[1].startsWith('-')) || (m[4] && m[3].startsWith('-'))) return null; // a sign and a letter disagree, or say it twice
  const lat = Number(m[1]) * (/s/i.test(m[2] ?? '') ? -1 : 1), lon = Number(m[3]) * (/w/i.test(m[4] ?? '') ? -1 : 1);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lon, lat } : null;
}

// A typed place: the chart views, then the points of interest, then Natural Earth's towns, matched without
// case or accents, and loosely: a whole name, its start, one of its words, or a few letters' slip from one.
const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function edits(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}
function nameScore(q, name) {
  const n = fold(name), words = n.split(' ');
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (words.some((w) => w.startsWith(q))) return 2;
  if (q.length < 4) return Infinity;
  const d = Math.min(edits(q, n), edits(q, n.slice(0, q.length)) + 0.25, ...words.map((w) => edits(q, w) + 0.5)); // the whole name before a part of it
  return d < Math.floor(q.length / 3) + 1 ? 3 + d : Infinity;
}
async function findPlace(text) {
  const q = fold(text);
  if (!q) return null;
  const towns = await env.readJSON('geo/ne-populated-places-50m.geojson').then((g) => g.features.toSorted((a, b) => a.properties.SCALERANK - b.properties.SCALERANK), () => []); // the bigger town first
  const candidates = [
    ...originViews.map((v) => ({ name: v.title, view: v })),
    ...ORIGINS.flatMap(([, items]) => items).map(([name], i) => ({ name, view: originViews[i] })),
    ...POIS.map((p) => ({ name: p.name, view: { lon: p.lon, lat: p.lat, zoom: 7, title: p.name } })),
    ...towns.map(({ properties: p, geometry: { coordinates: [lon, lat] } }) => ({ name: p.NAME, view: { lon, lat, zoom: 8, title: p.NAME } })),
  ];
  let best = null, bestScore = Infinity;
  for (const c of candidates) { const s = nameScore(q, c.name); if (s < bestScore) { best = c; bestScore = s; } } // ties keep the earlier list
  return best?.view ?? null;
}

$('coords').addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = $('coordsText').value, p = parseLatLon(text), miss = $('goMiss');
  const target = p ? { ...p, zoom: Math.max(view.zoom, LOCATE_ZOOM) } : await findPlace(text);
  miss.hidden = !!target;
  if (!target) { miss.textContent = text.trim() ? `No place called “${text.trim()}”` : 'Type a place, or latitude, longitude: 36.28, -76'; return; }
  setFlyout(false);
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

// My position: asked for on the button and flown to at z10 or closer, with nothing drawn there. The
// button is not offered where the browser has no geolocation (an insecure page has none).
const LOCATE_ZOOM = 10;
const locate = $('locate');
locate.hidden = !navigator.geolocation;
locate.addEventListener('click', () => {
  locate.disabled = true; locate.textContent = 'Finding…';
  const done = () => { locate.disabled = false; locate.textContent = 'My position'; };
  navigator.geolocation.getCurrentPosition((p) => {
    done();
    setFlyout(false);
    goTo({ lon: p.coords.longitude, lat: p.coords.latitude, zoom: Math.max(view.zoom, LOCATE_ZOOM) });
  }, (e) => {
    done();
    $('status').textContent = e.code === e.PERMISSION_DENIED ? 'My position: not allowed' : `My position: ${e.message}`;
  }, { timeout: 15000, maximumAge: 60000 });
});

for (const id of ['projection', 'ink', 'parchment', 'density', 'names', 'rhumb', 'scale', 'scaleBorder', 'land', 'islands', 'seaTint', 'rivers', 'lakes', 'trees', 'mountains', 'hills', 'continentsZoom', 'regions', 'regionsZoom', 'titleMode', 'townSize']) $(id).addEventListener('input', readControls);
let typing = 0; // a typed title is placed when the typing pauses, not on every key: a placement takes up to a few hundred ms
$('title').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(readControls, 400); });
addEventListener('hashchange', () => { view = viewFromHash(); style = styleFromHash(); selection = selectionFromHash(); showStyle(); showPlacement(); render(); });
showPlacement();
render();
