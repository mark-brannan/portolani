// Browser host for the shared scene code (scene.mjs): same scene as `npm run render`, drawn live.
// Drag to pan, wheel or pinch to zoom; while the map moves only land and coast are drawn, and the
// ornaments are placed again when it stops. The settings live in a drawer behind the rose button, so
// the map has the window. The view and the style are kept in the URL hash, e.g.
// #map=zoom/lat/lon&projection=miller&sprites=s:serpent-a,v:kraken,v:rose-aguiar,p:tower&townsize=rank&names=0&rhumb=0&scale=chevron&continents=1&regions=latin&land=green&rivers=aguiar&lakes=marina&redsea=1&autotitle=0&title=Mare+Nostrum&ink=5a1a1a&parchment=eee&density=1.5;
// a setting left at its default is left out, `sprites` too (keys with the pack shortened, v: s: p:).
// Older links naming a `rendering` (or `pack`), `rose`, `monster`, `town` and `kinds` open as the
// selection those chose, and are written back in the new form.
import { createScene, towerGlyph, REGION_LANGS, drawScene, drawGround, panView, zoomView, clampView, covers, DEFAULT_VIEW, RENDERINGS, KINDS, DEFAULT_KINDS, LANDS, RIVER_STYLES, LAKE_STYLES, TOWN_SIZES, readManifests, listSprites, defaultSprites, chooseSprites, PROJECTION_NAMES, SCALE_NAMES, W, H } from './scene.mjs';

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

const DEFAULTS = { ink: '#3b2a1a', parchment: '#e9d8b4', density: 1, names: true, rhumb: true, scale: 'genoese', continents: true, regions: 'latin', title: 'PORTOLANI', autoTitle: true, land: 'ochre', rivers: 'plain', lakes: 'marina', redSea: false, townSize: TOWN_SIZES[0] };

// ---------------------------------------------------------------- the sprites on offer

// Every sprite of a kind the scene places, from the manifests alone: a sprite added to a pack shows up here.
const MANIFESTS = await readManifests(env);
const SPRITES = (await listSprites(env)).filter((s) => KINDS.includes(s.kind) || s.kind === 'town');
const BY_KEY = new Map(SPRITES.map((s) => [s.key, s]));
// the scene's default selection
const DEFAULT_SELECTION = defaultSprites(SPRITES);
const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));

