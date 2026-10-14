// Browser host for the shared scene code (scene.mjs): same scene as `npm run render`, drawn live.
// Drag to pan, wheel or pinch to zoom; while the map moves only land and coast are drawn, and the
// ornaments are placed again when it stops. The view and the style are kept in the URL hash, e.g.
// #map=zoom/lat/lon&projection=miller&rendering=scanned&rose=aguiar&monster=carta-marina&town=aguiar&kinds=rose,ship&names=0&rhumb=0&scale=chevron&continents=1&regions=latin&autotitle=0&title=Mare+Nostrum&ink=5a1a1a&parchment=eee&density=1.5;
// a setting left at its default is left out. The older `pack=` key is read as a rendering, so old links still work.
import { createScene, REGION_LANGS, drawScene, drawGround, panView, zoomView, clampView, covers, DEFAULT_VIEW, RENDERINGS, KINDS, listStyles, PROJECTION_NAMES, SCALE_NAMES, W, H } from './scene.mjs';

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

const DEFAULTS = { ink: '#3b2a1a', parchment: '#e9d8b4', density: 1, rendering: 'vivid', rose: 'aguiar', monster: 'carta-marina', town: 'tower', kinds: KINDS, names: true, rhumb: true, scale: 'genoese', continents: false, regions: 'off', title: 'PORTOLANI', autoTitle: true };
// the styles the packs offer fill their selects; only the manifests are read
const STYLES = await listStyles(env);
for (const k of ['rose', 'monster', 'town']) {
  for (const v of STYLES[k]) $(k).append(new Option(v === 'tower' ? 'Tower (drawn in code)' : v, v));
}
const LEGACY_PACK = { all: 'vivid', vivid: 'vivid', catalan: 'scanned', 'carta-marina': 'scanned', plain: 'plain' };
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
    rendering: RENDERINGS.includes(q.get('rendering')) ? q.get('rendering') : LEGACY_PACK[q.get('pack')] ?? DEFAULTS.rendering,
    ...Object.fromEntries(['rose', 'monster', 'town'].map((k) => [k, STYLES[k].includes(q.get(k)) ? q.get(k) : DEFAULTS[k]])),
    kinds: q.has('kinds') ? KINDS.filter((k) => q.get('kinds').split(',').includes(k)) : DEFAULTS.kinds,
    names: q.get('names') !== '0',
    rhumb: q.get('rhumb') !== '0',
    continents: q.get('continents') === '1',
    regions: REGION_LANGS.includes(q.get('regions')) ? q.get('regions') : DEFAULTS.regions,
    title: q.get('title') ?? DEFAULTS.title,
    // a link from before automatic was the default, with a title and no autotitle, keeps its title
    autoTitle: q.has('autotitle') ? q.get('autotitle') === '1' : !q.has('title') && DEFAULTS.autoTitle,
    scale: q.get('scale') === 'off' || SCALE_NAMES.includes(q.get('scale')) ? q.get('scale') : DEFAULTS.scale,
  };
}
function writeHash() {
  const q = new URLSearchParams(), v = view, st = style;
  q.set('map', `${v.zoom.toFixed(2)}/${v.lat.toFixed(3)}/${v.lon.toFixed(3)}`);
  if (v.projection !== PROJECTION_NAMES[0]) q.set('projection', v.projection);
  for (const k of ['rendering', 'rose', 'monster', 'town']) if (st[k] !== DEFAULTS[k]) q.set(k, st[k]);
  if (st.kinds.join() !== KINDS.join()) q.set('kinds', st.kinds.join());
  if (!st.names) q.set('names', '0');
  if (!st.rhumb) q.set('rhumb', '0');
  if (st.continents) q.set('continents', '1');
  if (st.regions !== DEFAULTS.regions) q.set('regions', st.regions);
  // a title without autotitle reads as custom (readHash), so a typed title carries the mode with it
  if (st.autoTitle !== DEFAULTS.autoTitle || st.title !== DEFAULTS.title) q.set('autotitle', st.autoTitle ? '1' : '0');
  if (st.title !== DEFAULTS.title) q.set('title', st.title);
  if (st.scale !== DEFAULTS.scale) q.set('scale', st.scale);
  if (st.density !== DEFAULTS.density) q.set('density', st.density);
  if (st.ink !== DEFAULTS.ink) q.set('ink', st.ink.slice(1));
  if (st.parchment !== DEFAULTS.parchment) q.set('parchment', st.parchment.slice(1));
  history.replaceState(null, '', `#${q.toString().replaceAll('%2C', ',').replaceAll('%2F', '/')}`);
}

// the controls show the style; the plain rendering has no ships or monsters to switch
function showStyle() {
  $('projection').value = view.projection;
  $('ink').value = style.ink; $('parchment').value = style.parchment;
  $('density').value = style.density; $('densityOut').textContent = style.density;
  for (const k of ['rendering', 'rose', 'monster', 'town']) $(k).value = style[k];
  $('names').checked = style.names; $('rhumb').checked = style.rhumb; $('scale').value = style.scale;
  $('continents').checked = style.continents; $('regions').value = style.regions;
  $('titleMode').value = style.autoTitle ? 'auto' : 'custom'; $('title').value = style.title; $('title').disabled = style.autoTitle;
  for (const k of KINDS) {
    const box = $(`kind-${k}`);
    box.checked = style.kinds.includes(k);
    box.disabled = (k === 'ship' || k === 'monster') && style.rendering === 'plain';
  }
}
function readControls() {
  style = {
    ink: $('ink').value, parchment: $('parchment').value, density: Number($('density').value),
    rendering: $('rendering').value, rose: $('rose').value, monster: $('monster').value, town: $('town').value, kinds: KINDS.filter((k) => $(`kind-${k}`).checked), names: $('names').checked, rhumb: $('rhumb').checked, scale: $('scale').value,
    continents: $('continents').checked, regions: $('regions').value,
    title: $('title').value, autoTitle: $('titleMode').value === 'auto',
  };
  view = clampView({ ...view, projection: $('projection').value });
  showStyle();
  writeHash();
  render();
}

let view = viewFromHash();
let style = styleFromHash();
showStyle();
let ground = null; // { world, coarse, bg } from the last placement, all a moving frame needs
let placed = null; // the view the canvas shows with its ornaments
let run = 0;

async function render() {
  const me = ++run;
  try {
    const t0 = performance.now();
    const { scene, data, bg, world, coarse, timing } = await createScene(env, {
      ...style, view,
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

for (const id of ['projection', 'ink', 'parchment', 'density', 'rendering', 'rose', 'monster', 'town', 'names', 'rhumb', 'scale', 'continents', 'regions', 'titleMode', 'title', ...KINDS.map((k) => `kind-${k}`)]) $(id).addEventListener('input', readControls);
addEventListener('hashchange', () => { view = viewFromHash(); style = styleFromHash(); showStyle(); render(); });
render();
