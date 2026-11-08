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
// A sight's pictures (data/sights/pictures.json, keyed by the tile's name in sights.mjs SIGHT_TILES, each a list in the
// people's `images` shape with a one-line `caption` of what it shows), built by the same script into packs/overlays/sights/.
export const SIGHT_PICTURES_FILE = 'data/sights/pictures.json';
export const SIGHT_MANIFEST_FILE = 'packs/overlays/sights/sights.json';
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
// BC" -450 (its middle), "c. 1,000,000–700,000 BC" -1000000; NaN for none. A thousands comma is read through. A day of
// the month is skipped: the year is the first number of three digits or more, else the last one.
export function yearOf(text) {
  const s = String(text ?? '').replace(/(\d),(?=\d{3}\b)/g, '$1'), bc = /\bBCE?\b/.test(s) ? -1 : 1, c = /(\d+)(?:st|nd|rd|th) century/.exec(s);
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

// The People and the Voyages drawers are each a vertical timeline, earliest at the top. Their eras head the rows that
// fall in them, as small italic headings: each era runs from its year to the next one's, the last on to today. They are
// slices of time, named for it, apart from the Sights groups in public/page.js, which group places by theme.
// a year as the drawers write it: 1500 BC, AD 1, 1500, with a thousands comma only from five figures (50,000 BC)
export const yearLabel = (y) => { const n = Math.abs(y), t = n >= 10000 ? n.toLocaleString('en') : String(n); return y < 0 ? `${t} BC` : y === 1 ? 'AD 1' : t; };

// The first crossing into Wallacea, c. 1,000,000 BC: the start of deep history and of the People drawer's heading bar
export const TIMELINE_EARLIEST = -1000000;
export const DRAWER_ERAS = [
  ['Deep history', TIMELINE_EARLIEST],
  ['The Bronze Age', -3300],
  ['The ancient world', -1200],
  ['The medieval world', 500],
  ['The age of discovery', 1450],
  ['The age of Enlightenment', 1650],
  ['The modern world', 1800],
];
// The era a year falls in, by name: the first era for anything before it; null for no year
export function eraOf(year) {
  if (!Number.isFinite(year)) return null;
  let name = DRAWER_ERAS[0][0];
  for (const [n, from] of DRAWER_ERAS) if (year >= from) name = n;
  return name;
}
const eraEnds = (name, now) => {
  const i = DRAWER_ERAS.findIndex(([n]) => n === name);
  return i < 0 ? null : [DRAWER_ERAS[i][1], DRAWER_ERAS[i + 1]?.[1] ?? now];
};
// A span's years as a heading writes them: "1500 BC – AD 500", "1,000,000 – 1500 BC", "500 – 1450", "from 1800"
export function spanYears(from, to) {
  if (to === undefined) return `from ${yearLabel(from)}`;
  if (to < 0) return `${yearLabel(-from)} – ${yearLabel(to)}`;
  return `${yearLabel(from)} – ${from < 0 ? `AD ${to}` : yearLabel(to)}`;
}
// An era's years as its heading writes them
export function eraYears(name) {
  const ends = eraEnds(name);
  return ends ? spanYears(...ends) : '';
}
// A linear scale from `from` to `to`, for the life bars of the rows under a heading: { from, to, x(year) in 0..1
// clamped, ticks: [[year, label]] }, the ticks on round years, four or fewer between the ends
export function spanScale(from, to) {
  const step = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000].find((s) => (to - from) / s <= 5) ?? 250000;
  const ticks = [];
  for (let y = Math.ceil((from + 1) / step) * step; y < to; y += step) ticks.push([y || 1, yearLabel(y || 1)]);
  return { from, to, x: (y) => Math.min(1, Math.max(0, (y - from) / (to - from))), ticks };
}
// An era's own scale (spanScale), from its year to the next era's, the last era to `now`. Each era has its own scale
// so a life of sixty years reads at any era's width; the ruler under the heading says which.
export function eraScale(name, now = new Date().getFullYear()) {
  const ends = eraEnds(name, now);
  return ends ? spanScale(...ends) : null;
}

