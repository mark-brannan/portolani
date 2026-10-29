// Voyage overlays: a historical track drawn on the modern-geometry map in any projection. A voyage
// is data/voyages/<id>.json with its deaths and sources joined in by readVoyage below (problems() is
// the schema): legs of waypoints in
// [lon, lat], each leg joined by one of LINES and graded by one of CONFIDENCES, plus events along
// the way (a death is drawn as a skull and crossbones). This module turns a leg into a dense path
// and cuts it at the seam; the drawing is in scene.mjs, the land test in test/voyages.test.mjs.
export const LINES = ['rhumb', 'great-circle', 'spline'];
export const CONFIDENCES = ['attested', 'inferred', 'conventional'];
export const MODES = ['sea', 'land'];
export const EVENT_KINDS = ['death', 'landfall', 'event'];
// how each confidence is stroked, a setLineDash pattern in px at the stroke's width
export const DASHES = { attested: [], inferred: [9, 5], conventional: [2, 4] };
export const STEP_KM = 25; // the path's sample spacing, close enough that a strait is followed and a curve reads smooth

// The inks a voyage is drawn in, each dark enough to read on parchment and on the land washes. The first is the
// chart's red (scene.mjs windRed), which the first voyage chosen takes; each further one takes a colour seeded on
// its id, the next free one along when that is taken, so a link draws the same colours wherever it is opened.
export const VOYAGE_PALETTE = ['#8c2f1e', '#1f4e8c', '#2e6b34', '#6b2d7a', '#b0601a', '#16727a', '#9c2a5c', '#4a4f9a', '#5c4a1e'];
// the stroke widths on offer, in px on the 1600 px sheet; 2.2 is the width a voyage has always had
export const VOYAGE_WIDTHS = [1.4, 2.2, 3.2, 4.5];
export const VOYAGE_WIDTH = 2.2;
const seedOf = (id) => [...id].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
// The colours of a list of chosen voyages, in the order chosen: `picked` maps an id to a colour picked by hand.
// Red goes to the first one not picked while no other has it; the rest are seeded on their ids among the free colours.
export function voyageColours(ids, picked = {}) {
  const used = new Set(ids.map((id) => picked[id]).filter(Boolean)), out = {};
  for (const [i, id] of ids.entries()) {
    if (picked[id]) { out[id] = picked[id]; continue; }
    const red = VOYAGE_PALETTE[0], rest = VOYAGE_PALETTE.slice(1), start = seedOf(id) % rest.length;
    const round = rest.map((_, k) => rest[(start + k) % rest.length]); // from the id's own colour on
    const c = !used.has(red) ? red : round.find((r) => !used.has(r)) ?? round[0];
    used.add(c); out[id] = c;
  }
  return out;
}

const RAD = Math.PI / 180, R_KM = 6371.0088;
const fromCentre = (d) => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);
export const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
const mercLat = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;

// great-circle distance in km
export function distanceKm([lon1, lat1], [lon2, lat2]) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dl = (lon2 - lon1) * RAD;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Waypoints with longitude made continuous from the first (no jump across the date line), so a
// Pacific crossing runs 150 → 190 rather than 150 → -170.
export function unwrap(points) {
  const out = [];
  let prev = null;
  for (const [lon, lat] of points) {
    const l = prev == null ? lon : prev + fromCentre(lon - prev);
    out.push([l, lat]);
    prev = l;
  }
  return out;
}

const steps = (a, b) => Math.max(1, Math.ceil(distanceKm(a, b) / STEP_KM));

// A to B along the loxodrome (constant bearing): straight on Mercator
function rhumbPath(a, b) {
  const n = steps(a, b), ya = mercY(Math.max(-89, Math.min(89, a[1]))), yb = mercY(Math.max(-89, Math.min(89, b[1])));
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, mercLat(ya + (yb - ya) * t)]);
  }
  return out;
}