// keys in the hash: the pack shortened (v:rose-aguiar); a pack with no short name is written whole
const SHORT = { vivid: 'v', scanned: 's', plain: 'p' };
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
const hex = (v, fallback) => (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(v ?? '') ? `#${v.length === 3 ? [...v].map((c) => c + c).join('') : v}`.toLowerCase() : fallback);
function styleFromHash() {
  const q = hashParams(), density = Number(q.get('density') ?? DEFAULTS.density);
  return {
    ink: hex(q.get('ink'), DEFAULTS.ink),
    parchment: hex(q.get('parchment'), DEFAULTS.parchment),
    density: density >= 0 && density <= 2 ? density : DEFAULTS.density,
    names: q.get('names') !== '0',
    rhumb: q.get('rhumb') !== '0',
    continents: q.has('continents') ? q.get('continents') === '1' : DEFAULTS.continents,
    regions: REGION_LANGS.includes(q.get('regions')) ? q.get('regions') : DEFAULTS.regions,
    title: q.get('title') ?? DEFAULTS.title,
    // a link from before automatic was the default, with a title and no autotitle, keeps its title
    autoTitle: q.has('autotitle') ? q.get('autotitle') === '1' : !q.has('title') && DEFAULTS.autoTitle,
    land: LANDS.includes(q.get('land')) ? q.get('land') : DEFAULTS.land,
    rivers: RIVER_STYLES.includes(q.get('rivers')) ? q.get('rivers') : DEFAULTS.rivers,
    lakes: LAKE_STYLES.includes(q.get('lakes')) ? q.get('lakes') : DEFAULTS.lakes,
    redSea: q.get('redsea') === '1',
    scale: q.get('scale') === 'off' || SCALE_NAMES.includes(q.get('scale')) ? q.get('scale') : DEFAULTS.scale,
    townSize: TOWN_SIZES.includes(q.get('townsize')) ? q.get('townsize') : DEFAULTS.townSize,
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
  if (st.continents !== DEFAULTS.continents) q.set('continents', st.continents ? '1' : '0');
  if (st.regions !== DEFAULTS.regions) q.set('regions', st.regions);
  // a title without autotitle reads as custom (styleFromHash), so a typed title carries the mode with it
  if (st.autoTitle !== DEFAULTS.autoTitle || st.title !== DEFAULTS.title) q.set('autotitle', st.autoTitle ? '1' : '0');
  if (st.title !== DEFAULTS.title) q.set('title', st.title);
  if (st.land !== DEFAULTS.land) q.set('land', st.land);
  if (st.rivers !== DEFAULTS.rivers) q.set('rivers', st.rivers);
  if (st.lakes !== DEFAULTS.lakes) q.set('lakes', st.lakes);
  if (st.redSea) q.set('redsea', '1');
  if (st.scale !== DEFAULTS.scale) q.set('scale', st.scale);
  if (st.density !== DEFAULTS.density) q.set('density', st.density);
  if (st.ink !== DEFAULTS.ink) q.set('ink', st.ink.slice(1));
  if (st.parchment !== DEFAULTS.parchment) q.set('parchment', st.parchment.slice(1));
  history.replaceState(null, '', `#${q.toString().replaceAll('%2C', ',').replaceAll('%2F', '/').replaceAll('%3A', ':')}`);
}

// ---------------------------------------------------------------- the pickers

// A family is a style drawn one way: "Carta Marina · scan" beside "Carta Marina · drawn".
const HOW = { scanned: 'scan', vivid: 'drawn', plain: 'drawn in code' };
const PACK_ORDER = ['scanned', 'vivid', 'plain'];
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
for (const kind of ['monster', 'ship', 'rose', 'town', 'mountain']) {
  for (const fam of familiesOf(kind)) {
    const row = document.createElement('div'), head = document.createElement('label'), box = document.createElement('input'), count = document.createElement('span'), thumbs = document.createElement('div');
    row.className = 'family'; head.className = 'fam'; count.className = 'count'; thumbs.className = 'thumbs';
    box.type = 'checkbox';
    head.append(box, fam.label, count);
    thumbs.append(...fam.sprites.map((s) => thumb(s, fam.label)));
    row.append(head, thumbs);
    $(`pick-${kind}`).append(row);
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

// ---------------------------------------------------------------- the controls

// the controls show the style and the selection
function showStyle() {
  $('projection').value = view.projection;
  $('ink').value = style.ink; $('parchment').value = style.parchment;
  $('density').value = style.density; $('densityOut').textContent = style.density;
  $('names').checked = style.names; $('rhumb').checked = style.rhumb; $('scale').value = style.scale;
  $('land').value = style.land; $('rivers').value = style.rivers; $('lakes').value = style.lakes; $('redSea').checked = style.redSea;
  $('continents').checked = style.continents; $('regions').value = style.regions;
  $('titleMode').value = style.autoTitle ? 'auto' : 'custom'; $('title').value = style.title; $('title').disabled = style.autoTitle;
  $('townSize').checked = style.townSize !== 'rank';
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
    names: $('names').checked, rhumb: $('rhumb').checked, scale: $('scale').value,
    land: $('land').value, rivers: $('rivers').value, lakes: $('lakes').value, redSea: $('redSea').checked,
    continents: $('continents').checked, regions: $('regions').value,
    title: $('title').value, autoTitle: $('titleMode').value === 'auto',
    // checked, by metro area; a link's townsize=population is kept until the box is touched
    townSize: $('townSize').checked ? (style.townSize === 'rank' ? 'area' : style.townSize) : 'rank',
  };
  view = clampView({ ...view, projection: $('projection').value });
  changed();
}
function changed() {
  showStyle();
  writeHash();
  render();
}

let view = viewFromHash();
let style = styleFromHash();
let selection = selectionFromHash();
showStyle();
if (LEGACY_KEYS.some((k) => hashParams().has(k))) writeHash(); // an older link, rewritten in the new form
let ground = null; // { world, coarse, bg } from the last placement, all a moving frame needs
let placed = null; // the view the canvas shows with its ornaments
let run = 0;

async function render() {
  const me = ++run;
  try {
    const t0 = performance.now();
    // a kind is drawn while any of its sprites is selected
    const kinds = KINDS.filter((k) => SPRITES.some((s) => s.kind === k && selection.has(s.key)));
    const { scene, data, bg, world, coarse, timing } = await createScene(env, {
      ...style, sprites: [...selection], kinds, view,
    });
    if (me !== run) return; // a newer change or a move superseded this one
    ground = { world, coarse, bg };
    placed = view;
    const t1 = performance.now();
    ctx.clearRect(0, 0, W, H);
    drawScene(ctx, scene, data, bg, { scale: 1, x: 0, y: 0 });
    const t2 = performance.now();
    $('status').textContent = `z${view.zoom.toFixed(1)}: load ${timing.load.toFixed(0)} ms, placement + parchment ${timing.place.toFixed(0)} ms, draw ${(t2 - t1).toFixed(0)} ms (total ${(t2 - t0).toFixed(0)} ms)`;
  } catch (e) {
    $('status').textContent = `Failed: ${e.message}`;
    throw e;
  }
}

// ---------------------------------------------------------------- the drawer

// Shut by default; Esc, the close button or a touch on the map shuts it, and focus goes back to the rose button.
const drawer = $('drawer'), opener = $('open');
const isOpen = () => drawer.classList.contains('open');
function setDrawer(open) {
  if (open === isOpen()) return;
  drawer.classList.toggle('open', open);
  opener.setAttribute('aria-expanded', String(open));
  (open ? $('close') : opener).focus({ preventScroll: true });
}
opener.addEventListener('click', () => setDrawer(!isOpen()));
$('close').addEventListener('click', () => setDrawer(false));
addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) setDrawer(false); });
canvas.addEventListener('pointerdown', () => setDrawer(false));

// ---------------------------------------------------------------- moving

let frame = 0, settle = 0;
function moved(next) {
  if (next.zoom === view.zoom && next.lon === view.lon && next.lat === view.lat) return; // e.g. wheel at a zoom bound
  view = next;
  run++; // a placement still in flight is for a view already left
  clearTimeout(settle);
  if (!ground || frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const t = performance.now();
    // the 10m cells placed last while they cover the view; 50m otherwise, until it stops and is placed again
    drawGround(ctx, covers(ground.world, view) ? ground.world : ground.coarse, view, ground.bg);
    $('status').textContent = `z${view.zoom.toFixed(1)}: moving, frame ${(performance.now() - t).toFixed(0)} ms`;
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
  const [x, y] = toCanvas(e.clientX, e.clientY);
  const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines to px
  moved(zoomView(view, 2 ** (-px / 300), x, y));
  stopped(300);
}, { passive: false });

for (const id of ['projection', 'ink', 'parchment', 'density', 'names', 'rhumb', 'scale', 'land', 'rivers', 'lakes', 'redSea', 'continents', 'regions', 'titleMode', 'title', 'townSize']) $(id).addEventListener('input', readControls);
addEventListener('hashchange', () => { view = viewFromHash(); style = styleFromHash(); selection = selectionFromHash(); showStyle(); render(); });
render();
