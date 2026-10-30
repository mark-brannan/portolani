// People: the navigators and travellers behind the voyages, as the People drawer (public/page.js) and the scene
// (scene.mjs) read them. Their records are data/voyages/people.json, keyed by slug (checkPerson in voyages.mjs is the
// schema), and a person's voyages are those whose `who` names that slug. Their `born` and `death` are markers ({ lon,
// lat, date, place, label, text, source, confidence }; a death with no lon and lat is not drawn), and `images` pictures
// on Wikimedia Commons, best first ({ file, kind, author, date, licence }), shrunk for the site by
// scripts/build-people.mjs into packs/overlays/people/.
import { DASHES, VOYAGE_DIR } from './voyages.mjs';
export { DASHES };

export const PEOPLE_FILE = 'data/voyages/people.json';
export const PICTURES_FILE = 'packs/overlays/people/people.json';
export const PERSON_RED = '#8c2f1e'; // the chosen person's bar and voyages: the chart's red (scene.mjs windRed)
export const DIMMED = 0.2; // the alpha of every other voyage while a person is chosen

// Each voyage's `who`, { [voyage id]: [slug] } in the menu's order (index.json), read through `readJSON(path)`
export async function whoOf(readJSON) {
  const ids = await readJSON(`${VOYAGE_DIR}/index.json`);
  const vs = await Promise.all(ids.map((id) => Promise.resolve(readJSON(`${VOYAGE_DIR}/${id}.json`)).catch(() => null)));
  return Object.fromEntries(ids.map((id, i) => [id, vs[i]?.who ?? []]));
}
// The people the drawer lists, from people.json, in the file's order: each record with its slug as `id`, its name (the
// slug where it has none), and `voyages`, the ids of the voyages whose `who` names it (`who` from whoOf).
export const peopleOf = (json, who = {}) => Object.entries(json ?? {}).filter(([, p]) => p && typeof p === 'object')
  .map(([id, p]) => ({ ...p, id, name: p.name ?? id, voyages: Object.keys(who).filter((v) => who[v].includes(id)), images: p.images ?? [] }));
// A death as a marker, or null where nobody knows
export const deathOf = (p) => (p.death && typeof p.death === 'object' ? p.death : null);

// A year text as a number, negative before Christ: "c. 350 BC" -350, "c. 970s" 970, "24 Feb 1304" 1304, "5th century
// BC" -450 (its middle); NaN for none. A day of the month is skipped: the year is the first number of three digits or
// more, else the last one.
export function yearOf(text) {
  const s = String(text ?? ''), bc = /\bBCE?\b/.test(s) ? -1 : 1, c = /(\d+)(?:st|nd|rd|th) century/.exec(s);
  if (c) return bc * ((Number(c[1]) - 1) * 100 + 50);
  const nums = [...s.matchAll(/\d+/g)].map((m) => Number(m[0]));
  if (!nums.length) return NaN;
  return bc * (nums.find((n) => n >= 100) ?? nums.at(-1));
}

// The years a person's life bar spans: [from, to, fromKnown, toKnown]. A side the record leaves open (a birth or a
// death nobody dated, or one only guessed at) runs from the person's voyages, `reach` years further, and is drawn fading.
export function lifeSpan(person, voyageYears = [], reach = 40) {
  const death = deathOf(person), b = yearOf(person.born?.date), d = yearOf(death?.date);
  const vs = voyageYears.filter(Number.isFinite);
  const lo = Number.isFinite(b) ? b : Math.min(...vs), hi = Number.isFinite(d) ? d : Math.max(...vs, lo);
  const fromKnown = Number.isFinite(b) && person.born.confidence !== 'speculative', toKnown = Number.isFinite(d) && death.confidence !== 'speculative';
  return [fromKnown ? lo : lo - reach, toKnown ? hi : hi + reach, fromKnown, toKnown];
}

// The timeline the People and Voyages buttons share: one linear year axis, people above it and voyages below, from the
// Lapita voyages (TIMELINE_FROM) to this year, at true scale throughout, so an empty stretch reads as empty rather than
// cut out. "Earlier" adds a stretch before it, back to TIMELINE_EARLIEST, at its own linear scale (a broken axis): the
// main stretch keeps its width and the earlier one takes EARLIER_SHARE of it again, to its left.
export const TIMELINE_FROM = -1500;
export const TIMELINE_EARLIEST = -50000;
export const EARLIER_SHARE = 0.5;
// The eras of the points of interest (the Sights groups in public/page.js), as bands behind both lanes: each from its
// year to the next one's, the last to the axis's end, the first from the axis's start.
export const TIMELINE_ERAS = [['The ancient world', TIMELINE_FROM], ['The medieval Indian Ocean and Asia', 500], ['The age of discovery', 1450], ['The modern world', 1800]];
// The windows of the peopling of Sahul, Beringia and the Americas, marked on the earlier stretch: [label, year, title].
export const EARLIER_MARKS = [['Sahul', -50000, 'Sahul, the first peopling of Australia and New Guinea, c. 50,000 BC or earlier'], ['Beringia', -20000, 'Beringia, the land bridge into the Americas, c. 20,000 BC'], ['Clovis', -11000, 'Clovis, c. 11,000 BC']];