// A to B along the great circle (the shortest way), lon kept continuous with A
function greatCirclePath(a, b) {
  const n = steps(a, b), toXYZ = ([lon, lat]) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];
  const p = toXYZ(a), q = toXYZ(b), dot = Math.max(-1, Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])), w = Math.acos(dot);
  const out = [];
  let prev = a[0];
  for (let i = 1; i <= n; i++) {
    const t = i / n, sa = w < 1e-9 ? 1 - t : Math.sin((1 - t) * w) / Math.sin(w), sb = w < 1e-9 ? t : Math.sin(t * w) / Math.sin(w);
    const x = sa * p[0] + sb * q[0], y = sa * p[1] + sb * q[1], z = sa * p[2] + sb * q[2];
    const lon = prev + fromCentre(Math.atan2(y, x) / RAD - prev);
    out.push([lon, Math.atan2(z, Math.hypot(x, y)) / RAD]);
    prev = lon;
  }
  return out;
}

// A smooth curve through every waypoint (Catmull-Rom on lon/lat, x scaled by cos lat so the curve
// bends the same on the ground at any latitude): the broad brush for a leg whose course is a guess
function splinePath(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = steps(p1, p2);
    for (let j = 1; j <= n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const at = (k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), Math.max(-89, Math.min(89, at(1)))]);
    }
  }
  return out;
}

// The leg as a dense path of [lon, lat], longitude continuous from its first point.
export function legPath(leg) {
  const pts = unwrap(leg.points);
  if (pts.length < 2) return pts;
  if (leg.line === 'spline') return [pts[0], ...splinePath(pts)];
  const join = leg.line === 'great-circle' ? greatCirclePath : rhumbPath;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) out.push(...join(pts[i], pts[i + 1]));
  return out;
}

// The path cut where it crosses the seam of a map centred on `lonCenter` (the meridian opposite it),
// and where `visible` (an azimuthal projection's horizon) refuses a point: pieces of wrapped
// [lon, lat], each one drawable as a single stroke.
export function splitAtSeam(path, lonCenter = 0, visible = null) {
  const pieces = [];
  let piece = [], prev = null;
  for (const [lon, lat] of path) {
    const d = fromCentre(lon - lonCenter);
    const cut = (prev != null && Math.abs(d - prev) > 180) || (visible && !visible(lon, lat));
    if (cut && piece.length) { pieces.push(piece); piece = []; }
    if (!visible || visible(lon, lat)) piece.push([wrapLon(lon), lat]);
    prev = d;
  }
  if (piece.length) pieces.push(piece);
  return pieces.filter((p) => p.length > 1);
}

// Every sea leg's samples, for the land test: [{ leg, i, lon, lat }], longitudes wrapped.
export function seaSamples(voyage) {
  const out = [];
  voyage.legs.forEach((leg, i) => {
    if (leg.mode !== 'sea') return;
    for (const [lon, lat] of legPath(leg)) out.push({ leg, i, lon: wrapLon(lon), lat });
  });
  return out;
}

