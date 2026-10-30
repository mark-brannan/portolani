// Voyage overlays: a historical track drawn on the modern-geometry map in any projection. A voyage
// is data/voyages/<id>.json with its deaths and sources joined in by readVoyage below (problems() is
// the schema): legs of waypoints in
// [lon, lat], each leg joined by one of LINES and graded by one of CONFIDENCES, plus events along
// the way (a death is drawn as a skull and crossbones). This module turns a leg into a dense path
// and cuts it at the seam; the drawing is in scene.mjs, the land test in test/voyages.test.mjs.
export const LINES = ['rhumb', 'great-circle', 'spline'];
export const CONFIDENCES = ['attested', 'inferred', 'conventional'];
export const MARKER_CONFIDENCES = [...CONFIDENCES, 'speculative']; // how a marker's place is known: the leg words, and a guess
export const MODES = ['sea', 'land'];
export const EVENT_KINDS = ['death', 'landfall', 'event', 'waypoint'];
// What a record draws: a `voyage` (the default) is a course sailed by named people, each leg a line dashed by its
// confidence; a `migration` is the spread of a people, drawn as a stream of chevrons over a soft ribbon (scene.mjs).
// A migration names nobody (`who` may be empty), its places are `waypoint` events whose dates show in their tiles,
// and each leg says how far along the spread it runs (`reach`, 0 at the start to 1 at the furthest front: the
// chevrons shrink toward the front), which ends carry a head (HEADS) and whether it is a long `pause`, drawn fainter.
// A branch is a leg that starts on another leg's waypoint. Its line runs from settlement to settlement, island to
// island, so it is not held to the sea.
// Drawn (scene.mjs) as chevrons in the record's ink pointing the way the people went, shrinking toward the front
// with an ink chevron at each head, over one light, wide, soft-edged ribbon of one width all along (a moving frame
// strokes it without the blur); a two-headed leg's chevrons point out from its middle, a pause has a dotted trail
// and no chevrons, nothing is dashed or lettered, the chevrons follow the line weight, and a leg is cut at the seam.
export const KINDS = ['voyage', 'migration'];
export const HEADS = ['end', 'both', 'none'];
export const isMigration = (v) => v?.kind === 'migration';
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
// How long the pen takes to draw a voyage's line on, in seconds: a slider in the Voyages drawer, carried by the link
// as `voyagedraw=`. voyageDrawSeconds reads it back: a value off the slider's steps or outside its range is the default.
export const VOYAGE_DRAW = { min: 1, max: 5, step: 0.5, seconds: 2.5 };
export function voyageDrawSeconds(text) {
  const s = Number(text), { min, max, step, seconds } = VOYAGE_DRAW;
  return text != null && text !== '' && s >= min && s <= max && Number.isInteger((s - min) / step) ? s : seconds;
}
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
// [lon, lat], each one drawable as a single stroke. A third value on a point (a migration's reach) is kept.
export function splitAtSeam(path, lonCenter = 0, visible = null) {
  const pieces = [];
  let piece = [], prev = null;
  for (const p of path) {
    const [lon, lat] = p, d = fromCentre(lon - lonCenter);
    const cut = (prev != null && Math.abs(d - prev) > 180) || (visible && !visible(lon, lat));
    if (cut && piece.length) { pieces.push(piece); piece = []; }
    if (!visible || visible(lon, lat)) piece.push(p.length > 2 ? [wrapLon(lon), lat, p[2]] : [wrapLon(lon), lat]);
    prev = d;
  }
  if (piece.length) pieces.push(piece);
  return pieces.filter((p) => p.length > 1);
}

// A migration leg's dense path with each point's share of the way along it, by distance: [lon, lat, 0 … 1]
export function reachPath(leg) {
  const path = legPath(leg), c = [0];
  for (let i = 1; i < path.length; i++) c.push(c[i - 1] + distanceKm(path[i - 1], path[i]));
  const L = c.at(-1) || 1;
  return path.map(([lon, lat], i) => [lon, lat, c[i] / L]);
}

