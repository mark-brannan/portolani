// Browser host for the shared scene code (scene.mjs): same scene as `npm run render`, drawn live.
// Drag to pan, wheel or pinch to zoom; while the map moves only land and coast are drawn, and the
// ornaments are placed again when it stops. The view and the style are kept in the URL hash, e.g.
// #map=zoom/lat/lon&pack=plain&kinds=rose,ship&names=0&rhumb=0&ink=5a1a1a&parchment=eee&density=1.5;
// a setting left at its default is left out.
import { createScene, drawScene, drawGround, panView, zoomView, clampView, covers, DEFAULT_VIEW, PACKS, KINDS, W, H } from './scene.mjs';

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
    const face = new FontFace(family, 'url(font/IMFeENrm28P.ttf)');
    document.fonts.add(await face.load());
  }),
};

const $ = (id) => document.getElementById(id);
const canvas = $('map'), ctx = canvas.getContext('2d');

const DEFAULTS = { ink: '#3b2a1a', parchment: '#e9d8b4', density: 1, pack: 'all', kinds: KINDS, names: true, rhumb: true };
const hashParams = () => new URLSearchParams(location.hash.slice(1));

function viewFromHash() {
  const m = /^(-?[\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)$/.exec(hashParams().get('map') ?? '');
  if (!m) return DEFAULT_VIEW;
  const v = { zoom: Number(m[1]), lat: Number(m[2]), lon: Number(m[3]) };
  return Object.values(v).every(Number.isFinite) ? clampView(v) : DEFAULT_VIEW; // e.g. #map=1.2.3/40/5
}
const hex = (v, fallback) => (/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(v ?? '') ? `#${v.length === 3 ? [...v].map((c) => c + c).join('') : v}`.toLowerCase() : fallback);
function styleFromHash() {
  const q = hashParams(), density = Number(q.get('density') ?? DEFAULTS.density);
  return {
    ink: hex(q.get('ink'), DEFAULTS.ink),
    parchment: hex(q.get('parchment'), DEFAULTS.parchment),
    density: density >= 0 && density <= 2 ? density : DEFAULTS.density,
    pack: PACKS.includes(q.get('pack')) ? q.get('pack') : DEFAULTS.pack,
    kinds: q.has('kinds') ? KINDS.filter((k) => q.get('kinds').split(',').includes(k)) : DEFAULTS.kinds,
    names: q.get('names') !== '0',
    rhumb: q.get('rhumb') !== '0',
  };
}
function writeHash() {
  const q = new URLSearchParams(), v = view, st = style;
  q.set('map', `${v.zoom.toFixed(2)}/${v.lat.toFixed(3)}/${v.lon.toFixed(3)}`);
  if (st.pack !== DEFAULTS.pack) q.set('pack', st.pack);
  if (st.kinds.join() !== KINDS.join()) q.set('kinds', st.kinds.join());
  if (!st.names) q.set('names', '0');
  if (!st.rhumb) q.set('rhumb', '0');
  if (st.density !== DEFAULTS.density) q.set('density', st.density);
  if (st.ink !== DEFAULTS.ink) q.set('ink', st.ink.slice(1));
  if (st.parchment !== DEFAULTS.parchment) q.set('parchment', st.parchment.slice(1));
  history.replaceState(null, '', `#${q.toString().replaceAll('%2C', ',').replaceAll('%2F', '/')}`);
}

// the controls show the style; a plain pack has no ships or monsters to switch
function showStyle() {
  $('ink').value = style.ink; $('parchment').value = style.parchment;
  $('density').value = style.density; $('densityOut').textContent = style.density;
  $('pack').value = style.pack; $('names').checked = style.names; $('rhumb').checked = style.rhumb;
  for (const k of KINDS) {
    const box = $(`kind-${k}`);
    box.checked = style.kinds.includes(k);
    box.disabled = (k === 'ship' || k === 'monster') && (style.pack === 'plain' || style.pack === 'catalan');
  }
}
function readControls() {
  style = {
    ink: $('ink').value, parchment: $('parchment').value, density: Number($('density').value),
    pack: $('pack').value, kinds: KINDS.filter((k) => $(`kind-${k}`).checked), names: $('names').checked, rhumb: $('rhumb').checked,
  };
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

for (const id of ['ink', 'parchment', 'density', 'pack', 'names', 'rhumb', ...KINDS.map((k) => `kind-${k}`)]) $(id).addEventListener('input', readControls);
addEventListener('hashchange', () => { view = viewFromHash(); style = styleFromHash(); showStyle(); render(); });
render();
