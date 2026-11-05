// The webapp: the plugin's ENC cells drawn by portolani's scene, panned and zoomed, with the vessel's
// position from the Signal K stream. The settings drawer is closed at start and closes itself once the pointer
// leaves it, or on a tap on the chart; its chips show what they draw.
import { createScene, drawScene, panView, zoomView, clampView, viewProjection, drawnPeaks, peakHits, listSprites, peakInkSvg, towerGlyph, W, H } from 'portolani/scene.mjs';
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
let view = null, vessel = null, drawn = null, drawing = 0, following = false;

// the view that holds a bbox [w, s, e, n]
const fit = ([w, s, e, n]) => clampView({ lon: (w + e) / 2, lat: Math.atan(Math.sinh((merc(s) + merc(n)) / 2)) / RAD,
  zoom: Math.min(Math.log2((2 * Math.PI * H) / (512 * (merc(n) - merc(s)))), Math.log2((2 * Math.PI * W) / (512 * (e - w) * RAD))) });

// north up while the compass is locked, else the bearing the user turned the chart to
const wrap = (b) => ((b % 360) + 360) % 360;
const oriented = (v) => clampView({ ...v, bearing: settings.northUp ? 0 : settings.bearing });

async function render() {
  const n = ++drawing, scale = Math.min(2, devicePixelRatio || 1);
  status('Drawing…');
  try {
    view = oriented(view);
    const cells = await cellData(frameView(view, viewProjection(view).invert, W, H));
    const { scene, data, bg } = await createScene(env, { ...chartOptions(settings, await sprites, cells), view });
    if (n !== drawing) return;
    map.width = marks.width = W * scale; map.height = marks.height = H * scale;
    drawScene(map.getContext('2d'), scene, data, bg, { scale, x: 0, y: 0 });
    map.style.transform = marks.style.transform = pending = '';
    drawn = { view, scale, peaks: drawnPeaks(scene, data) };
    hideTile();
    drawVessel();
    paintCompass();
    if (strayed()) later(); // the vessel moved while drawing
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

// One finger or the mouse drags to pan; two fingers pinch, twist and pan; the right button or Ctrl held turns the
// chart about its centre. A gesture is drawn as a CSS similarity of the canvases about canvas point m0, carried to m1,
// scaled by `s` and turned by `a` radians, and on release becomes the view that drawing shows. Canvas px are the
// drawing's, whatever the CSS size.
// measured on the canvas's layout box, which a gesture's transform does not move
const box = () => { const s = stage.getBoundingClientRect(); return { left: s.left + map.offsetLeft, top: s.top + map.offsetTop, width: map.offsetWidth, height: map.offsetHeight }; };
const toCanvas = (dx, dy) => { const r = box(); return [(dx * W) / r.width, (dy * H) / r.height]; };
const atCanvas = (e) => { const r = box(); return toCanvas(e.clientX - r.left, e.clientY - r.top); };
const TWIST = 10; // degrees a twist must pass to turn a chart locked north up
const pointers = new Map();
let pending = ''; // the CSS of gestures settled since the last draw, which the canvases show until it lands
let g = null; // the gesture: { kind: 'pan' | 'pinch' | 'turn', m0, m1, s, a, at, a0 }
const centre = [W / 2, H / 2];
const angleOf = ([x, y], [cx, cy]) => Math.atan2(y - cy, x - cx);
function twoFinger() {
  const [p, q] = [...pointers.values()];
  return { mid: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], d: Math.hypot(q[0] - p[0], q[1] - p[1]), ang: Math.atan2(q[1] - p[1], q[0] - p[0]) };
}
function begin(e) {
  if (pointers.size === 2) {
    // a finger already panning: the pinch carries its move, so the point under the fingers is the drawing's point
    const t = twoFinger(), d = g?.kind === 'pan' ? [g.m1[0] - g.m0[0], g.m1[1] - g.m0[1]] : [0, 0];
    g = { kind: 'pinch', m0: [t.mid[0] - d[0], t.mid[1] - d[1]], m1: t.mid, s: 1, a: 0, d0: t.d, ang0: t.ang, panned: Math.hypot(...d) > 2 };
  }
  else if (e.button === 2 || e.ctrlKey) g = { kind: 'turn', m0: centre, m1: centre, s: 1, a: 0, a0: angleOf(atCanvas(e), centre) };
  else g = { kind: 'pan', m0: atCanvas(e), m1: atCanvas(e), s: 1, a: 0, moved: false };
}
// the twist that counts: none under TWIST degrees while locked north up
const twist = () => (settings.northUp && Math.abs(g.a) < TWIST * RAD ? 0 : g.a);
// following, a pinch keeps the vessel at the centre: it scales and turns about the centre and does not move it
const ends = () => (following && g.kind !== 'pan' ? [centre, centre] : [g.m0, g.m1]);
function css([m0, m1], s, a) {
  const k = map.offsetWidth / W;
  return `translate(${m1[0] * k}px, ${m1[1] * k}px) rotate(${a}rad) scale(${s}) translate(${-m0[0] * k}px, ${-m0[1] * k}px)`;
}
function show() {
  map.style.transform = marks.style.transform = `${css(ends(), g.s, twist())} ${pending}`;
  needle.style.transform = `rotate(${-(view.bearing ?? 0) + twist() / RAD}deg)`;
}
function settle() {
  const a = twist(), [m0, m1] = ends();
  if (g.kind === 'pan' || g.panned) {
    if (g.kind === 'pan' && Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) <= 2) return false;
    follow(false);
  }
  pending = `${css([m0, m1], g.s, a)} ${pending}`;
  // the canvas point of the drawing that the gesture brought to the centre becomes the view's centre
  const dx = (centre[0] - m1[0]) / g.s, dy = (centre[1] - m1[1]) / g.s, c = Math.cos(-a), sn = Math.sin(-a);
  const [lon, lat] = viewProjection(view).invert(m0[0] + dx * c - dy * sn, m0[1] + dx * sn + dy * c);
  let bearing = view.bearing ?? 0;
  if (a) { bearing = wrap(bearing - a / RAD); settings.northUp = false; settings.bearing = bearing; save(); paint(); }
  view = clampView({ ...view, lon, lat, zoom: view.zoom + Math.log2(g.s), bearing });
  later();
  return true;
}
stage.addEventListener('contextmenu', (e) => e.preventDefault());
stage.addEventListener('pointerdown', (e) => {
  try { stage.setPointerCapture(e.pointerId); } catch {} // a synthetic pointer has none to capture
  pointers.set(e.pointerId, atCanvas(e));
  if (pointers.size > 2) return;
  begin(e);
});
stage.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId) || !g) return;
  pointers.set(e.pointerId, atCanvas(e));
  if (g.kind === 'pinch' && pointers.size === 2) { const t = twoFinger(); g.m1 = t.mid; g.s = t.d / g.d0; g.a = t.ang - g.ang0; }
  else if (g.kind === 'turn') g.a = angleOf(atCanvas(e), centre) - g.a0;
  else if (g.kind === 'pan') g.m1 = atCanvas(e);
  show();
});
function release(e) {
  if (!pointers.delete(e.pointerId) || !g) return;
  const was = g;
  if (was.kind === 'pinch' && pointers.size === 1) { settle(); g = null; return; } // one finger lifted: the other starts no pan
  if (pointers.size) return;
  g = null;
  const moved = (() => { g = was; const m = settle(); g = null; return m; })();
  if (!moved && was.kind === 'pan') { map.style.transform = marks.style.transform = pending; if (!drawer.hidden) closeDrawer(); else peakAt(e); }
}
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);

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
  const [px, py] = atCanvas(e);
  // while following, the zoom is about the vessel, which stays at the centre
  const f = e.deltaY < 0 ? 1.5 : 1 / 1.5, p = following ? centre : [px, py];
  view = following ? clampView({ ...view, zoom: view.zoom + Math.log2(f) }) : zoomView(view, f, px, py);
  pending = `${css([p, p], f, 0)} ${pending}`; map.style.transform = marks.style.transform = pending;
  later();
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
// a sprite's chip picture: a pack's file, or a shape drawn in code (the towers, the Carta Marina's buildings) as its glyph
const picture = (s) => (!s ? NONE : s.pack === 'plain' ? `<span class="glyph">${towerGlyph(s.id)}</span>` : `<img alt="" src="packs/${s.pack}/${s.file}">`);
const TOWN_NAMES = { aguiar: 'Aguiar', martines: 'Martines', 'carta-marina': 'Carta Marina', tower: 'Towers' };
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
  for (const [t, pack] of Object.entries(TOWNS)) groupChip(towns, TOWN_NAMES[t], picture(chipSprite(list, 'town', t, pack)), `${TOWN_NAMES[t]}: towns on the built-up areas`, () => settings.towns.includes(t),
    () => { settings.towns = settings.towns.includes(t) ? settings.towns.filter((x) => x !== t) : [...settings.towns, t]; changed(); }, 'switch');
  groupChip(monsters, 'None', NONE, 'No monster', () => settings.monster === 'off', () => { settings.monster = 'off'; changed(); });
  for (const [m, pack] of Object.entries(MONSTERS)) groupChip(monsters, m === 'pare' ? 'Paré' : title(m), picture(chipSprite(list, 'monster', m, pack)),
    m === 'pare' ? "Paré's monsters, scanned" : 'The heraldic monsters, drawn', () => settings.monster === m, () => { settings.monster = m; changed(); });
  paint();
});
paint();

