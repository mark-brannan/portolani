// Voyage overlays: a historical track drawn on the modern-geometry map in any projection. A voyage
// is data/voyages/<id>.json with its deaths and sources joined in by readVoyage below (problems() is
// the schema): legs of waypoints in
// [lon, lat], each leg joined by one of LINES and graded by one of CONFIDENCES, plus events along
// the way (a death is drawn as a skull and crossbones). This module turns a leg into a dense path
// and cuts it at the seam; the drawing is in scene.mjs, the land test in test/voyages.test.mjs.
import { RAD, fromCentre, wrapLon, mercLat } from './frame-box.mjs';

export const LINES = ['rhumb', 'great-circle', 'spline'];
// How well a thing's place or course is known, one list for a leg, an event, a birth and a death (docs/spec/design.md,
// "one word for how sure"): attested, a source records it; inferred, worked out from the sources; conventional, the
// usual way to draw it or the editorial middle of a leg; speculative, one guess among several. The word sets the ink
// and reaches the reader in the tile as its fixed phrase.
export const CONFIDENCES = ['attested', 'inferred', 'conventional', 'speculative'];
export const MARKER_CONFIDENCES = CONFIDENCES; // the same list, under the name the person and event checks have used
export const CONFIDENCE_PHRASES = { attested: 'on record', inferred: 'reckoned from the record', conventional: 'the usual account', speculative: 'a guess' };
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
// chart's red (scene.mjs windRed). A voyage shown takes the first of them no shown voyage has, its own former one first
// if that is free, and keeps it while it is shown however others are shown and hidden (settleInks, below); a voyage in
// the contrast set (VOYAGE_CONTRAST, below) takes from that palette instead.
export const VOYAGE_PALETTE = ['#8c2f1e', '#1f4e8c', '#2e6b34', '#6b2d7a', '#b0601a', '#16727a', '#9c2a5c', '#4a4f9a', '#5c4a1e'];
// the stroke widths on offer, in px on the 1600 px sheet; the default is the heaviest, Heavy
export const VOYAGE_WIDTHS = [1.4, 2.2, 3.2, 4.5];
export const VOYAGE_WIDTH = 4.5;
// whether any leg of a voyage is drawn broken (dashed or dotted) rather than solid
export const isBroken = (voyage) => (voyage?.legs ?? []).some((l) => !ringed(l) && DASHES[l.confidence]?.length);
// whether a leg is drawn as the speculative stroke, sparse open rings with a cloud to tap (scene.mjs): a leg a source
// disputes (its `doubt`) or one only guessed at (`speculative`)
export const ringed = (leg) => Boolean(leg?.doubt) || leg?.confidence === 'speculative';
// How long the pen takes to draw a voyage's line on, in seconds: a slider in the Voyages drawer, carried by the link
// as `voyagedraw=`. voyageDrawSeconds reads it back: a value off the slider's steps or outside its range is the default.
export const VOYAGE_DRAW = { min: 1, max: 5, step: 0.5, seconds: 2.5 };
export function voyageDrawSeconds(text) {
  const s = Number(text), { min, max, step, seconds } = VOYAGE_DRAW;
  return text != null && text !== '' && s >= min && s <= max && Number.isInteger((s - min) / step) ? s : seconds;
}
// The high-contrast palette (docs/spec/design.md, "A dashed or dotted voyage is easy to see"): a green, a purple, a brighter red,
// an orange, a yellow; never a blue (a river) nor a grey or a brown (they sink into a scan). For a voyage with no colour picked
// while any of it crosses a sheet.
export const VOYAGE_CONTRAST = ['#008a3e', '#7a1fff', '#c4001a', '#e65c00', '#d9a400'];
// The list of voyages chosen ([{ id, colour, ink, hidden }], in the order chosen) with every shown voyage's `ink` settled
// (docs/spec/design.md, "colours stay with their voyages"): `colour` is one picked by hand, which always wins, and `ink`
// the one the voyage was given. A shown voyage keeps its ink while no other shown voyage has it and it suits the voyage's
// palette; a voyage in `fresh`, just shown, yields to those already shown and takes its own former ink if that is free,
// else the first of its palette no shown voyage has. `contrast` is the set of ids that take the high-contrast palette, a
// voyage with a dashed or dotted leg or one over a laid sheet, until its five inks are all taken; then the chart palette,
// so two voyages share an ink only once all fourteen are in use. A hidden voyage keeps its ink, as its former one, and
// holds none back. Returns the list unchanged (the same array) when nothing moved.
export function settleInks(list, contrast = new Set(), fresh = new Set()) {
  const shown = list.filter((v) => !v.hidden), used = new Set(shown.map((v) => v.colour).filter(Boolean)), out = new Map();
  const suits = (v, c) => !contrast.has(v.id) || VOYAGE_CONTRAST.includes(c) || VOYAGE_CONTRAST.every((r) => used.has(r));
  for (const v of shown) if (!v.colour && !fresh.has(v.id) && v.ink && !used.has(v.ink) && suits(v, v.ink)) { used.add(v.ink); out.set(v.id, v.ink); }
  for (const v of shown) {
    if (v.colour || out.has(v.id)) continue;
    const own = contrast.has(v.id) && VOYAGE_CONTRAST.some((r) => !used.has(r)) ? VOYAGE_CONTRAST : VOYAGE_PALETTE;
    const c = (v.ink && own.includes(v.ink) && !used.has(v.ink) ? v.ink : null) ?? [...own, ...VOYAGE_PALETTE].find((r) => !used.has(r)) ?? own[0];
    used.add(c); out.set(v.id, c);
  }
  if (list.every((v) => !out.has(v.id) || out.get(v.id) === v.ink)) return list;
  return list.map((v) => (out.has(v.id) && out.get(v.id) !== v.ink ? { ...v, ink: out.get(v.id) } : v));
}
// The colour each voyage of a list is drawn in, all shown and none given an ink before: `picked` maps an id to a colour
// picked by hand; the rest are settled in order by settleInks, so the first is the chart's red.
export function voyageColours(ids, picked = {}, contrast = new Set()) {
  const list = settleInks(ids.map((id) => ({ id, colour: picked[id] ?? null })), contrast);
  return Object.fromEntries(list.map((v) => [v.id, v.colour ?? v.ink]));
}

