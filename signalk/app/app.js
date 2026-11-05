// The webapp: the plugin's ENC cells drawn by portolani's scene, panned and zoomed, with the vessel's
// position from the Signal K stream. The settings drawer stays open; its chips say what they draw.
import { createScene, drawScene, panView, zoomView, clampView, viewProjection, drawnPeaks, peakHits, W, H } from 'portolani/scene.mjs';
import { readCatalogue, drawnFrom } from './enc-provider.js';
import { CHART_OPTIONS, CHART_GEO, MOUNTAINS } from './chart.mjs';

const DEFAULTS = { depth: true, mountains: true, peaks: true };
const settings = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('portolani-signalk') ?? '{}') }; } catch { return { ...DEFAULTS }; } })();
const save = () => { try { localStorage.setItem('portolani-signalk', JSON.stringify(settings)); } catch {} };

const empty = { type: 'FeatureCollection', features: [] };
const cache = new Map(), once = (k, f) => cache.get(k) ?? cache.set(k, f()).get(k);
const env = {
  createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
  // of the world geo only the 50m land and coast, the ranges and the peaks are shipped: the depth is the cells', through the adapter
  readJSON: (p) => (p.startsWith('geo/') && !CHART_GEO.includes(p) ? Promise.resolve(empty) : once(p, () => fetch(p).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); }))),
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
  try {
    // the mountains chip is the ranges and the hills; the peaks stand the mountain sprites too
    const kinds = CHART_OPTIONS.kinds.filter((k) => k !== 'mountain' || settings.mountains || settings.peaks);
    const { scene, data, bg } = await createScene(env, { ...CHART_OPTIONS, kinds, view, depth: settings.depth, relief: settings.mountains ? MOUNTAINS : [], peaks: settings.peaks });
    if (n !== drawing) return;
    map.width = marks.width = W * scale; map.height = marks.height = H * scale;
    drawScene(map.getContext('2d'), scene, data, bg, { scale, x: 0, y: 0 });
    map.style.transform = marks.style.transform = '';
    drawn = { view, scale, peaks: drawnPeaks(scene, data) };
    hideTile();
    drawVessel();
    status(!opening ? 'No ENC cells yet: give the plugin a folder of .000 cells' : drawnFrom.cells ? '' : 'No cell covers this view: the coast is Natural Earth 50m');
  } catch (e) { if (n === drawing) status(`Could not draw: ${e.message}`); }
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
  if (Math.hypot(dx, dy) > 2) { view = panView(view, dx, dy); later(); } else peakAt(e);
});

// a tap on a landmark peak's drawing opens its tile, the name and the height, as on the page
const tile = document.getElementById('tile');
function hideTile() { tile.hidden = true; }
function peakAt(e) {
  hideTile();
  if (!drawn?.peaks.length) return;
  const r = map.getBoundingClientRect(), [x, y] = toCanvas(e.clientX - r.left, e.clientY - r.top);
  const hit = peakHits(drawn.peaks, viewProjection(drawn.view), { x0: 0, y0: 0, x1: W, y1: H })
    .filter((m) => x >= m.hit[0][0] && x <= m.hit[1][0] && y >= m.hit[0][1] && y <= m.hit[2][1]).sort((a, b) => a.area - b.area)[0];
  if (!hit) return;
  tile.querySelector('b').textContent = hit.tile.title;
  tile.querySelector('span').textContent = hit.tile.date;
  const s = stage.getBoundingClientRect();
  tile.style.left = `${r.left - s.left + (hit.x * r.width) / W + 12}px`; tile.style.top = `${r.top - s.top + (hit.y * r.height) / H - 12}px`;
  tile.hidden = false;
}
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
chip('mountains', 'mountains');
chip('peaks', 'peaks');
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

// the first cell with an extent, coarsest band first, frames the opening view
const first = (cat) => Object.values(cat).filter((c) => c.bbox).sort((a, b) => a.band - b.band)[0];
let opening = first(await readCatalogue());
view = opening ? fit(opening.bbox) : clampView({ lon: 0, lat: 30, zoom: 2 });
// a link may name the view, #lon,lat,zoom
const asked = location.hash.slice(1).split(',').map(Number), named = asked.length === 3 && asked.every(Number.isFinite);
if (named) view = clampView({ lon: asked[0], lat: asked[1], zoom: asked[2] });
stream();
render();
// no cells yet, perhaps still converting: ask again every 5 s, and draw them when they come
if (!opening) {
  const poll = setInterval(async () => {
    opening = first(await readCatalogue());
    if (!opening) return;
    clearInterval(poll);
    if (!named) view = fit(opening.bbox);
    render();
  }, 5000);
}
