// The webapp: the plugin's ENC cells drawn by portolani's scene, panned and zoomed, with the vessel's
// position from the Signal K stream. The settings drawer is open at start; its chips show what they draw.
import { createScene, drawScene, panView, zoomView, clampView, viewProjection, drawnPeaks, peakHits, listSprites, peakInkSvg, W, H } from 'portolani/scene.mjs';
import { readCatalogue, cellData, frameView, drawnFrom } from './enc-provider.js';
import { CHART_GEO, ROSES, TOWNS, MONSTERS, chartOptions, readSettings, chipSprite } from './chart.mjs';

const settings = (() => { try { return readSettings(JSON.parse(localStorage.getItem('portolani-signalk') ?? '{}')); } catch { return readSettings({}); } })();
const save = () => { try { localStorage.setItem('portolani-signalk', JSON.stringify(settings)); } catch {} };

const empty = { type: 'FeatureCollection', features: [] };
const cache = new Map(), once = (k, f) => cache.get(k) ?? cache.set(k, f()).get(k);
const env = {
  createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
  // of the world geo only the 50m land and coast, the ranges and the peaks are shipped: the depth, towns and water names are the cells', through the adapter
  readJSON: (p) => (p.startsWith('geo/') && !CHART_GEO.includes(p) ? Promise.resolve(empty) : once(p, () => fetch(p).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); }))),
  loadImage: (p) => once(p, () => new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => no(new Error(`${p}: image failed`)); img.src = p; })),
  loadFont: (family) => once('font', async () => document.fonts.add(await new FontFace(family, 'url(font/IMFeENrm28P.ttf)').load())),
};
const sprites = listSprites(env); // the shipped packs' sprites, for the drawer's chips and the scene's selection

const map = document.getElementById('map'), marks = document.getElementById('marks'), stage = document.getElementById('stage');
const status = (t) => { document.getElementById('status').textContent = t; };
const RAD = Math.PI / 180, merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
let view = null, vessel = null, drawn = null, drawing = 0, aim = 0; // `aim`: the bearing the latest render draws

// the view that holds a bbox [w, s, e, n]
const fit = ([w, s, e, n]) => clampView({ lon: (w + e) / 2, lat: Math.atan(Math.sinh((merc(s) + merc(n)) / 2)) / RAD,
  zoom: Math.min(Math.log2((2 * Math.PI * H) / (512 * (merc(n) - merc(s)))), Math.log2((2 * Math.PI * W) / (512 * (e - w) * RAD))) });

// north up, or course up: the vessel's course over ground at the top of the window
const cogDeg = () => (Number.isFinite(vessel?.cog) ? ((vessel.cog / RAD) % 360 + 360) % 360 : 0);
const oriented = (v) => clampView({ ...v, bearing: settings.courseUp ? cogDeg() : 0 });

async function render() {
  const n = ++drawing, scale = Math.min(2, devicePixelRatio || 1);
  status('Drawing…');
  try {
    view = oriented(view); aim = view.bearing ?? 0;
    const cells = await cellData(frameView(view, viewProjection(view).invert, W, H));
    const { scene, data, bg } = await createScene(env, { ...chartOptions(settings, await sprites, cells), view });
    if (n !== drawing) return;
    map.width = marks.width = W * scale; map.height = marks.height = H * scale;
    drawScene(map.getContext('2d'), scene, data, bg, { scale, x: 0, y: 0 });
    map.style.transform = marks.style.transform = '';
    drawn = { view, scale, peaks: drawnPeaks(scene, data) };
    hideTile();
    drawVessel();
    if (swung()) later(); // the course came while drawing
    status(!opening ? 'No ENC cells yet: give the plugin a folder of .000 cells' : drawnFrom.cells ? '' : 'No cell covers this view: the coast is Natural Earth 50m');
  } catch (e) { if (n === drawing) status(`Could not draw: ${e.message}`); }
}
let timer = 0;
const later = () => { clearTimeout(timer); timer = setTimeout(render, 150); };

// the vessel: a hull pointed along its course, in red, turned with the chart
function drawVessel() {
  const g = marks.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, marks.width, marks.height);
  if (!vessel || !drawn) return;
  const [x, y] = viewProjection(drawn.view).toPx([vessel.lon, vessel.lat]);
  g.setTransform(drawn.scale, 0, 0, drawn.scale, 0, 0); g.translate(x, y); g.rotate((vessel.cog ?? 0) - (drawn.view.bearing ?? 0) * RAD);
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