// The axis: { width, stretches: [[from, to, x0, x1]], x(year), ticks: [[year, label]] }, with x in 0..1 of the whole
// track and `width` the track's width in main stretches (1, or 1 + EARLIER_SHARE with the earlier stretch).
export function laneAxis({ earlier = false, to = new Date().getFullYear() } = {}) {
  const width = earlier ? 1 + EARLIER_SHARE : 1, k = 1 / width;
  const stretches = [...(earlier ? [[TIMELINE_EARLIEST, TIMELINE_FROM, 0, EARLIER_SHARE * k]] : []), [TIMELINE_FROM, to, 1 - k, 1]];
  const x = (year) => {
    for (const [a, b, x0, x1] of stretches) if (year <= b) return year < a ? x0 : x0 + ((year - a) / (b - a)) * (x1 - x0);
    return 1;
  };
  const ticks = [...(earlier ? [-50000, -40000, -30000, -20000, -10000] : []), -1500, -1000, -500, 1, 500, 1000, 1500, 2000]
    .filter((y) => y <= to).map((y) => [y, yearLabel(y)]);
  return { width, stretches, x, ticks };
}
export const yearLabel = (y) => (y < 0 ? `${(-y).toLocaleString('en')} BC` : y === 1 ? 'AD 1' : String(y));
// The era bands on an axis: [name, from, to], end to end from the main stretch's start to its end.
export function eraBands(axis) {
  const [from, to] = axis.stretches.at(-1);
  return TIMELINE_ERAS.map(([name, a], i) => [name, Math.max(a, from), Math.min(TIMELINE_ERAS[i + 1]?.[1] ?? to, to)]).filter(([, a, b]) => b > a);
}

// The birth and, for a person with no voyage of their own to carry it, the death, as a voyage of events alone, which
// the scene draws and the tile opens like any voyage's marks. `cite` resolves through `sources` (sources.json), as a
// voyage's does.
export function personMarks(person, sources = {}) {
  const linked = ({ cite, ...e }) => (sources[cite]?.url ? { ...e, cited: sources[cite] } : e);
  const events = [];
  if (person.born && Number.isFinite(person.born.lon)) events.push(linked({ kind: 'birth', who: person.name, ...person.born }));
  const death = deathOf(person);
  if (!person.voyages?.length && death && Number.isFinite(death.lon)) events.push(linked({ kind: 'death', who: person.name, ...death }));
  return { id: `person-${person.id}`, title: person.name, legs: [], events };
}

// The voyages to draw with a person chosen: theirs first, lit in the person's red, then every other voyage chosen,
// dimmed. `list` is the scene's voyages option ([{ id, colour, width }]).
export function withPerson(list, person, width) {
  const own = new Set(person?.voyages ?? []);
  if (!person) return list;
  return [...[...own].map((id) => ({ id, colour: PERSON_RED, width })), ...list.filter((v) => !own.has(v.id)).map((v) => ({ ...v, alpha: DIMMED }))];
}

