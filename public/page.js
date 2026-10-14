// Browser host for the shared scene code (scene.mjs): same scene as `npm run render`, drawn live.
// Drag to pan, wheel or pinch to zoom; while the map moves only land and coast are drawn, and the
// ornaments are placed again when it stops. The view is kept in the URL as #map=zoom/lat/lon.
import { createScene, drawScene, drawGround, panView, zoomView, clampView, DEFAULT_VIEW, W, H } from './scene.mjs';

const memo = new Map();
const once = (key, make) => { if (!memo.has(key)) memo.set(key, make()); return memo.get(key); };

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

function viewFromHash() {
  const m = /^#map=(-?[\d.]+)\/(-?[\d.]+)\/(-?[\d.]+)$/.exec(location.hash);
  return m ? clampView({ zoom: Number(m[1]), lat: Number(m[2]), lon: Number(m[3]) }) : DEFAULT_VIEW;
}
const writeHash = (v) => history.replaceState(null, '', `#map=${v.zoom.toFixed(2)}/${v.lat.toFixed(3)}/${v.lon.toFixed(3)}`);

let view = viewFromHash();
let ground = null; // { world, bg } from the last placement, all a moving frame needs
let run = 0;

async function render() {
  const me = ++run;
  $('densityOut').textContent = $('density').value;
  try {
    const t0 = performance.now();
    const { scene, data, bg, world, timing } = await createScene(env, {
      ink: $('ink').value, parchment: $('parchment').value, density: Number($('density').value), view,
    });
    if (me !== run) return; // a newer change or a move superseded this one
    ground = { world, bg };
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
  view = next;
  run++; // a placement still in flight is for a view already left
  clearTimeout(settle);
  if (!ground || frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const t = performance.now();
    drawGround(ctx, ground.world, view, ground.bg);
    $('status').textContent = `z${view.zoom.toFixed(1)}: moving, frame ${(performance.now() - t).toFixed(0)} ms`;
  });
}
function stopped(delay = 0) {
  clearTimeout(settle);
  settle = setTimeout(() => { writeHash(view); render(); }, delay);
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

for (const id of ['ink', 'parchment', 'density']) $(id).addEventListener('input', render);
addEventListener('hashchange', () => { view = viewFromHash(); render(); });
render();