// The People drawer's heading bar: one faded bar under every heading, from 1,000,000 BC (TIMELINE_EARLIEST) to today,
// on which each era is a band and the rows under an open heading are ticks. Its scale is log10(years ago + 500), which
// gives deep history about 72% of the bar and the modern world about 5%; x in 0..1, clamped.
export const DEEP_OFFSET = 500;
export function deepX(year, now = new Date().getFullYear()) {
  const l = (y) => Math.log10(Math.max(0, now - y) + DEEP_OFFSET), top = l(TIMELINE_EARLIEST), end = l(now);
  return Math.min(1, Math.max(0, (top - l(year)) / (top - end)));
}
// The eras on the heading bar: [name, x0, x1], end to end from 0 to 1
export const deepBands = (now = new Date().getFullYear()) =>
  DRAWER_ERAS.map(([name, a], i) => [name, deepX(a, now), deepX(DRAWER_ERAS[i + 1]?.[1] ?? now, now)]);

// The heading bar as a lens on one era (`open`, a name in DRAWER_ERAS): the open era takes LENS_SHARE of the bar and
// runs on its own straight scale (eraScale), so the people in it spread out, and the other eras are squeezed into the
// rest in their deepX proportion; [name, x0, x1] per era, end to end. With no era open, the bar is deepBands.
export const LENS_SHARE = 0.62;
export function lensBands(open, now = new Date().getFullYear(), share = LENS_SHARE) {
  const deep = deepBands(now);
  if (!deep.some(([n]) => n === open)) return deep;
  const rest = deep.filter(([n]) => n !== open).reduce((sum, [, a, b]) => sum + (b - a), 0);
  let x = 0;
  return deep.map(([n, a, b]) => {
    const w = n === open ? share : ((1 - share) * (b - a)) / rest, band = [n, x, x + w];
    x += w;
    return band;
  });
}
// A year's place on the lens bar (lensBands), 0..1
export function lensX(year, open, now = new Date().getFullYear()) {
  const era = eraOf(year);
  if (!era) return NaN;
  const band = lensBands(open, now).find(([n]) => n === era), [, a, b] = deepBands(now).find(([n]) => n === era);
  const t = era === open ? eraScale(era, now).x(year) : b > a ? (deepX(year, now) - a) / (b - a) : 0;
  return band[1] + (band[2] - band[1]) * Math.min(1, Math.max(0, t));
}