// the gutter: the drawer; follow the vessel; course up; the compass, which shows north and turns the chart north up.
// The drawer is closed at start. It closes itself DRAWER_LINGER ms after the pointer leaves it and its button
// (a mouse or pen), or on a tap on the chart (a finger), or on Escape.
const layers = document.getElementById('layers'), drawer = document.getElementById('drawer');
const DRAWER_LINGER = 500;
let linger = 0;
const showDrawer = (open) => { clearTimeout(linger); drawer.hidden = !open; layers.setAttribute('aria-pressed', String(open)); };
const closeDrawer = () => showDrawer(false);
layers.addEventListener('click', () => showDrawer(drawer.hidden));
for (const el of [drawer, layers]) {
  el.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !drawer.hidden) { clearTimeout(linger); linger = setTimeout(closeDrawer, DRAWER_LINGER); } });
  el.addEventListener('pointerenter', () => clearTimeout(linger));
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.hidden) closeDrawer(); });

// follow: the arrow toggles it. On, the view centres on the vessel at once (on the first fix, if none has come yet)
// and keeps it centred as it moves; a pan by hand turns it off
const followBtn = document.getElementById('follow');
const centred = (v) => clampView({ ...v, lon: vessel.lon, lat: vessel.lat });
function follow(on) {
  following = on;
  followBtn.setAttribute('aria-pressed', String(following));
  followBtn.title = following ? 'Following the vessel (a pan stops it)' : 'Follow the vessel';
  followBtn.setAttribute('aria-label', followBtn.title);
}
followBtn.addEventListener('click', () => { follow(!following); if (following && vessel) { view = centred(view); render(); } });
// the vessel has strayed STRAY px from the centre of the view drawn, while following
const STRAY = 40;
const strayed = () => { if (!following || !vessel || !drawn) return false; const [x, y] = viewProjection(drawn.view).toPx([vessel.lon, vessel.lat]); return Math.hypot(x - W / 2, y - H / 2) > STRAY; };