// The drawer's chips: a switch flips a setting; a choice in a group (`radio`) sets it; a town style toggles in its list
const pressable = (el, act) => {
  el.addEventListener('click', act);
  el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); act(); } });
};
const changed = () => { save(); paint(); render(); };
const painters = [];
const paint = () => painters.forEach((p) => p());
const chip = (id, key) => {
  const el = document.getElementById(id);
  painters.push(() => el.setAttribute('aria-pressed', String(settings[key])));
  pressable(el, () => { settings[key] = !settings[key]; changed(); });
};
chip('depth', 'depth');
chip('mountains', 'mountains');
chip('peaks', 'peaks');
chip('cartouche', 'cartouche');
document.getElementById('peak-glyph').innerHTML = peakInkSvg();
const NONE = '<svg width="30" height="24" viewBox="0 0 30 24"><circle cx="15" cy="12" r="7" fill="none" stroke="#3b2a1a" stroke-width="1.2"/><path d="M10 17l10-10" stroke="#3b2a1a" stroke-width="1.2"/></svg>';
const picture = (s) => (s ? `<img alt="" src="packs/${s.pack}/${s.file}">` : NONE);
const title = (t) => t[0].toUpperCase() + t.slice(1);
// one chip of a group: `on()` says whether it is pressed, `act` what a press does
function groupChip(row, label, pic, tip, on, act, role = 'radio') {
  const el = Object.assign(document.createElement('div'), { className: 'chip', tabIndex: 0, title: tip, innerHTML: `${pic}<span>${label}</span>` });
  el.setAttribute('role', role);
  row.append(el);
  painters.push(() => { el.setAttribute('aria-pressed', String(on())); if (role === 'radio') el.setAttribute('aria-checked', String(on())); });
  pressable(el, act);
}
sprites.then((list) => {
  document.querySelector('#cartouche img').src = (({ pack, file }) => `packs/${pack}/${file}`)(list.find((s) => s.pack === 'vivid' && s.kind === 'cartouche'));
  const roses = document.getElementById('roses'), towns = document.getElementById('towns'), monsters = document.getElementById('monsters');
  groupChip(roses, 'None', NONE, 'No rose', () => settings.rose === 'off', () => { settings.rose = 'off'; changed(); });
  for (const r of ROSES) groupChip(roses, title(r), picture(chipSprite(list, 'rose', r)), `The ${title(r)} rose`, () => settings.rose === r, () => { settings.rose = r; changed(); });
  for (const t of TOWNS) groupChip(towns, title(t), picture(chipSprite(list, 'town', t)), `${title(t)}'s towns on the built-up areas`, () => settings.towns.includes(t),
    () => { settings.towns = settings.towns.includes(t) ? settings.towns.filter((x) => x !== t) : [...settings.towns, t]; changed(); }, 'switch');
  groupChip(monsters, 'None', NONE, 'No monster', () => settings.monster === 'off', () => { settings.monster = 'off'; changed(); });
  for (const [m, pack] of Object.entries(MONSTERS)) groupChip(monsters, m === 'pare' ? 'Paré' : title(m), picture(chipSprite(list, 'monster', m, pack)),
    m === 'pare' ? "Paré's monsters, scanned" : 'The heraldic monsters, drawn', () => settings.monster === m, () => { settings.monster = m; changed(); });
  paint();
});
paint();

// the gutter: the drawer, north up or course up, and the vessel
const layers = document.getElementById('layers'), drawer = document.getElementById('drawer');
drawer.hidden = false; layers.setAttribute('aria-pressed', 'true'); // the drawer is open at start
layers.addEventListener('click', () => { drawer.hidden = !drawer.hidden; layers.setAttribute('aria-pressed', String(!drawer.hidden)); });
const COMPASS = '<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M10 3l2.4 7h-4.8Z" fill="#8c2f1e"/><path d="M10 17l2.4-7h-4.8Z" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
const ROTATE = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M16 10a6 6 0 1 1-2-4.5"/><path d="M14.5 2.5v3.5H11"/><path d="M10 7l2 5-2-1.2L8 12Z" fill="#8c2f1e" stroke="none"/></svg>';
const north = document.getElementById('north');
painters.push(() => {
  north.innerHTML = settings.courseUp ? ROTATE : COMPASS;
  north.setAttribute('aria-pressed', String(settings.courseUp));
  north.title = settings.courseUp ? 'Course up (tap for north up)' : 'North up (tap for course up)';
  north.setAttribute('aria-label', north.title);
});
north.addEventListener('click', () => { settings.courseUp = !settings.courseUp; changed(); });
paint();
document.getElementById('vessel').addEventListener('click', () => { if (vessel) { view = clampView({ ...view, lon: vessel.lon, lat: vessel.lat }); render(); } });

// navigation.position and the course from the Signal K stream, the vessel redrawn as they come; course up
// turns the chart again once the course has swung TURN degrees from the bearing being drawn (`aim`, the
// latest render's), so a slow draw in flight is not thrown away by each message of a turn
const TURN = 5;
const swung = () => settings.courseUp && Math.abs((((cogDeg() - aim) % 360) + 540) % 360 - 180) > TURN;
function stream() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/signalk/v1/stream?subscribe=none`);
  ws.onopen = () => ws.send(JSON.stringify({ context: 'vessels.self', subscribe: [{ path: 'navigation.position', period: 1000 }, { path: 'navigation.courseOverGroundTrue', period: 1000 }] }));
  ws.onmessage = (m) => {
    for (const u of JSON.parse(m.data).updates ?? []) for (const { path, value } of u.values ?? []) {
      if (path === 'navigation.position' && Number.isFinite(value?.latitude)) vessel = { ...vessel, lat: value.latitude, lon: value.longitude };
      if (path === 'navigation.courseOverGroundTrue' && vessel) vessel.cog = value;
    }
    drawVessel();
    if (drawn && swung()) later();
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
