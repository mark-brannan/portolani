// The webapp: the plugin's ENC cells drawn by portolani's scene, panned and zoomed, with the vessel's
// position from the Signal K stream. The settings drawer stays open; its chips say what they draw.
import { createScene, drawScene, panView, zoomView, clampView, viewProjection, W, H } from 'portolani/scene.mjs';
import { readCatalogue } from './enc-provider.js';
import { CHART_OPTIONS } from './chart.mjs';

const DEFAULTS = { depth: true };
const settings = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('portolani-signalk') ?? '{}') }; } catch { return { ...DEFAULTS }; } })();
const save = () => { try { localStorage.setItem('portolani-signalk', JSON.stringify(settings)); } catch {} };

const empty = { type: 'FeatureCollection', features: [] };
const cache = new Map(), once = (k, f) => cache.get(k) ?? cache.set(k, f()).get(k);
const env = {
  createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
  // no world geo is shipped: the land, coast and depth are the cells', through the adapter
  readJSON: (p) => (p.startsWith('geo/') ? Promise.resolve(empty) : once(p, () => fetch(p).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); }))),
  loadImage: (p) => once(p, () => new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => no(new Error(`${p}: image failed`)); img.src = p; })),
  loadFont: (family) => once('font', async () => document.fonts.add(await new FontFace(family, 'url(font/IMFeENrm28P.ttf)').load())),
};

const map = document.getElementById('map'), marks = document.getElementById('marks'), stage = document.getElementById('stage');
const status = (t) => { document.getElementById('status').textContent = t; };
const RAD = Math.PI / 180, merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
let view = null, vessel = null, drawn = null, drawing = 0;

// the view that holds a bbox [w, s, e, n]
const fit = ([w, s, e, n]) => clampView({ lon: (w + e) / 2, lat: Math.atan(Math.sinh((merc(s) + merc(n)) / 2)) / RAD,
  zoom: Math.min(Math.log2((2 * Math.PI * H) / (512 * (merc(n) - merc(s)))), Math.log2((2 * Math.PI * W) / (512 * (e - w) * RAD))) });

async function render() {
  const n = ++drawing, scale = Math.min(2, devicePixelRatio || 1);
  status('Drawing…');
  const { scene, data, bg } = await createScene(env, { ...CHART_OPTIONS, view, depth: settings.depth });
  if (n !== drawing) return;
  map.width = marks.width = W * scale; map.height = marks.height = H * scale;
  drawScene(map.getContext('2d'), scene, data, bg, { scale, x: 0, y: 0 });
  map.style.transform = marks.style.transform = '';
  drawn = { view, scale };
  drawVessel();
  status(data.land.length ? '' : 'No cell covers this view');
}
let timer = 0;
const later = () => { clearTimeout(timer); timer = setTimeout(render, 150); };

// the vessel: a hull pointed along its course, in red
function drawVessel() {
  const g = marks.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, marks.width, marks.height);
  if (!vessel || !drawn) return;
  const [x, y] = viewProjection(drawn.view).toPx([vessel.lon, vessel.lat]);
  g.setTransform(drawn.scale, 0, 0, drawn.scale, 0, 0); g.translate(x, y); g.rotate(vessel.cog ?? 0);
  g.beginPath(); g.moveTo(0, -12); g.lineTo(7, 9); g.lineTo(0, 5); g.lineTo(-7, 9); g.closePath();
  g.fillStyle = '#8c2f1e'; g.strokeStyle = '#3b2a1a'; g.lineWidth = 1; g.fill(); g.stroke();
}

// drag to pan, the wheel to zoom about the pointer; canvas px are the drawing's, whatever the CSS size
const toCanvas = (dx, dy) => { const r = map.getBoundingClientRect(); return [(dx * W) / r.width, (dy * H) / r.height]; };
let drag = null;
stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; stage.setPointerCapture(e.pointerId); });
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const t = `translate(${e.clientX - drag.x}px, ${e.clientY - drag.y}px)`;
  map.style.transform = marks.style.transform = t;
});
stage.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const [dx, dy] = toCanvas(e.clientX - drag.x, e.clientY - drag.y);
  drag = null;
  if (Math.hypot(dx, dy) > 2) { view = panView(view, dx, dy); later(); }
});
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = map.getBoundingClientRect(), [px, py] = toCanvas(e.clientX - r.left, e.clientY - r.top);
  view = zoomView(view, e.deltaY < 0 ? 1.5 : 1 / 1.5, px, py); later();
}, { passive: false });

const chip = (id, key) => {
  const el = document.getElementById(id), set = () => el.setAttribute('aria-pressed', String(settings[key]));
  const flip = () => { settings[key] = !settings[key]; set(); save(); render(); };
  el.addEventListener('click', flip);
  el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  set();
};
chip('depth', 'depth');
const layers = document.getElementById('layers');
layers.addEventListener('click', () => { const d = document.getElementById('drawer'); d.hidden = !d.hidden; layers.setAttribute('aria-pressed', String(!d.hidden)); });
document.getElementById('vessel').addEventListener('click', () => { if (vessel) { view = clampView({ ...view, lon: vessel.lon, lat: vessel.lat }); render(); } });

// navigation.position and the course from the Signal K stream, the vessel redrawn as they come
function stream() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/signalk/v1/stream?subscribe=none`);
  ws.onopen = () => ws.send(JSON.stringify({ context: 'vessels.self', subscribe: [{ path: 'navigation.position', period: 1000 }, { path: 'navigation.courseOverGroundTrue', period: 1000 }] }));
  ws.onmessage = (m) => {
    for (const u of JSON.parse(m.data).updates ?? []) for (const { path, value } of u.values ?? []) {
      if (path === 'navigation.position' && Number.isFinite(value?.latitude)) vessel = { ...vessel, lat: value.latitude, lon: value.longitude };
      if (path === 'navigation.courseOverGroundTrue' && vessel) vessel.cog = value;
    }
    drawVessel();
  };
  ws.onclose = () => setTimeout(stream, 5000);
}

const cells = Object.values(await readCatalogue());
if (!cells.length) status('No ENC cells yet: give the plugin a folder of .000 cells');
view = cells.length ? fit(cells.sort((a, b) => a.band - b.band)[0].bbox) : clampView({ lon: 0, lat: 30, zoom: 2 });
// a link may name the view, #lon,lat,zoom
const asked = location.hash.slice(1).split(',').map(Number);
if (asked.length === 3 && asked.every(Number.isFinite)) view = clampView({ lon: asked[0], lat: asked[1], zoom: asked[2] });
stream();
render();