// The compass toggles north up: pressed, north is at the top and stays there; unpressed, the chart is back at the
// bearing it was turned to and turns freely. Its needle points to north on the chart as drawn.
const compass = document.getElementById('compass'), needle = document.getElementById('needle');
function paintCompass() { needle.style.transform = `rotate(${-(drawn?.view.bearing ?? 0)}deg)`; }
painters.push(() => {
  compass.setAttribute('aria-pressed', String(settings.northUp));
  compass.title = settings.northUp ? 'North up, locked (press to turn freely)' : 'North up';
  compass.setAttribute('aria-label', compass.title);
});
compass.addEventListener('click', () => { settings.northUp = !settings.northUp; changed(); });
// The two rotate buttons turn the chart a quarter turn to the next cardinal direction: clockwise brings west up after
// north, counter-clockwise east. From between two cardinals they go to the nearer one that way. Either unlocks the compass.
function quarter(dir) {
  const b = settings.northUp ? 0 : settings.bearing, eps = 1e-6;
  const next = dir > 0 ? (Math.ceil(b / 90 - eps) - 1) * 90 : (Math.floor(b / 90 + eps) + 1) * 90;
  settings.northUp = false; settings.bearing = wrap(next);
  changed();
}
document.getElementById('rotr').addEventListener('click', () => quarter(1));
document.getElementById('rotl').addEventListener('click', () => quarter(-1));
paint();

// navigation.position and the course from the Signal K stream, the vessel redrawn as they come
function stream() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/signalk/v1/stream?subscribe=none`);
  ws.onopen = () => ws.send(JSON.stringify({ context: 'vessels.self', subscribe: [{ path: 'navigation.position', period: 1000 }, { path: 'navigation.courseOverGroundTrue', period: 1000 }] }));
  ws.onmessage = (m) => {
    for (const u of JSON.parse(m.data).updates ?? []) for (const { path, value } of u.values ?? []) {
      if (path === 'navigation.position' && Number.isFinite(value?.latitude)) vessel = { ...vessel, lat: value.latitude, lon: value.longitude };
      if (path === 'navigation.courseOverGroundTrue' && vessel) vessel.cog = value;
    }
    const recentre = following && vessel && (!drawn || strayed());
    if (recentre) view = centred(view);
    drawVessel();
    if (drawn && recentre) later();
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