// Every sea leg's samples, for the land test: [{ leg, i, lon, lat }], longitudes wrapped.
export function seaSamples(voyage) {
  const out = [];
  if (isMigration(voyage)) return out;
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
  need(v.kind === undefined || KINDS.includes(v.kind), `kind: one of ${KINDS}`);
  const migration = isMigration(v);
  need(Array.isArray(v.who) && (v.who.length || migration) && v.who.every((w) => typeof w === 'string' && SLUG.test(w)) && new Set(v.who).size === v.who.length, 'who: distinct slugs into people.json');
  need(Array.isArray(v.sources) && v.sources.length && v.sources.every((s) => s.title && s.url), 'sources: [{ title, url }]');
  need(Array.isArray(v.legs) && v.legs.length, 'legs: at least one');
  for (const [i, leg] of (v.legs ?? []).entries()) {
    const at = `leg ${i} (${leg.from} → ${leg.to})`;
    need(typeof leg.from === 'string' && typeof leg.to === 'string', `${at}: from and to`);
    need(MODES.includes(leg.mode), `${at}: mode one of ${MODES}`);
    need(LINES.includes(leg.line), `${at}: line one of ${LINES}`);
    need(CONFIDENCES.includes(leg.confidence), `${at}: confidence one of ${CONFIDENCES}`);
    need(typeof leg.source === 'string' && leg.source.length, `${at}: a source`);
    if (migration) {
      need(Array.isArray(leg.reach) && leg.reach.length === 2 && leg.reach.every((r) => Number.isFinite(r) && r >= 0 && r <= 1) && leg.reach[0] <= leg.reach[1], `${at}: reach [from, to], 0 to 1, from no more than to`);
      need(HEADS.includes(leg.heads), `${at}: heads one of ${HEADS}`);
      need(leg.pause === undefined || typeof leg.pause === 'boolean', `${at}: pause, when given, true or false`);
    }
    need(leg.doubt === undefined || (typeof leg.doubt === 'string' && leg.doubt.length), `${at}: doubt, when given, a string (who doubts it and why)`);
    need(Array.isArray(leg.points) && leg.points.length >= 2 && leg.points.every((p) => Array.isArray(p) && p.length === 2 && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90), `${at}: points [[lon, lat], ...], two or more`);
  }
  need(Array.isArray(v.events), 'events: an array');
  for (const [i, e] of (v.events ?? []).entries()) {
    need(EVENT_KINDS.includes(e.kind), `event ${i}: kind one of ${EVENT_KINDS}`);
    if (e.kind === 'waypoint') need(migration && typeof e.date === 'string' && e.date.length, `event ${i}: a waypoint belongs to a migration and has a date`);
    need(Number.isFinite(e.lon) && Number.isFinite(e.lat) && Math.abs(e.lon) <= 180 && Math.abs(e.lat) <= 90, `event ${i}: lon and lat`);
    need(typeof e.label === 'string' && e.label.length, `event ${i}: a label`);
    need(typeof e.source === 'string' && e.source.length, `event ${i}: a source`);
    if (e.kind === 'death') need(typeof e.who === 'string' && e.who.length, `event ${i}: who died`);
    need(e.text === undefined || (typeof e.text === 'string' && e.text.length), `event ${i}: text, when given, a string`);
    need(e.doubt === undefined || (typeof e.doubt === 'string' && e.doubt.length), `event ${i}: doubt, when given, a string (who doubts it and why)`);
    need(e.confidence === undefined || MARKER_CONFIDENCES.includes(e.confidence), `event ${i}: confidence, when given, one of ${MARKER_CONFIDENCES}`);
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
  return out;
}

// The one reader of the voyage files: each piece of text lives in one place, and this puts a voyage back
// together. A voyage's `who` is slugs into people.json (checkPerson below is the person's schema), its `sources`
// ids into sources.json, and so is an event's or a marker's `cite`, resolved to `cited` { title, url } for the tile.
// Each person's death with a place joins the events as a skull, its `who` the person's name. A leg sailed again on
// another voyage is { "sameAs": "<voyage id>/<leg id>", "dates" }, the leg's own file giving it an `id`.
// `readJSON(path)` reads a path under the site root, sync or async. Returns the whole record problems() and the
// drawing take, with `people` [{ id, ...record }]; throws on a reference that does not resolve or a death written
// in the voyage file.
export const VOYAGE_DIR = 'data/voyages';
export async function readVoyage(id, readJSON) {
  const file = (name) => `${VOYAGE_DIR}/${name}.json`;
  const [raw, people, sources] = await Promise.all([file(id), file('people'), file('sources')].map((p) => readJSON(p)));
  const fail = (what) => { throw new Error(`${id}: ${what}`); };
  if ((raw.events ?? []).some((e) => e.kind === 'death')) fail('a death belongs in people.json, not the voyage');
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
  const persons = (raw.who ?? []).map((w) => people[w] ? { id: w, ...people[w] } : fail(`${w} is not in people.json`));
  const deaths = persons.filter((p) => p.death && Number.isFinite(p.death.lon) && Number.isFinite(p.death.lat))
    .map((p) => ({ kind: 'death', who: p.name ?? p.id, ...p.death }));
  const source = (s) => sources[s] ?? fail(`source ${s} is not in sources.json`);
  // an event's or a death's `cite` is the sources.json id its tile links to; an alternative place without its own takes the death's
  const linked = (e, up) => { const { cite, ...rest } = e; const cited = cite === undefined ? up : source(cite); return cited ? { ...rest, cited } : rest; };
  const events = [...(raw.events ?? []), ...deaths].map((e) => {
    const out = linked(e);
    if (Array.isArray(e.alternatives)) out.alternatives = e.alternatives.map((a) => linked(a, out.cited));
    return out;
  });
  return { ...raw, sources: (raw.sources ?? []).map(source), legs, events, people: persons };
}

// A person's record in people.json, keyed by a lower-case slug: nothing is required, and each field is checked only
// when it is there. `name` is the display name (the key stands in when there is none), `aka` other names, `bio` a
// paragraph, `sources` ids into sources.json. `born` and `death` are markers (docs/voyages/README.md "The record"):
// lon and lat together or not at all, `confidence` one of MARKER_CONFIDENCES, `doubt` the optional sentence. `images`
// are Wikimedia Commons files, { file, kind, author, date, licence, note }: `file` the bare file name, no scheme, no
// slash; `kind` one of IMAGE_KINDS.
export const IMAGE_KINDS = ['life', 'near', 'posthumous', 'imaginary', 'modern', 'scene', 'ship', 'map'];
export const SLUG = /^[a-z][a-z0-9-]*$/;
// The problems in one person record, as strings; none when it is well formed. `sources` is what a `cite` must name.
export function checkPerson(id, p, { sources } = {}) {
  const out = [];
  const need = (ok, msg) => { if (!ok) out.push(`${id}: ${msg}`); };
  const str = (s) => typeof s === 'string' && s.length > 0;
  const strs = (a) => Array.isArray(a) && a.every(str);
  need(SLUG.test(id), 'key: a lower-case slug');
  if (!p || typeof p !== 'object' || Array.isArray(p)) return [...out, `${id}: a record`];
  for (const k of ['name', 'bio']) if (p[k] !== undefined) need(str(p[k]), `${k}: a string`);
  for (const k of ['aka', 'sources']) if (p[k] !== undefined) need(strs(p[k]), `${k}: strings`);
  if (sources && Array.isArray(p.sources)) for (const s of p.sources) need(s in sources, `sources: ${s} is not in sources.json`);
  const place = (m, at) => {
    if (m.lon === undefined && m.lat === undefined) return;
    need(Number.isFinite(m.lon) && Number.isFinite(m.lat) && Math.abs(m.lon) <= 180 && Math.abs(m.lat) <= 90, `${at}: lon and lat, together`);
  };
  // Where a mark is drawn (lon or lat given) it needs a label and a source; an alternative is always drawn, so it needs a place too.
  const marker = (m, at, alt = false) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return need(false, `${at}: { lon, lat, date, place, label, text, doubt, source, cite, confidence, alternatives }`);
    place(m, at);
    if (alt || m.lon !== undefined || m.lat !== undefined) {
      need(alt ? Number.isFinite(m.lon) && Number.isFinite(m.lat) : true, `${at}: lon and lat, together`);
      for (const k of alt ? ['place', 'label', 'source'] : ['label', 'source']) need(str(m[k]), `${at}: a ${k}, since it is drawn`);
    }
    for (const k of ['date', 'place', 'label', 'text', 'doubt', 'source']) if (m[k] !== undefined) need(str(m[k]), `${at}: ${k}, a string`);
    if (m.cite !== undefined) need(str(m.cite) && (!sources || m.cite in sources), `${at}: cite ${m.cite} is not in sources.json`);
    if (m.confidence !== undefined) need(MARKER_CONFIDENCES.includes(m.confidence), `${at}: confidence one of ${MARKER_CONFIDENCES}`);
    if (m.alternatives !== undefined) {
      need(Array.isArray(m.alternatives), `${at}: alternatives, a list`);
      for (const [j, a] of (Array.isArray(m.alternatives) ? m.alternatives : []).entries()) marker(a, `${at} alternative ${j}`, true);
    }
  };
  for (const k of ['born', 'death']) if (p[k] !== undefined) marker(p[k], k);
  if (p.images !== undefined) {
    need(Array.isArray(p.images), 'images: a list');
    for (const [j, q] of (Array.isArray(p.images) ? p.images : []).entries()) {
      const at = `image ${j}`;
      if (!q || typeof q !== 'object') { need(false, `${at}: { file, kind, author, date, licence, note }`); continue; }
      need(str(q.file) && !/^[a-z][a-z0-9+.-]*:/i.test(q.file) && !q.file.includes('/'), `${at}: file, a bare Commons file name`);
      need(IMAGE_KINDS.includes(q.kind), `${at}: kind one of ${IMAGE_KINDS}`);
      for (const k of ['author', 'date', 'licence', 'note']) if (q[k] !== undefined) need(str(q[k]), `${at}: ${k}, a string`);
    }
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
  const first = v?.sources?.[0], s = typeof first === 'string' ? sources[first] : first; // an id, or already resolved by readVoyage
  if (s?.url) return { label: s.title ?? s.url, url: s.url };
  const who = v?.who?.[0];
  return who ? { label: `${who}, Wikipedia`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(who.replace(/ /g, '_'))}` } : null;
}