// A family of peoples: the records whose `family` names it sit, like every row, under the heading of their own era (one
// level of headings, no heading of the family's own); where two of a family share a year, they go in the family's
// order here, the user's on #399: the Austronesian-speaking voyagers, the first settlers of the Marianas and
// Micronesia, the Lapita. FAMILIES in voyages.mjs is the list checkPerson accepts.
export const FAMILY_ORDER = { austronesian: ['austronesian-voyagers', 'marianas-micronesia-settlers', 'lapita-people'] };
// A record that sits right before another in the People drawer, whatever its own year: the mansa before Musa, whose
// voyage is the reason Musa came to the throne (the user's on #399)
export const RIGHT_BEFORE = { 'abu-bakr-ii': 'mansa-musa' };
// A sorted list of [person, year] with each RIGHT_BEFORE record moved to just before its partner
export function withRightBefore(rows) {
  const out = rows.filter(([p]) => !RIGHT_BEFORE[p.id]);
  for (const row of rows.filter(([p]) => RIGHT_BEFORE[p.id])) {
    const i = out.findIndex(([q]) => q.id === RIGHT_BEFORE[row[0].id]);
    out.splice(i < 0 ? out.length : i, 0, row);
  }
  return out;
}
// A sort's tie-break for two people of one year: by their family's order where both are in it, else level (0)
export function familyOrder(a, b) {
  const list = a.family && a.family === b.family ? FAMILY_ORDER[a.family] : null, i = list?.indexOf(a.id) ?? -1, j = list?.indexOf(b.id) ?? -1;
  return i >= 0 && j >= 0 ? i - j : 0;
}
// A bar on an era's scale: [x0, x1, openStart, openEnd], an end open where the span runs past the era or the record
// leaves it undated (`fromKnown`, `toKnown`, as lifeSpan gives them)
export function barOn(scale, [a, b, fromKnown = true, toKnown = true]) {
  if (!scale || !Number.isFinite(a)) return null;
  const hi = Number.isFinite(b) ? b : a;
  return [scale.x(a), scale.x(hi), !fromKnown || a < scale.from, !toKnown || hi > scale.to];
}
// The year a person's row sorts by and takes its era from: their birth where it is dated, else the first year of
// their voyages (`voyageYears`, numbers); NaN for neither
export function firstYear(person, voyageYears = []) {
  const b = yearOf(person.born?.date), vs = voyageYears.filter(Number.isFinite);
  return Number.isFinite(b) ? b : vs.length ? Math.min(...vs) : NaN;
}
// The years after a person's name: "24 Feb 1304 – c. 1369", "born c. 350 BC", "died 1510"; for a person the record
// leaves undated (a people, or mariners nobody named), their voyages' years: one voyage's `when` as written, several
// as "fl. 1492 – 1504" from their first year to their last; nothing where there is none
export function yearsText(person, voyages = []) {
  const b = person.born?.date, d = deathOf(person)?.date;
  if (b && d) return `${b} – ${d}`;
  if (b) return `born ${b}`;
  if (d) return `died ${d}`;
  const whens = voyages.map((v) => v?.when).filter(Boolean);
  if (whens.length === 1) return whens[0];
  const ys = whens.flatMap((w) => voyageYears(w)).filter(Number.isFinite);
  return ys.length ? `fl. ${yearLabel(Math.min(...ys))} – ${yearLabel(Math.max(...ys))}` : '';
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

// The voyages to draw with a person chosen: theirs first, lit in the person's red, but for any of theirs the list
// carries hidden (its eye put it off), then every other voyage chosen, dimmed. `list` is the scene's voyages option
// ([{ id, colour, width, hidden }]); a voyage flagged hidden is left out of what is drawn.
export function withPerson(list, person, width) {
  if (!person) return list.filter((v) => !v.hidden);
  const hidden = new Set(list.filter((v) => v.hidden).map((v) => v.id)), own = new Set((person.voyages ?? []).filter((id) => !hidden.has(id)));
  return [...[...own].map((id) => ({ id, colour: PERSON_RED, width })), ...list.filter((v) => !own.has(v.id) && !v.hidden).map((v) => ({ ...v, alpha: DIMMED }))];
}

// A picture's file on the site, from its Commons title: lower case, ascii, dashes; the extension the build writes. A
// title with no ascii letter or digit in it (Cyrillic, Hebrew, Arabic) takes a short stable hash of the title instead.
export function pictureName(file) {
  const title = String(file).replace(/^File:/, '').replace(/\.[a-z]+$/i, '');
  const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  if (slug) return `${slug}.jpg`;
  let h = 0x811c9dc5; // FNV-1a, 32 bits
  for (const c of title) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0;
  return `commons-${h.toString(16).padStart(8, '0')}.jpg`;
}
// A picture's page on Commons
export const commonsPage = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(String(file).replace(/^File:/, '').replace(/ /g, '_'))}`;

// The caption a picture carries on the card: what it is, when it was made, by whom, under what licence.
const KIND_WORDS = { life: 'from life', near: 'near life', posthumous: 'posthumous', imaginary: 'imagined', modern: 'modern', none: 'no likeness', scene: 'scene', ship: 'ship', map: 'map', artefact: 'artefact', site: 'the place', source: 'the source', photo: 'photograph', air: 'from the air', space: 'from orbit', drawing: 'drawing' };
export const pictureCredit = (im) => [[KIND_WORDS[im.kind] ?? im.kind, im.date].filter(Boolean).join(', '), im.author, im.licence].filter(Boolean).join(' · ');
// What a picture shows, in a line: a sight's `caption`, a person's `note`
export const pictureNote = (im) => im.caption ?? im.note ?? null;
// The sights with pictures, from pictures.json: { [name]: [image record] }, a record without a file dropped
export const sightPicturesOf = (json) => Object.fromEntries(Object.entries(json ?? {}).filter(([, list]) => Array.isArray(list))
  .map(([name, list]) => [name, list.filter((im) => im && typeof im.file === 'string')]).filter(([, list]) => list.length));

// The years a voyage's `when` spans, [first, last], negative before Christ: "c. 330–320 BC" [-330, -320]; [NaN, NaN] for none.
export function voyageYears(when) {
  const s = String(when ?? '').replace(/(\d),(?=\d{3}\b)/g, '$1'), nums = [...s.matchAll(/\d+/g)].map((m) => Number(m[0])).filter((n) => n >= 100);
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

// The lon/lat box round a person's marks and voyages: `points` [lon, lat], longitudes wrapped; null for none. Its
// longitudes are the shortest arc that holds every point (the circle less its widest gap), so a box across the date
// line (the Lapita, Fiji to Samoa) stays the Pacific's width, its `lonMax` past 180 where it crosses; a box wider than
// 200 degrees is the whole width of the world.
export function frameOf(points) {
  const ok = points.filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  if (!ok.length) return null;
  const lons = [...new Set(ok.map(([lon]) => ((lon % 360) + 360) % 360))].sort((a, b) => a - b), lats = ok.map((p) => p[1]);
  let gap = 360 - lons.at(-1) + lons[0], west = lons[0];
  for (let i = 1; i < lons.length; i++) if (lons[i] - lons[i - 1] > gap) { gap = lons[i] - lons[i - 1]; west = lons[i]; }
  const span = 360 - gap, lonMin = west > 180 ? west - 360 : west;
  const [latMin, latMax] = [Math.min(...lats), Math.max(...lats)];
  return span > 200 ? { lonMin: -180, lonMax: 180, latMin, latMax } : { lonMin, lonMax: lonMin + span, latMin, latMax };
}
// The view that shows the whole of `frame` on a `w` x `h` canvas with `pad` of its size clear round it: contained, never cropped.
export function viewContaining(frame, { w = 1600, h = 1000, pad = 0.08 } = {}) {
  const RAD = Math.PI / 180, mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * RAD) / 2));
  const y0 = mercY(frame.latMin), y1 = mercY(frame.latMax), dlon = Math.max(1, frame.lonMax - frame.lonMin) * RAD, dy = Math.max(0.02, y1 - y0);
  const k = Math.min(w / (dlon * (1 + 2 * pad)), h / (dy * (1 + 2 * pad)));
  return { lon: (frame.lonMin + frame.lonMax) / 2, lat: (2 * Math.atan(Math.exp((y0 + y1) / 2)) - Math.PI / 2) / RAD, zoom: Math.log2((k * 2 * Math.PI) / 512) };
}

// The box round a sight's spots (`at` [lon, lat], one or several), `pad` degrees clear round them; null for none.
export const SIGHT_PAD = 0.01; // degrees, about 1.1 km: clear of the ruin marks at the zooms a tile opens at
export function sightFrame(at, pad = SIGHT_PAD) {
  const f = frameOf(at);
  return f && { lonMin: f.lonMin - pad, lonMax: f.lonMax + pad, latMin: f.latMin - pad, latMax: f.latMax + pad };
}
// A sight's pictures are dealt in screen terms, not from its frame: a town is a few kilometres across at any zoom, so
// its row lies along the foot of the window it is dealt in (`win` { x0, x1, y0, y1 }, canvas px), in the bottom third,
// as tall as `fill` of the window's height or less so the row fits its width, each laid `overlap` of its width over the
// one before, centred under the place (`at` [x, y]) and slid inside the window. `clear` says whether the place stands
// clear above the row (`gap` of the window's height or more); where it does not, the page moves the map to the place.
// Returns { clear, row: [{ x, y, h }] }, each picture's centre and height in canvas px, for `sizes` [width, height] px.
export const SIGHT_DEAL = { fill: 0.27, overlap: 0.35, foot: 0.05, side: 0.02, gap: 0.06 };
export function sightDeal(sizes, win, at, { fill, overlap, foot, side, gap } = SIGHT_DEAL) {
  const ww = win.x1 - win.x0, wh = win.y1 - win.y0;
  if (!sizes.length) return { clear: true, row: [] };
  const ratios = sizes.map(([w, h]) => w / h), span = ratios.reduce((a, r, k) => a + (k < ratios.length - 1 ? r * (1 - overlap) : r), 0);
  const h = Math.min(wh * fill, (ww * (1 - 2 * side)) / span), width = span * h, y = win.y1 - wh * foot - h / 2;
  let x = Math.max(win.x0 + ww * side, Math.min(win.x1 - ww * side - width, at[0] - width / 2));
  const row = ratios.map((r) => { const c = { x: x + (r * h) / 2, y, h }; x += r * h * (1 - overlap); return c; });
  return { clear: at[1] <= y - h / 2 - wh * gap, row };
}

// The line under the skull that clears the chart table (public/page.js): a memento mori in the hands of the charts'
// centuries, one shown at a time, the first at random, each clear of the table moving on to the next and the last back
// to the first.
// Each entry: `text` in its original language (a '\n' is a line break the source keeps, shown as set in the big clear),
// `en` its English (the skull's hover text; a '\n' likewise), `lang` an ISO 639 code. Optional: `romaji` (a Japanese
// verse's reading, line for line), `enBy` ('claude' where the English is not the user's own), `credit` an author the user
// recalls but has not verified, `variant` another spelling of the same text, `kind` ('jisei' for a Japanese death poem),
// `source` where the text comes from, only when verified.
export const MEMENTO_ENTRIES = [
  { lang: 'la', text: 'Memento, homo, quia pulvis es, et in pulverem reverteris', en: 'Remember, man, that you are dust, and to dust you shall return' },
  { lang: 'la', text: 'Pulvis et umbra sumus', en: 'We are dust and shadow' },
  { lang: 'la', text: 'Hodie mihi, cras tibi', en: 'Today me, tomorrow you' },
  { lang: 'la', text: 'Mors certa, hora incerta', en: 'Death is certain, its hour uncertain' },
  { lang: 'sco', text: 'All flesche is grasse', en: 'All flesh is grass' },
  { lang: 'enm', text: 'Erthe out of erthe is wonderly wrought, Erthe hath of erthe a dignite of nought', en: 'Earth out of earth is wondrously wrought; earth has of earth a dignity of nought' },
  { lang: 'it', text: 'Ogni uomo è polvere', en: 'Every man is dust' },
  { lang: 'it', text: 'Ricordati che devi morire', en: 'Remember that you must die' },
  { lang: 'es', text: 'Polvo eres, y en polvo te has de convertir', en: 'Dust you are, and to dust you shall return' },
  { lang: 'es', text: 'Nuestras vidas son los ríos que van a dar en la mar, que es el morir', en: 'Our lives are the rivers that flow into the sea, which is dying' },
  { lang: 'es', text: 'Recuerda que eres polvo', en: 'Remember that you are dust' },
  { lang: 'la', text: 'Omnia mors aequat', en: 'Death makes all things equal' },
  { lang: 'la', text: 'Memento vivere', en: 'Remember to live' }, // the user's gloss: "Literally 'remember to live'"
  { lang: 'la', text: 'Respice finem', en: 'Consider the end' },
  { lang: 'la', text: 'longae vitae mors media est', en: 'Death stands in the midst of a long life', enBy: 'claude' },
  { lang: 'non', source: 'Hávamál 76',
    text: 'Deyr fé, deyja frændr,\ndeyr sjalfr it sama;\nen orðstírr deyr aldregi,\nhveim er sér góðan getr.',
    en: 'Cattle die, kinsmen die,\nyou yourself die the same;\nbut a good name never dies\nfor whoever wins one.', enBy: 'claude' },
  { lang: 'non', text: 'Geyma skal þess, at maðr lifir eigi ey,\nþótt hann vari sik við stríð.', en: 'Keep this in mind: no one lives forever,\nthough he guard himself in battle.', enBy: 'claude' },
  { lang: 'pi', // romanised, as Pali is
    text: 'Vijju bubbula ussāva – jalarāji parikkhayaṁ\nGhātako’va ripūtassa – sabbatthā’pi avāriyo',
    en: '...like a streak of lightning, a bubble of water, a dew drop on a leaf, or a line drawn on water.' },
  { lang: 'pi',
    text: 'Īsakaṁ anivattaṁ taṁ – satataṁ gamanussukaṁ\nJīvitaṁ udayā atthaṁ – suriyo viya dhāvati',
    en: '...like the sun that travels to set without stopping after it rises.' },
  { lang: 'ja', kind: 'jisei', text: '斯う活て居るも不思議ぞ花の陰', variant: '斯う活ているも不思議ぞ花の陰',
    romaji: 'Kō ikite iru mo fushigi zo hana no kage',
    en: 'Living thus, being alive, what a wonder! In shadows of cherry blossoms' },
  { lang: 'en', kind: 'jisei', text: 'Cherry blossoms fall\nwhen the time is right\nI too will fall\nwhen it is time to go',
    en: 'Cherry blossoms fall\nwhen the time is right\nI too will fall\nwhen it is time to go',
    credit: 'Roy Isami Ebata (1919–1990), written in the margin of his Living Will, 2 January 1985; given at tanuki2016.com/2018/02/04/46/' }, // originally English, not a translation
  { lang: 'ja', kind: 'jisei', text: '散る梅に\n見上げる空の\n月清し', romaji: 'Chiru ume ni\nmiaguru sora no\ntsuki kiyoshi',
    en: 'Plum petals falling\nI look up—the sky,\na clear crisp moon.',
    credit: 'Baiko (died 1903), as given at tanuki2016.com/2018/02/04/46/' },
  { lang: 'ja', kind: 'jisei', text: '百伝ふ\n磐余の池に\n鳴く鴨を\n今日のみ見てや\n雲隠りなむ', romaji: 'Monozutau\nIware no ike ni\nnaku kamo wo\nkyo nomi mite ya\nkumokakuri nan',
    en: 'Today, taking my last sight of the mallards\nCrying on the pond of Iware\nMust I vanish into the clouds!',
    credit: 'Prince Ōtsu (663–686), as given at tanuki2016.com/2018/02/04/46/' },
  { lang: 'en', kind: 'jisei', text: 'Empty-handed I entered the world\nBarefoot I leave it\nMy coming, my going\nTwo simple happenings\nThat got entangled.', en: 'Empty-handed I entered the world\nBarefoot I leave it\nMy coming, my going\nTwo simple happenings\nThat got entangled.',
    credit: 'Kozan Ichiko (1283–1360), in the English given at tanuki2016.com/2018/02/04/46/; the original is not given there' }, // a translation, original not held
  { lang: 'ja', kind: 'jisei', text: 'kuse ni natte\nnishi ogamikeri\nhatsu ashita', // romanised only; the page gives no Japanese
    en: 'It\'s become a habit\nbowing to the West\nNew Year\'s dawn',
    credit: 'Wagin, a Buddhist monk (died 1758), as given at tanuki2016.com/2018/02/04/46/' },
  { lang: 'ja', kind: 'jisei', text: 'yururi saku\nkotoshi no hana no\nkakugo kana', // romanised only; the page gives the Japanese incompletely
    en: 'How leisurely the cherry\nblossoms bloom this year, unhurried,\nby their doom!',
    credit: 'Kinu (died March 1817), as given at tanuki2016.com/2018/02/04/46/' },
  { lang: 'ja', kind: 'jisei', text: '風さそふ\n花よりもなほ\n我はまた\n春の名残を\nいかにとかせん', romaji: 'kaze sasou\nhana yori mo nao\nware ha mata\nharu no nagori wo\nika ni toyasen',
    en: 'More than the cherry blossoms,\ninviting a wind to blow them away,\nI am wondering what to do\nwith the remaining springtime.',
    credit: 'Lord Asano Naganori (1667–1701), aged 34; English by Mizoguchi Kenji, as given at tanuki2016.com/2018/02/04/46/. The kanji are not the page\'s' },
  { lang: 'ja', text: '死に仕度\n致せ致せと\n桜哉', romaji: 'shini shitaku\nitaseitase to\nsakura kana',
    en: 'Cherry blossoms\npress me to\nprepare to die.',
    credit: 'Kobayashi Issa (1763–1828), as given at tanuki2016.com/2018/02/04/46/; the page does not call it his jisei' },
  { lang: 'ja', text: '願わくは花の下にて春死なむ\nその如月の望月のころ', romaji: 'negawaku wa hana no shita nite haru shinamu\nsono kisaragi no mochizuki no koro',
    en: 'Let me die in spring under the blossom trees,\nlet it be around the full moon of Kisaragi [February].',
    credit: 'Saigyō Hōshi (1118–1190), as given at tanuki2016.com/2018/02/04/46/; a wish, not a jisei' },
  { lang: 'grc', text: '...τὴν εἱμαρμένην οὐδ’ ἂν εἷς ἐκφύγοι...', en: 'Not even one single individual could escape their measure of destiny' },
];
export const MEMENTO = MEMENTO_ENTRIES.map((e) => e.text);
// Each phrase in English, in MEMENTO's order: the skull's hover text, "Clear the map: " and the one shown beside it
export const MEMENTO_EN = MEMENTO_ENTRIES.map((e) => e.en);
// A phrase that is verse in its source keeps its own lines
const MEMENTO_VERSE = { 'Nuestras vidas son los ríos que van a dar en la mar, que es el morir': ['Nuestras vidas son los ríos', 'que van a dar en la mar,', 'que es el morir'] }; // Jorge Manrique, Coplas, III
// A long phrase with a comma near its middle is set as a couplet, two lines split after that comma; any other on one line
export function mementoLines(text) {
  if (text.includes('\n')) return text.split('\n');
  if (Object.hasOwn(MEMENTO_VERSE, text)) return MEMENTO_VERSE[text];
  if (text.length <= 30) return [text];
  let best = -1;
  for (let i = text.indexOf(','); i >= 0; i = text.indexOf(',', i + 1)) if (Math.abs(i / text.length - 0.5) < Math.abs(best / text.length - 0.5)) best = i;
  return best >= 0 && Math.abs(best / text.length - 0.5) <= 0.15 ? [text.slice(0, best + 1), text.slice(best + 1).trim()] : [text];
}
export const mementoNext = (k) => (((k + 1) % MEMENTO.length) + MEMENTO.length) % MEMENTO.length;

// Where a person's pictures lie by default, from `frame` (the lon/lat box of their birth, death and voyages): each as tall
// as two fifths of the frame (in Mercator degrees, 3 to 30), times `grow`, side by side in a row under the frame's south
// edge, from its west edge eastward, each laid `overlap` of its width over the one before (the page lays them larger
// and overlapping on a wide screen, so a long row still fits it). `sizes` are the pictures' [width, height] in px.
// Returns [{ lon, lat, scale, turn: 0 }], scale in Mercator degrees per px,
// as a chart's sheet (overlays.mjs).
// Mercator latitude in degrees and back, for laying pictures along a frame
const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;
const latOf = (m) => (2 * Math.atan(Math.exp((m * Math.PI) / 180)) - Math.PI / 2) * 180 / Math.PI;
export function picturePlaces(frame, sizes, grow = 1, overlap = 0) {
  const m0 = merc(Math.max(-80, frame.latMin)), m1 = merc(Math.min(80, frame.latMax));
  const tall = Math.max(3, Math.min(30, (m1 - m0) * 0.4)) * grow, gap = tall * 0.08;
  let x = frame.lonMin;
  return sizes.map(([w, h]) => {
    const scale = tall / h, wide = w * scale, at = { lon: x + wide / 2, lat: latOf(Math.max(merc(-80) + tall / 2, m0 - gap - tall / 2)), scale, turn: 0 };
    x += overlap ? wide * (1 - overlap) : wide + gap;
    return at;
  });
}
// The box of `frame` and the pictures laid at `places` (picturePlaces), each `sizes` [width, height] px: what a view
// shows to frame a person whole.
export function withPictures(frame, places, sizes) {
  const box = { ...frame };
  places.forEach((s, k) => {
    const [w, h] = sizes[k], m = merc(s.lat);
    box.lonMin = Math.min(box.lonMin, s.lon - (w * s.scale) / 2); box.lonMax = Math.max(box.lonMax, s.lon + (w * s.scale) / 2);
    box.latMin = Math.min(box.latMin, latOf(m - (h * s.scale) / 2)); box.latMax = Math.max(box.latMax, latOf(m + (h * s.scale) / 2));
  });
  return box;
}