const R_KM = 6371.0088;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));

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
    for (const k of ['start', 'end']) need(leg[k] === undefined || ISO_DATE.test(leg[k]), `${at}: ${k}, when given, an ISO date cut to its precision (1519, 1519-11, 1519-11-29, -0324-12; ~ or ? after)`);
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

// ---------------------------------------------------------------- a voyage's own calendar
// The play button (docs/spec/design.md, "the play button sails the voyage on its own calendar") draws a voyage's line
// again at the pace of its dates: the pen runs along a leg between the leg's start and end, and sits still between one
// leg's end and the next's start. A leg gives its dates as `start` and `end`, ISO 8601 cut to the precision known
// ("1519", "1519-11", "1519-11-29"; a year before Christ negative and astronomical, "-0324-12"; EDTF's `~` and `?` may
// follow), or else its `dates` words are read ("20–26 Sep 1519", "Nov – 29 Nov 1519", "c. 1165-66", "winter 1332–33",
// "13th–14th century"). Each end is a span of days, as wide as it is vague; calendarOf below settles a day inside each.

// The day number of y-m-d on the proleptic Gregorian calendar (days since 1970-01-01); y astronomical (1 BC is 0), m from 0,
// and a month or a day past its end runs on into the next
export function dayOf(y, m = 0, d = 1) {
  const t = new Date(0);
  t.setUTCFullYear(y, m, d);
  return Math.round(t.getTime() / 864e5);
}
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const SEASON_MONTH = { spring: 2, summer: 5, autumn: 8, fall: 8, winter: 11 }; // the month each starts, three months long
// One end of a date's words: what it says, before the other end fills in what it leaves out
function dateEnd(text) {
  const t = text.toLowerCase(), out = {};
  const century = /\b(\d{1,2})(?:st|nd|rd|th)\b/.exec(t);
  if (century) out.century = Number(century[1]);
  const era = /\b(bce?|ad|ce)\b/.exec(t);
  if (era) out.bc = era[1].startsWith('b');
  const month = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/.exec(t);
  if (month) out.m = MONTH_KEYS.indexOf(month[1]);
  const season = /\b(spring|summer|autumn|fall|winter)\b/.exec(t);
  if (season) out.season = SEASON_MONTH[season[1]];
  const part = /\b(early|mid|late)\b/.exec(t);
  if (part) out.part = part[1];
  if (/\bchristmas\b/.test(t)) { out.m = 11; out.d = 25; }
  if (/\bafter\b/.test(t)) out.after = true;
  for (const [n] of t.matchAll(/\b\d{1,4}\b/g)) {
    if (n.length >= 3) out.y = Number(n);
    else out.small = Number(n); // a day, or a year cut to two digits ("1165-66"), as the other end tells
  }
  return out;
}
// [first day, the day after the last] that an end means, or null when it names no year
function endSpan(e) {
  if (e.century) { const y0 = (e.century - 1) * 100 + 1; return [dayOf(y0), dayOf(y0 + 100)]; }
  if (e.y == null) return null;
  const y = e.bc ? 1 - e.y : e.y;
  let span;
  if (e.m != null && e.d != null) span = [dayOf(y, e.m, e.d), dayOf(y, e.m, e.d + 1)];
  else if (e.m != null) span = e.part === 'early' ? [dayOf(y, e.m, 1), dayOf(y, e.m, 11)] : e.part === 'mid' ? [dayOf(y, e.m, 11), dayOf(y, e.m, 21)]
    : e.part === 'late' ? [dayOf(y, e.m, 21), dayOf(y, e.m + 1)] : [dayOf(y, e.m), dayOf(y, e.m + 1)];
  else if (e.season != null) span = [dayOf(y, e.season), dayOf(y, e.season + 3)];
  else if (e.part) span = { early: [dayOf(y, 0), dayOf(y, 4)], mid: [dayOf(y, 4), dayOf(y, 8)], late: [dayOf(y, 8), dayOf(y + 1)] }[e.part];
  else span = [dayOf(y), dayOf(y + 1)];
  return e.after ? [span[0], Infinity] : span;
}
export const PRECISIONS = ['day', 'month', 'year', 'century'];
// the vaguer of two precisions
export const vaguer = (p, q) => (PRECISIONS.indexOf(p) > PRECISIONS.indexOf(q) ? p : q);
// How precise an end is: one of PRECISIONS (a season or a part of a year counts as a year)
const precisionOf = (e) => (e.century ? 'century' : e.m != null && e.d != null ? 'day' : e.m != null ? 'month' : 'year');
// A date's words read as its two ends: { start, end }, each { span: [first day, the day after the last], precision },
// or null when neither names a year. One date is both ends; a range splits at its dash, "to", "or" or "and".
export function readDates(text) {
  const t = String(text ?? '').replace(/\([^)]*\)/g, ' ').replace(/\bc\.\s*/gi, ' ').replace(/[?,]/g, ' ').trim();
  const cut = /\s+[–—-]\s+|[–—]|(?<=\w)-(?=\w)|\s+(?:to|or|and)\s+/.exec(t);
  const a = dateEnd(cut ? t.slice(0, cut.index) : t), b = cut ? dateEnd(t.slice(cut.index + cut[0].length)) : a;
  if (cut) {
    if (b.small != null && b.m == null && b.y == null && a.y != null) { // "1165-66": the year cut short
      b.y = Math.floor(a.y / 100) * 100 + b.small;
      if (b.y < a.y) b.y += 100;
    } else if (b.small != null && b.d == null) b.d = b.small;
    if (a.small != null && a.d == null) a.d = a.small; // "20–26 Sep 1519": the day, its month and year from the other end
    if (a.d != null && a.m == null) a.m = b.m;
    if (a.y == null && a.century == null) { a.y = b.y; a.century = b.century; }
    if (a.bc == null) a.bc = b.bc;
    if (b.y == null && b.century == null) { b.y = a.y; b.bc ??= a.bc; } // "1324, to July": the year from the start
  } else if (a.small != null && a.m != null && a.d == null) a.d = a.small;
  const s = endSpan(a), e = endSpan(b);
  if (!s && !e) return null;
  const end = (span, x) => (span ? { span, precision: precisionOf(x) } : { span: [-Infinity, Infinity], precision: 'year' });
  return { start: end(s, a), end: end(e, b) };
}
// One of a leg's ISO `start` or `end` ("1519-11-29", "-0324-12", "1519~"), as an end; null when it does not read
export const ISO_DATE = /^(-?\d{1,4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?[~?]?$/;
function isoEnd(text) {
  const m = ISO_DATE.exec(String(text ?? ''));
  if (!m) return null;
  const y = Number(m[1]), mo = m[2] == null ? null : Number(m[2]) - 1, d = m[3] == null ? null : Number(m[3]);
  if (d != null) return { span: [dayOf(y, mo, d), dayOf(y, mo, d + 1)], precision: 'day' };
  if (mo != null) return { span: [dayOf(y, mo), dayOf(y, mo + 1)], precision: 'month' };
  return { span: [dayOf(y), dayOf(y + 1)], precision: 'year' };
}
// A leg's two ends: its ISO `start` and `end` where given, else its `dates` read; null when neither says a year
export function legDates(leg) {
  const words = readDates(leg?.dates), s = isoEnd(leg?.start), e = isoEnd(leg?.end);
  if (!s && !e) return words;
  return { start: s ?? words?.start ?? e, end: e ?? words?.end ?? s };
}
// A voyage's calendar, or null when none of its legs names a year: { t0, t1, n, legs, events }, days as dayOf counts them.
// Each leg { a, b, n, from, to, precision, stops }: the pen leaves its start on day a and reaches its end on day b, over
// n of the samples legPath gives it (n in all); precision the vaguer of its ends; stops the [sample, day, place] it
// passes, its two ends at least. Each event's day is the first its date allows, held inside [t0, t1]; one with no date
// read falls on t1, and a migration's waypoint that paces the pen falls on the day the pen reaches it.
// The ends of the legs in order (a leg's start, its end, the next leg's start, ...) each take a day inside their span,
// none earlier than the one before. Each takes the day its place in the order gives it, spaced evenly between the ends
// already settled (at first the voyage's first and last days); the one furthest outside its span is held at that
// span's edge and settled, and so on until all lie inside their spans. So six legs all dated "1271" share 1271
// evenly, and a day-precise end lands on its day.
// A migration (isMigration) is a people spreading, not one pen: its legs are branches under way at once (`concurrent`),
// each settled on its own dates. A leg sets out no earlier than the pen reaches its first point on a leg before it, and
// a leg dated by one date ("c. 1100 BC") arrives then, setting out as that earlier pen passes its start. A waypoint (an
// event of kind `waypoint` at one of a leg's points) is a stop the pen reaches on its date, so the pen is at Fiji as
// Fiji's settlement appears; the stops are settled as the ends are, spaced by their place along the line.
export function calendarOf(voyage) {
  const legs = voyage?.legs ?? [];
  if (!legs.length) return null;
  if (isMigration(voyage)) return streamCalendar(voyage);
  const ends = legs.map(legDates), knots = [];
  for (const d of ends) knots.push([...(d?.start.span ?? [-Infinity, Infinity])], [...(d?.end.span ?? [-Infinity, Infinity])]);
  const day = settle(knots);
  if (!day) return null;
  const out = legs.map((leg, i) => {
    const n = leg.points?.length > 1 ? legPath(leg).length : 0;
    return { a: day[2 * i], b: day[2 * i + 1], n, from: leg.from, to: leg.to, stops: [[0, day[2 * i], leg.from], [n, day[2 * i + 1], leg.to]],
      precision: ends[i] ? vaguer(ends[i].start.precision, ends[i].end.precision) : 'year' };
  });
  const t0 = day[0], t1 = day.at(-1);
  const events = (voyage.events ?? []).map((e) => { const d = readDates(e.date)?.start.span[0]; return Number.isFinite(d) ? Math.min(t1, Math.max(t0, d)) : t1; });
  return { t0, t1, n: out.reduce((s, l) => s + l.n, 0), legs: out, events };
}
// Days for knots in order, each [first, the day after the last] it may fall on, none before the one before (calendarOf).
// `at` places each knot along the way (its index by default) for the even spacing; null when no knot names a day.
function settle(knots, at = knots.map((_, i) => i)) {
  for (const k of knots) k[1] = Math.max(k[0], k[1] - 1e-6); // a span's last moment, not the day after it
  for (let i = 1; i < knots.length; i++) knots[i][0] = Math.max(knots[i][0], knots[i - 1][0]);
  for (let i = knots.length - 2; i >= 0; i--) knots[i][1] = Math.min(knots[i][1], knots[i + 1][1]);
  for (const k of knots) if (k[0] > k[1]) k[1] = k[0]; // spans that cannot all hold: the later bound gives way
  const finite = knots.flat().filter(Number.isFinite);
  if (!finite.length) return null;
  const N = knots.length, day = new Array(N).fill(NaN);
  day[0] = Number.isFinite(knots[0][0]) ? knots[0][0] : Math.min(...finite);
  day[N - 1] = Math.max(day[0], Number.isFinite(knots[N - 1][1]) ? knots[N - 1][1] : Math.max(...finite));
  const settled = new Set([0, N - 1]);
  for (;;) {
    const guess = day.slice();
    let lo = 0;
    for (let i = 1; i < N; i++) {
      if (!settled.has(i)) continue;
      for (let j = lo + 1; j < i; j++) guess[j] = day[lo] + ((day[i] - day[lo]) * (at[j] - at[lo])) / ((at[i] - at[lo]) || 1);
      lo = i;
    }
    let worst = -1, by = 0, to = 0;
    for (let j = 0; j < N; j++) {
      if (settled.has(j)) continue;
      const under = knots[j][0] - guess[j], over = guess[j] - knots[j][1];
      if (under > by) { worst = j; by = under; to = knots[j][0]; }
      if (over > by) { worst = j; by = over; to = knots[j][1]; }
    }
    if (worst < 0) { day.splice(0, N, ...guess); break; }
    day[worst] = to; settled.add(worst);
  }
  for (let j = 1; j < N; j++) day[j] = Math.max(day[j], day[j - 1]);
  return day;
}
const STOP_KM = 30; // a waypoint, or an earlier leg's stop, this near a leg's point is at it
// A migration's calendar (calendarOf): each leg settled on its own, its stops its two ends and the waypoints at its points
function streamCalendar(voyage) {
  const waypoints = (voyage.events ?? []).map((e, i) => ({ e, i })).filter(({ e }) => e.kind === 'waypoint' && Number.isFinite(e.lon) && Number.isFinite(e.lat));
  const taken = new Map(), passed = [], out = []; // taken: an event's index to the day the pen reaches it; passed: [lon, lat, day] of every stop
  const near = (p, q) => distanceKm(p, q) < STOP_KM, span = (end) => [...(end?.span ?? [-Infinity, Infinity])];
  for (const leg of voyage.legs) {
    const ends = legDates(leg), pts = leg.points ?? [], path = pts.length > 1 ? legPath(leg) : [], n = path.length, flat = unwrap(pts);
    let first = span(ends?.start), last = span(ends?.end);
    const parent = pts.length ? passed.filter((q) => near(q, pts[0])).reduce((d, q) => Math.min(d, q[2]), Infinity) : Infinity;
    if (Number.isFinite(parent)) first = first[0] === last[0] && first[1] === last[1] ? [parent, parent] : [Math.max(first[0], parent), Math.max(first[1], parent)];
    const stops = [{ at: 0, span: first, place: leg.from }, { at: n, span: last, place: leg.to }];
    if (n) for (const [k, p] of pts.entries()) {
      const w = waypoints.find(({ e, i }) => !taken.has(i) && !stops.some((s) => s.event === i) && near([e.lon, e.lat], p));
      if (!w) continue;
      const r = readDates(w.e.date), ws = r ? [r.start.span[0], r.end.span[1]] : [-Infinity, Infinity];
      const meet = (s) => (Math.max(s[0], ws[0]) < Math.min(s[1], ws[1]) ? [Math.max(s[0], ws[0]), Math.min(s[1], ws[1])] : s);
      const end = k === 0 ? stops[0] : k === pts.length - 1 ? stops[1] : null;
      if (end) { // a waypoint at an end dates it more closely than the leg's range does, inside that range
        const whole = [first[0], last[1]], both = meet(whole);
        if (both !== whole && (end !== stops[0] || !Number.isFinite(parent))) end.span = both;
        end.event = w.i; end.place = w.e.label ?? end.place; continue;
      }
      const at = path.reduce((best, q, j) => (distanceKm(flat[k], q) < distanceKm(flat[k], path[best]) ? j : best), 0);
      stops.push({ at, span: ws, place: w.e.label, event: w.i });
    }
    stops.sort((s, t) => s.at - t.at);
    const day = settle(stops.map((s) => s.span), stops.map((s) => s.at));
    if (!day) { out.push(null); continue; }
    stops.forEach((s, j) => {
      if (s.event != null) taken.set(s.event, day[j]);
      const p = s.at === 0 ? pts[0] : s.at === n ? pts.at(-1) : path[s.at];
      if (p) passed.push([p[0], p[1], day[j]]);
    });
    out.push({ a: day[0], b: day.at(-1), n, from: leg.from, to: leg.to, stops: stops.map((s, j) => [s.at, day[j], s.place]),
      precision: ends ? vaguer(ends.start.precision, ends.end.precision) : 'year' });
  }
  const dated = out.filter(Boolean);
  if (!dated.length) return null;
  const t0 = Math.min(...dated.map((l) => l.a)), t1 = Math.max(...dated.map((l) => l.b));
  const legs = out.map((l, i) => l ?? { a: t1, b: t1, n: 0, from: voyage.legs[i].from, to: voyage.legs[i].to, stops: [], precision: 'year' });
  const events = (voyage.events ?? []).map((e, i) => {
    if (taken.has(i)) return taken.get(i);
    const d = readDates(e.date)?.start.span[0];
    return Number.isFinite(d) ? Math.min(t1, Math.max(t0, d)) : t1;
  });
  return { t0, t1, n: legs.reduce((s, l) => s + l.n, 0), legs, events, concurrent: true };
}
// How far the pen on one leg has come on `day`, in samples: between the two stops it lies between
function drawnOn(l, day) {
  if (!(day > l.a)) return 0;
  if (day >= l.b || l.stops.length < 2) return l.n;
  const s = l.stops, j = Math.max(0, s.findIndex((q, k) => k + 1 < s.length && day < s[k + 1][1]));
  const [x0, d0] = s[j], [x1, d1] = s[j + 1];
  return d1 > d0 ? x0 + ((x1 - x0) * (day - d0)) / (d1 - d0) : x1;
}
// The stretch of a leg the pen is on at `day`: [from, to], the places of the stops either side of it
function stretchOn(l, day) {
  const s = l.stops, j = s.findIndex((q, k) => k + 1 < s.length && day < s[k + 1][1]);
  return j < 0 ? [l.from, l.to] : [s[j][2] ?? l.from, s[j + 1][2] ?? l.to];
}
// Where the pen is on `day`: { share, leg, waiting, before, from, to, legs }: the share of the line drawn (as scene.mjs
// drawTrack's `reveal` counts it, by samples), the leg it is on, whether it sits still (at the end of leg `before`) before
// that leg sets out, the stretch it is on, and each leg's share drawn (scene.mjs drawStream's `legReveal`). On a
// migration's calendar every leg under way draws at once, and the leg named is the one that set out latest.
export function penOn(cal, day) {
  const legs = cal.legs.map((l) => (l.n ? drawnOn(l, day) / l.n : day >= l.b ? 1 : 0)), share = (walked) => (cal.n ? walked / cal.n : 0);
  if (cal.concurrent) {
    const ids = cal.legs.map((_, i) => i), L = cal.legs, walked = L.reduce((s, l, i) => s + legs[i] * l.n, 0);
    const going = ids.filter((i) => L[i].a <= day && day < L[i].b);
    if (going.length) {
      const i = going.reduce((m, j) => (L[j].a >= L[m].a ? j : m)), [from, to] = stretchOn(L[i], day);
      return { share: share(walked), leg: i, waiting: false, before: null, from, to, legs };
    }
    const last = ids.filter((i) => L[i].b <= day).reduce((m, j) => (m < 0 || L[j].b >= L[m].b ? j : m), -1);
    const next = ids.filter((i) => L[i].a > day).reduce((m, j) => (m < 0 || L[j].a < L[m].a ? j : m), -1);
    if (last < 0 || next < 0) { const i = last < 0 ? Math.max(0, next) : last; return { share: next < 0 ? 1 : share(walked), leg: i, waiting: false, before: null, from: L[i].from, to: L[i].to, legs }; }
    return { share: share(walked), leg: next, waiting: true, before: last, from: L[last].to, to: L[last].to, legs };
  }
  let walked = 0;
  for (const [i, l] of cal.legs.entries()) {
    if (day < l.a) return { share: share(walked), leg: i, waiting: i > 0, before: i > 0 ? i - 1 : null, from: i > 0 ? cal.legs[i - 1].to : l.from, to: l.to, legs };
    if (day < l.b) return { share: share(walked + (l.n * (day - l.a)) / (l.b - l.a)), leg: i, waiting: false, before: null, from: l.from, to: l.to, legs };
    walked += l.n;
  }
  const end = cal.legs.at(-1);
  return { share: 1, leg: cal.legs.length - 1, waiting: false, before: null, from: end.from, to: end.to, legs };
}
// A scene's voyage played to `day` on its calendar: { reveal, legReveal, played }, as scene.mjs drawTrack and drawStream
// read them; reveal held short of 1, so the pen still shows on the last day of a play under way
export function playedOn(voyage, cal, day) {
  const pen = penOn(cal, day);
  return { reveal: Math.min(0.999999, pen.share), legReveal: pen.legs, played: (voyage.events ?? []).filter((_, i) => cal.events[i] <= day) };
}
// A day as the band writes it, at a precision: "20 Jun 1520", "Jun 1520", "1520", "325 BC", "c. 1250"
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function dayText(day, precision = 'day') {
  const t = new Date(Math.floor(day) * 864e5), y = t.getUTCFullYear(), year = y < 1 ? `${1 - y} BC` : String(y);
  if (precision === 'century') return `c. ${year}`;
  if (precision === 'year') return year;
  if (precision === 'month') return `${MONTH_SHORT[t.getUTCMonth()]} ${year}`;
  return `${t.getUTCDate()} ${MONTH_SHORT[t.getUTCMonth()]} ${year}`;
}
// The band's time scale. A calendar longer than LONG_YEARS is told in years: its date "c. 1210 BC", rounded to a step
// that keeps the number legible as it runs (10 years past 200, 50 past 1,000), and its pace "about 80 years a second".
// A shorter one keeps its leg's precision and "1,083 days in 9 s".
export const LONG_YEARS = 50;
const yearsOf = (cal) => (cal.t1 - cal.t0) / 365.25;
export const isLong = (cal) => yearsOf(cal) > LONG_YEARS;
export function playDateText(cal, day, precision = 'day') {
  if (!isLong(cal)) return dayText(day, precision);
  const span = yearsOf(cal), step = span > 1000 ? 50 : span > 200 ? 10 : 1;
  const y = new Date(Math.floor(day) * 864e5).getUTCFullYear(), bc = y < 1, n = Math.max(1, Math.round((bc ? 1 - y : y) / step) * step);
  return `c. ${n}${bc ? ' BC' : ''}`;
}
export function playPace(cal, seconds) {
  const days = Math.round(cal.t1 - cal.t0), years = days / 365.25;
  if (!isLong(cal)) return `${years >= 3 ? `${Math.round(years)} years` : `${days.toLocaleString('en')} days`} in ${seconds} s`;
  const each = years / seconds, n = each < 10 ? Math.round(each) : Math.round(each / 10) * 10;
  return `about ${n.toLocaleString('en')} year${n === 1 ? '' : 's'} a second`;
}
// How long the play takes, the whole voyage however long it was, in seconds; carried by the link as `voyageplay=`.
// voyagePlaySeconds reads it back: a value outside the range or off its steps is the default.
export const VOYAGE_PLAY = { min: 3, max: 30, step: 1, seconds: 9 };
export function voyagePlaySeconds(text) {
  const s = Number(text), { min, max, step, seconds } = VOYAGE_PLAY;
  return text != null && text !== '' && s >= min && s <= max && Number.isInteger((s - min) / step) ? s : seconds;
}