// A picture's file on the site, from its Commons title: lower case, ascii, dashes; the extension the build writes.
export function pictureName(file) {
  return String(file).replace(/^File:/, '').replace(/\.[a-z]+$/i, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) + '.jpg';
}
// A picture's page on Commons
export const commonsPage = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(String(file).replace(/^File:/, '').replace(/ /g, '_'))}`;

// The caption a picture carries on the card: what it is, when it was made, by whom, under what licence.
const KIND_WORDS = { life: 'from life', near: 'near life', posthumous: 'posthumous', imaginary: 'imagined', modern: 'modern', none: 'no likeness', scene: 'scene', ship: 'ship', map: 'map' };
export const pictureCredit = (im) => [[KIND_WORDS[im.kind] ?? im.kind, im.date].filter(Boolean).join(', '), im.author, im.licence].filter(Boolean).join(' · ');

// The years a voyage's `when` spans, [first, last], negative before Christ: "c. 330–320 BC" [-330, -320]; [NaN, NaN] for none.
export function voyageYears(when) {
  const s = String(when ?? ''), nums = [...s.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => n >= 100);
  if (!nums.length) return [NaN, NaN];
  const sign = /\bBCE?\b/.test(s) ? -1 : 1;
  return [sign * nums[0], sign * nums.at(-1)];
}

// The link's picture keys. `pictures=0,2`: which of the chosen person's pictures lie on the map, by their place in the
// record's list; left out, the default (the first); `none` for none. `pictureat=0:lon,lat,scale_2:lon,lat,scale`: where
// a picture was dragged and how large it was made, by the same index; one not named lies at its own place.
export function parsePictures(text, dflt) {
  if (text == null) return dflt;
  if (text === 'none') return [];
  const out = [];
  for (const t of String(text).split(',')) { const i = Number(t); if (/^\d{1,2}$/.test(t) && !out.includes(i)) out.push(i); }
  return out;
}
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
export const picturesText = (list, dflt) => (sameList(list, dflt) ? null : list.length ? list.join(',') : 'none');
export function parsePictureAt(text) {
  const out = {};
  for (const part of String(text ?? '').split('_')) {
    const m = /^(\d{1,2}):(-?[\d.]+),(-?[\d.]+),([\d.e-]+)$/.exec(part);
    if (!m) continue;
    const [lon, lat, scale] = [m[2], m[3], m[4]].map(Number);
    if (Math.abs(lon) <= 540 && Math.abs(lat) <= 85 && scale > 0 && scale < 10) out[Number(m[1])] = { lon, lat, scale };
  }
  return out;
}
export const pictureAtText = (at) => Object.entries(at).map(([i, s]) => `${i}:${s.lon.toFixed(3)},${s.lat.toFixed(3)},${Number(s.scale.toPrecision(4))}`).join('_') || null;

// The lon/lat box round a person's marks and voyages: `points` [lon, lat], longitudes wrapped; null for none. A box
// wider than half the world is the whole width of it.
export function frameOf(points) {
  const ok = points.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (!ok.length) return null;
  const lons = ok.map((p) => p[0]), lats = ok.map((p) => p[1]);
  let lonMin = Math.min(...lons), lonMax = Math.max(...lons);
  if (lonMax - lonMin > 200) { lonMin = -180; lonMax = 180; }
  return { lonMin, lonMax, latMin: Math.min(...lats), latMax: Math.max(...lats) };
}
// The view that shows the whole of `frame` on a `w` x `h` canvas with `pad` of its size clear round it: contained, never cropped.
export function viewContaining(frame, { w = 1600, h = 1000, pad = 0.08 } = {}) {
  const RAD = Math.PI / 180, mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2));
  const y0 = mercY(frame.latMin), y1 = mercY(frame.latMax), dlon = Math.max(1, frame.lonMax - frame.lonMin) * RAD, dy = Math.max(0.02, y1 - y0);
  const k = Math.min(w / (dlon * (1 + 2 * pad)), h / (dy * (1 + 2 * pad)));
  return { lon: (frame.lonMin + frame.lonMax) / 2, lat: (2 * Math.atan(Math.exp((y0 + y1) / 2)) - Math.PI / 2) / RAD, zoom: Math.log2((k * 2 * Math.PI) / 512) };
}

// Where a person's pictures lie by default, from `frame` (the lon/lat box of their birth, death and voyages): each as tall
// as two fifths of the frame (in Mercator degrees, 3 to 30), side by side in a row under the frame's south edge, from its
// west edge eastward. `sizes` are the pictures' [width, height] in px. Returns [{ lon, lat, scale, turn: 0 }], scale in
// Mercator degrees per px, as a chart's sheet (overlays.mjs).
export function picturePlaces(frame, sizes) {
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;
  const latOf = (m) => (2 * Math.atan(Math.exp((m * Math.PI) / 180)) - Math.PI / 2) * 180 / Math.PI;
  const m0 = merc(Math.max(-80, frame.latMin)), m1 = merc(Math.min(80, frame.latMax));
  const tall = Math.max(3, Math.min(30, (m1 - m0) * 0.4)), gap = tall * 0.08;
  let x = frame.lonMin;
  return sizes.map(([w, h]) => {
    const scale = tall / h, wide = w * scale, at = { lon: x + wide / 2, lat: latOf(Math.max(merc(-80) + tall / 2, m0 - gap - tall / 2)), scale, turn: 0 };
    x += wide + gap;
    return at;
  });
}
// The box of `frame` and the pictures laid at `places` (picturePlaces), each `sizes` [width, height] px: what a view
// shows to frame a person whole.
export function withPictures(frame, places, sizes) {
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;
  const latOf = (m) => (2 * Math.atan(Math.exp((m * Math.PI) / 180)) - Math.PI / 2) * 180 / Math.PI;
  const box = { ...frame };
  places.forEach((s, k) => {
    const [w, h] = sizes[k], m = merc(s.lat);
    box.lonMin = Math.min(box.lonMin, s.lon - (w * s.scale) / 2); box.lonMax = Math.max(box.lonMax, s.lon + (w * s.scale) / 2);
    box.latMin = Math.min(box.latMin, latOf(m - (h * s.scale) / 2)); box.latMax = Math.max(box.latMax, latOf(m + (h * s.scale) / 2));
  });
  return box;
}