// A resolved cite is a link the page writes into an href, so its url must be https, never javascript: or the like.
const citedOk = (c) => c === undefined || (c && typeof c.title === 'string' && typeof c.url === 'string' && /^https:\/\//.test(c.url));

// Schema check: the problems in a voyage record, as strings; none when it is well formed.
export function problems(v) {
  const out = [];
  const need = (ok, msg) => { if (!ok) out.push(msg); };
  need(typeof v.id === 'string' && /^[a-z][a-z0-9-]*$/.test(v.id), 'id: lower-case slug');
  for (const k of ['title', 'short', 'when', 'summary']) need(typeof v[k] === 'string' && v[k].length, `${k}: a string`);
  need(Array.isArray(v.who) && v.who.length, 'who: the named people');
  need(Array.isArray(v.sources) && v.sources.length && v.sources.every((s) => s.title && s.url), 'sources: [{ title, url }]');
  need(Array.isArray(v.legs) && v.legs.length, 'legs: at least one');
  for (const [i, leg] of (v.legs ?? []).entries()) {
    const at = `leg ${i} (${leg.from} → ${leg.to})`;
    need(typeof leg.from === 'string' && typeof leg.to === 'string', `${at}: from and to`);
    need(MODES.includes(leg.mode), `${at}: mode one of ${MODES}`);
    need(LINES.includes(leg.line), `${at}: line one of ${LINES}`);
    need(CONFIDENCES.includes(leg.confidence), `${at}: confidence one of ${CONFIDENCES}`);
    need(typeof leg.source === 'string' && leg.source.length, `${at}: a source`);
    need(Array.isArray(leg.points) && leg.points.length >= 2 && leg.points.every((p) => Array.isArray(p) && p.length === 2 && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90), `${at}: points [[lon, lat], ...], two or more`);
  }
  need(Array.isArray(v.events), 'events: an array');
  for (const [i, e] of (v.events ?? []).entries()) {
    need(EVENT_KINDS.includes(e.kind), `event ${i}: kind one of ${EVENT_KINDS}`);
    need(Number.isFinite(e.lon) && Number.isFinite(e.lat) && Math.abs(e.lon) <= 180 && Math.abs(e.lat) <= 90, `event ${i}: lon and lat`);
    need(typeof e.label === 'string' && e.label.length, `event ${i}: a label`);
    need(typeof e.source === 'string' && e.source.length, `event ${i}: a source`);
    if (e.kind === 'death') need(typeof e.who === 'string' && e.who.length, `event ${i}: who died`);
    need(e.text === undefined || (typeof e.text === 'string' && e.text.length), `event ${i}: text, when given, a string`);
    need(citedOk(e.cited), `event ${i}: cited, when given, { title, url } with an https url, from sources.json`);
    if (e.alternatives !== undefined) {
      need(e.kind === 'death', `event ${i}: alternatives belong to a death`);
      need(Array.isArray(e.alternatives) && e.alternatives.length, `event ${i}: alternatives: [{ lon, lat, place, label, source }], one or more`);
      for (const [j, a] of (Array.isArray(e.alternatives) ? e.alternatives : []).entries()) {
        need(a && Number.isFinite(a.lon) && Number.isFinite(a.lat) && Math.abs(a.lon) <= 180 && Math.abs(a.lat) <= 90, `event ${i} alternative ${j}: lon and lat`);
        for (const k of ['place', 'label', 'source']) need(a && typeof a[k] === 'string' && a[k].length, `event ${i} alternative ${j}: a ${k}`);
        need(a && citedOk(a.cited), `event ${i} alternative ${j}: cited, when given, { title, url } with an https url`);
        need(a && (a.text === undefined || (typeof a.text === 'string' && a.text.length)), `event ${i} alternative ${j}: text, when given, a string`);
      }
    }
  }
  // every named person has a skull, unless people.json says nobody knows where they died, or they are living
  for (const w of Array.isArray(v.who) ? v.who : []) {
    if (!(v.deathUnknown ?? []).includes(w) && !(v.living ?? []).includes(w)) need((v.events ?? []).some((e) => e.kind === 'death' && e.who === w), `events: where ${w} died (a death in people.json, or "unknown")`);
  }
  return out;
}

// The one reader of the voyage files: each piece of text lives in one place, and this puts a voyage
// back together. A person's death is in people.json, keyed by name ({ "death": { lon, lat, date, label,
// text, source, alternatives } }, or { "death": "unknown" }, or `living: true` and no death; personProblems below
// is the person's schema), and joins every voyage whose `who` names them; a voyage's `sources` are ids into sources.json, and so is an event's or a death's `cite`, the one its
// tile links to (resolved to `cited`, { title, url }); a leg sailed again on another voyage is
// { "sameAs": "<voyage id>/<leg id>", "dates" }, the leg's own file giving it an `id`. `readJSON(path)`
// reads a path under the site root, sync or async. Returns the whole record problems() and the drawing
// take; throws on a reference that does not resolve or a death written in the voyage file.
export const VOYAGE_DIR = 'data/voyages';
export async function readVoyage(id, readJSON) {
  const file = (name) => `${VOYAGE_DIR}/${name}.json`;
  const [raw, people, sources] = await Promise.all([file(id), file('people'), file('sources')].map((p) => readJSON(p)));
  const fail = (what) => { throw new Error(`${id}: ${what}`); };
  if (raw.deathUnknown || (raw.events ?? []).some((e) => e.kind === 'death')) fail('a death belongs in people.json, not the voyage');
  const others = new Map([[id, raw]]);
  const legs = [];
  for (const [i, leg] of (raw.legs ?? []).entries()) {
    if (leg.sameAs === undefined) { legs.push(leg); continue; }
    const extra = Object.keys(leg).filter((k) => k !== 'sameAs' && k !== 'dates');
    if (extra.length) fail(`leg ${i} (sameAs ${leg.sameAs}): only dates may be given beside sameAs, not ${extra.join(', ')}`);
    const [owner, legId] = String(leg.sameAs).split('/');
    if (!others.has(owner)) others.set(owner, Promise.resolve().then(() => readJSON(file(owner))).catch(() => ({})));
    const target = (await others.get(owner)).legs?.find((l) => l.id === legId && l.sameAs === undefined);
    if (!target) fail(`leg ${i}: sameAs ${leg.sameAs} names no leg`);
    const { id: _, ...shared } = target;
    legs.push({ ...shared, ...(leg.dates !== undefined && { dates: leg.dates }) });
  }
  const deaths = [], unknown = [], living = [];
  for (const who of raw.who ?? []) {
    const death = people[who]?.death;
    if (people[who]?.living === true && death === undefined) living.push(who);
    else if (death === 'unknown') unknown.push(who);
    else if (death) deaths.push({ kind: 'death', who, ...death });
  }
  const source = (s) => sources[s] ?? fail(`source ${s} is not in sources.json`);
  // an event's or a death's `cite` is the sources.json id its tile links to; an alternative place without its own takes the death's
  const linked = (e, up) => { const { cite, ...rest } = e; const cited = cite === undefined ? up : source(cite); return cited ? { ...rest, cited } : rest; };
  const events = [...(raw.events ?? []), ...deaths].map((e) => {
    const out = linked(e);
    if (Array.isArray(e.alternatives)) out.alternatives = e.alternatives.map((a) => linked(a, out.cited));
    return out;
  });
  return { ...raw, sources: (raw.sources ?? []).map(source), legs, events, ...(unknown.length && { deathUnknown: unknown }), ...(living.length && { living }) };
}

// How well a birth or a death is known: the leg confidences, and one more for what is only a guess.
export const KNOWN = [...CONFIDENCES, 'speculative'];
export const PORTRAIT_KINDS = ['life', 'near', 'posthumous', 'imaginary', 'modern', 'none'];
// Schema check for one people.json record, keyed by `name`: the problems as strings, none when well formed. Only the
// death (or "unknown", or `living: true` and no death) is required; every other field is checked when it is there, so
// an older record with a death alone passes. `sources` and `voyageIds`, when given, are what a cite and a voyage id
// must name.
export function personProblems(name, p, { sources, voyageIds } = {}) {
  const out = [];
  const need = (ok, msg) => { if (!ok) out.push(`${name}: ${msg}`); };
  const str = (s) => typeof s === 'string' && s.length > 0;
  const strs = (a) => Array.isArray(a) && a.length > 0 && a.every(str);
  const place = (m) => m && Number.isFinite(m.lon) && Number.isFinite(m.lat) && Math.abs(m.lon) <= 180 && Math.abs(m.lat) <= 90;
  if (!p || typeof p !== 'object') return [`${name}: a record`];
  if (p.living !== undefined) need(p.living === true && p.death === undefined, 'living: true, and then no death');
  else need(p.death === 'unknown' || (p.death && typeof p.death === 'object'), 'death: { lon, lat, date, label, source }, or "unknown"');
  if (p.id !== undefined) need(typeof p.id === 'string' && /^[a-z][a-z0-9-]*$/.test(p.id), 'id: lower-case slug');
  for (const k of ['aka', 'role']) if (p[k] !== undefined) need(strs(p[k]), `${k}: strings`);
  for (const k of ['origin', 'bio']) if (p[k] !== undefined) need(str(p[k]), `${k}: a string`);
  if (p.voyages !== undefined) {
    need(strs(p.voyages), 'voyages: voyage ids');
    if (voyageIds && Array.isArray(p.voyages)) for (const v of p.voyages) need(voyageIds.includes(v), `voyages: ${v} is not a voyage`);
  }
  if (p.sources !== undefined) need(Array.isArray(p.sources) && p.sources.length && p.sources.every((u) => typeof u === 'string' && /^https:\/\//.test(u)), 'sources: https urls');
  const cite = (m, at) => { if (m.cite !== undefined) need(str(m.cite) && (!sources || m.cite in sources), `${at}: cite ${m.cite} is not in sources.json`); };
  // a birth is drawn the way a death is: a marker, its tile's label, text and source, and other places beside it
  const marker = (m, at) => {
    need(place(m), `${at}: lon and lat`);
    for (const k of ['date', 'label', 'source']) need(m && str(m[k]), `${at}: a ${k}`);
    for (const k of ['place', 'text']) if (m?.[k] !== undefined) need(str(m[k]), `${at}: ${k}, when given, a string`);
    if (m?.known !== undefined) need(KNOWN.includes(m.known), `${at}: known one of ${KNOWN}`);
    if (m) cite(m, at);
    if (m?.alternatives !== undefined) {
      need(Array.isArray(m.alternatives) && m.alternatives.length, `${at}: alternatives: [{ lon, lat, place, label, source }], one or more`);
      for (const [j, a] of (Array.isArray(m.alternatives) ? m.alternatives : []).entries()) {
        need(place(a), `${at} alternative ${j}: lon and lat`);
        for (const k of ['place', 'label', 'source']) need(a && str(a[k]), `${at} alternative ${j}: a ${k}`);
      }
    }
  };
  if (p.born !== undefined) { marker(p.born, 'born'); need(KNOWN.includes(p.born?.known), `born: known one of ${KNOWN}`); }
  if (p.death && typeof p.death === 'object' && p.death.known !== undefined) need(KNOWN.includes(p.death.known), `death: known one of ${KNOWN}`);
  if (p.portrait !== undefined) {
    const q = p.portrait;
    need(q && PORTRAIT_KINDS.includes(q.kind), `portrait: kind one of ${PORTRAIT_KINDS}`);
    // a file is a Commons file name, never a url, credited as its file page asks; kind "none" may still name a stand-in image
    if (q?.file !== undefined || q?.kind !== 'none') {
      need(str(q?.file) && !/^https?:|\//.test(q.file), 'portrait: file, a Commons file name');
      for (const k of ['author', 'date', 'licence']) need(str(q?.[k]), `portrait: a ${k}`);
    }
    if (q?.note !== undefined) need(str(q.note), 'portrait: note, when given, a string');
  }
  return out;
}

// The year a voyage set out, read off its `when` ("c. 600 BC", "c. 330–320 BC", "1271–1295"): the first number,
// negative before Christ; NaN when there is none. The voyages drawer lists them by it, earliest first (#242).
// Years only: a century ("5th century BC") would read as year 5, so it would sort wrong.
export function voyageStart(when) {
  const m = /(\d+)/.exec(String(when ?? ''));
  if (!m) return NaN;
  return /\bBCE?\b/.test(when) ? -Number(m[1]) : Number(m[1]);
}
// [id, voyage] pairs in the order they set out; the given order breaks ties and puts an undated one last.
export function chronological(pairs) {
  const key = (v) => { const y = voyageStart(v?.when); return Number.isNaN(y) ? Infinity : y; };
  return pairs.map((p, i) => [p, i]).sort(([a, i], [b, j]) => key(a[1]) - key(b[1]) || i - j).map(([p]) => p);
}
// Where the drawer's "Read more" goes for a raw voyage file: its first source in sources.json, else the Wikipedia
// page of the first person on it. { label, url }, or null with neither.
export function voyageLink(v, sources = {}) {
  const s = sources[v?.sources?.[0]];
  if (s?.url) return { label: s.title ?? s.url, url: s.url };
  const who = v?.who?.[0];
  return who ? { label: `${who}, Wikipedia`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(who.replace(/ /g, '_'))}` } : null;
}
