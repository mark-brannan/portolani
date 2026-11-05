// Builds packs/overlays/: each chart's scan shrunk, a mask of the scanner's paper round it (a flood fill, or the chart's `outline`), and overlays.json
// with the sheet's own placement, its snaps and the warped pieces' fits (scripts/overlays.mjs, docs/overlay/README.md). The scan is downloaded into downloads/ when missing and
// checked against the sha256 in scripts/sources.json, as build-packs.mjs does.
//
// Usage: npm run overlays [-- --only id,id]   (--only rebuilds just those charts and keeps the others' rows of overlays.json as they are)
//
// The Carta Marina's two fits are refitted from the figures table in docs/atlas/ornaments.md ("Carta
// Marina, 1539"): every row gives a figure's scan px and the lon, lat its side's fit put it at, so a
// least-squares similarity through a side's rows gives back that side's fit. The Catalan Atlas is eight pages
// (BnF sheets 5 to 12), each its own panel cropped to its parchment and butted to the last, and one piece each,
// fitted to that page's landmarks table there ("Landmarks, sheet N"): each row's page px and real lon, lat. Juan de
// la Cosa's three are made the same way from "Landmarks, 1500", each from the rows of its piece.

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBytesWithRetry } from './fetch-retry.mjs';
import { similarityFit, sheetOf } from './overlays.mjs';
import { landIndex, fitLine, parallelLines } from './fit-lines.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DL = join(ROOT, 'downloads'), OUT = join(ROOT, 'packs', 'overlays');

// The rows of the figures table under a heading of ornaments.md, as { id, px: [x, y], fit, ll: [lon, lat] }.
export function figureRows(markdown, heading = '## Carta Marina, 1539') {
  const at = markdown.indexOf(heading), next = markdown.indexOf('\n## ', at + heading.length);
  const section = markdown.slice(at, next < 0 ? undefined : next);
  const num = (t) => t.split(',').map(Number);
  return section.split('\n').map((l) => l.split('|').map((c) => c.trim()))
    .filter((c) => c.length > 6 && /^[RMS]\d+$/.test(c[1]) && /^(west|norway|baltic)$/.test(c[4]))
    .map((c) => ({ id: c[1], px: num(c[3]), fit: c[4], ll: num(c[5]) }));
}
// The rows of a landmarks table under a heading of ornaments.md, as { id, px: [x, y], ll: [lon, lat] }: the
// landmark's real place, not where a fit puts it. A table with a piece column adds `piece`, the fit it belongs to.
export function landmarkRows(markdown, heading) {
  const at = markdown.indexOf(heading), next = markdown.indexOf('\n#', at + heading.length);
  const section = markdown.slice(at, next < 0 ? undefined : next);
  const num = (t) => t.split(',').map(Number);
  return section.split('\n').map((l) => l.split('|').map((c) => c.trim()))
    .filter((c) => c.length > 5 && /^L\d+$/.test(c[1]))
    .map((c) => ({ id: c[1], px: num(c[3]), ll: num(c[4]), ...(/^[a-z]+$/.test(c[5]) && { piece: c[5] }) }));
}
// One side's similarity, refitted from its rows
export function fitOf(rows, side) {
  const { a, b, tx, ty } = similarityFit(rows.filter((r) => r.fit === side).map((r) => [r.px, r.ll]));
  return { a, b, tx, ty };
}

// One piece's similarity, fitted to the landmarks of that piece
export function pieceFit(rows, piece) {
  const { a, b, tx, ty } = similarityFit(rows.filter((r) => r.piece === piece).map((r) => [r.px, r.ll]));
  return { a, b, tx, ty };
}

// A level similarity (no turn) through `pairs` [[x, y], [lon, lat]] by least squares: a rough centre and scale for a
// chart laid by a handful of landmarks read off the scan, so the sheet's own placement is truly level. With `k` the
// scale is held at it and only the centre is fitted.
export function levelFit(pairs, k = similarityFit(pairs).a) { // with the turn held at 0, the real part is the least-squares scale
  const n = pairs.length;
  const mx = pairs.reduce((t, [[x]]) => t + x, 0) / n, my = pairs.reduce((t, [[, y]]) => t + y, 0) / n;
  const mu = pairs.reduce((t, [, [lon]]) => t + lon, 0) / n, mv = pairs.reduce((t, [, [, lat]]) => t + mercDeg(lat), 0) / n;
  return { a: k, b: 0, tx: mu - k * mx, ty: mv + k * my };
}

// The Catalan Atlas's eight map pages, BnF sheets 5 to 12, west to east, each cropped to its parchment: x0 to x1 of
// its own scan, measured on 2026-10-29 as the columns where the scanner's paper is under a third of the page's
// middle 70%. `label` names the page's snap by what it shows. `part` is which half of the atlas the page is: 'portolan'
// (sheets 5 to 8), fitted by similarity, turn and all; 'mappa mundi' (sheets 9 to 12, east of the Caspian), laid level
// at the atlas scale. Sheets 1 to 4 are the calendar and cosmography.
export const CATALAN_PAGES = [
  [5, 288, 6160, 'Atlantic', 'portolan'], [6, 304, 6144, 'Mali', 'portolan'], [7, 288, 6136, 'Italy', 'portolan'], [8, 352, 6216, 'Black Sea', 'portolan'],
  [9, 304, 6184, 'Persia', 'mappa mundi'], [10, 272, 6088, 'Central Asia', 'mappa mundi'], [11, 312, 6136, 'India', 'mappa mundi'], [12, 344, 6200, 'Cathay', 'mappa mundi'],
].map(([n, x0, x1, label, part]) => ({ n, source: `catalan-atlas-${n}`, x0, x1, label, part }));

// Each page's offset in the open atlas: where its parchment starts in the sheet's full-resolution px.
export function pageOffsets(pages) {
  let x = 0;
  return pages.map((p) => { const at = x; x += p.x1 - p.x0; return at; });
}

// Each page's piece, as [x0, x1, fit] in the sheet's px, from its landmarks table in ornaments.md ("### Landmarks,
// sheet N", page px; the page's offset added here). A page of the portolan part takes the least-squares
// similarity through its rows, turn and all. A page of the mappa mundi, east of the Caspian, is level, each
// centred through its own few named places, at the scale of the atlas as a whole (the least-squares scale through
// every row of the eight pages at their offsets): too few places, too far from where they lie, to set a scale of
// their own. Sheet 10 has no place read (its lettering is upside down and worn), so it is centred through the rows
// of sheets 9 and 11.
const catalanRows = (md, pages) => pages.map((p) => (md.includes(`### Landmarks, sheet ${p.n}
`) ? landmarkRows(md, `### Landmarks, sheet ${p.n}
`) : []));
export function catalanPieces(md, pages = CATALAN_PAGES) {
  const at = pageOffsets(pages);
  const rows = catalanRows(md, pages).map((page, i) => page.map((r) => [[at[i] + r.px[0] - pages[i].x0, r.px[1]], r.ll]));
  const atlas = similarityFit(rows.flat()).scale;
  return pages.map((p, i) => {
    if (p.part === 'portolan') { const { a, b, tx, ty } = similarityFit(rows[i]); return [at[i], at[i] + p.x1 - p.x0, { a, b, tx, ty }]; }
    if (!rows[i].length && !(rows[i - 1]?.length && rows[i + 1]?.length)) throw new Error(`Catalan Atlas sheet ${p.n} has no landmarks and no neighbour on both sides to centre it by`);
    const { a, b, tx, ty } = levelFit(rows[i].length ? rows[i] : [...rows[i - 1], ...rows[i + 1]], atlas);
    return [at[i], at[i] + p.x1 - p.x0, { a, b, tx, ty }];
  });
}
// Each page's landmarks, as the real [lon, lat] its fit was computed from: sheet 10's are sheets 9's and 11's.
export function catalanMarks(md, pages = CATALAN_PAGES) {
  const rows = catalanRows(md, pages).map((page) => page.map((r) => r.ll));
  return rows.map((r, i) => (r.length ? r : [...(rows[i - 1] ?? []), ...(rows[i + 1] ?? [])]));
}

// Each chart's pieces from ornaments.md, as [x0, x1, fit]; x1 null for the scan's right edge. `scale` is how
// far the scan is shrunk for the site. A chart of `pages` is one panel per page, butted west to east.
const CHARTS = [
  { id: 'carta-marina', title: 'Carta Marina, Olaus Magnus, 1539', source: 'carta-marina', file: 'carta-marina.jpg', scale: 2,
    pieces: (md) => { const rows = figureRows(md); const lm = pieceFit(landmarkRows(md, '### Landmarks, Norway'), 'norway'); // the coast's own landmarks, not the figures: the strip's figures take its fit
      return [[0, 1700, fitOf(rows, 'west')], [1700, 2700, lm], [2700, null, fitOf(rows, 'baltic')]]; },
    // the landmarks ornaments.md names for each fit ("Carta Marina, 1539"), where they lie today: the figures table
    // gives where the fits put the figures, not the landmarks' scan px, so these are their real places alone
    marks: () => [[[-18.6, 64.9], [-6.9, 62.0], [-1.25, 60.3], [-3.05, 59.0]], // Iceland, the Faroes, Shetland, Orkney
      [[7.05, 57.98], [10.40, 63.43], [5.15, 62.19], [13.0, 67.9]], // Lindesnes, Trondheim, Stad, Lofoten
      [[19.95, 60.2], [18.07, 59.33], [18.5, 57.45], [16.65, 56.75], [22.5, 58.4], [24.1, 56.95], [18.65, 54.35]]], // Åland, Stockholm, Gotland, Öland, Saaremaa, Riga, Danzig
    snaps: ['West', 'Norway', 'Baltic'] },
  { id: 'catalan-atlas', title: 'Catalan Atlas, 1375', source: 'catalan-atlas-5', pages: CATALAN_PAGES, thumb: 'catalan-atlas-thumb.jpg', scale: 4,
    pieces: (md) => catalanPieces(md), marks: (md) => catalanMarks(md), snaps: CATALAN_PAGES.map((p) => p.label) },
  { id: 'de-la-cosa', title: 'Map of Juan de la Cosa, 1500', source: 'de-la-cosa', file: 'de-la-cosa.jpg', scale: 1, // the scan is small: shrunk, the coasts would go; the pieces run from the parchment's west edge to its east
    parallels: [23.44, 0], // the two long red lines across the skin, top first: the Tropic of Cancer and the equator
    up: 90, // drawn west up, the equator running up and down and the New World at the top: the scan turned 90° clockwise reads as drawn
    pieces: (md) => { const rows = landmarkRows(md, '### Landmarks, 1500'); return [[70, 880, 'west'], [880, 1150, 'atlantic'], [1150, 2060, 'east']].map(([x0, x1, p]) => [x0, x1, pieceFit(rows, p)]); },
    marks: (md) => { const rows = landmarkRows(md, '### Landmarks, 1500'); return ['west', 'atlantic', 'east'].map((p) => rows.filter((r) => r.piece === p).map((r) => r.ll)); },
    snaps: ['New World', 'Atlantic', 'Europe'] },
  // The charts below are laid level by a few landmarks read off the scan by eye, scan px to real lon, lat (#161 follow-up):
  // a rough centre and scale, no warped coast fits: `landmarks`, one piece by their levelFit.
  { id: 'aguiar', title: 'Chart of Jorge de Aguiar, 1492', source: 'aguiar-chart', file: 'aguiar.jpg', scale: 2, dark: true, // scanned on black
    landmarks: [[[1895, 1491], [-9.14, 38.72]], [[1992, 1825], [-5.6, 36.0]], [[3093, 738], [12.33, 45.44]], [[4347, 1755], [35.22, 31.78]]], // scan px, real lon, lat
    snaps: [] },
  { id: 'agnese-world', title: 'World map of Battista Agnese, about 1544', source: 'agnese-1544-world', file: 'agnese-world.jpg', scale: 4,
    landmarks: [[[5796, 3432], [-5.6, 36.0]], [[7290, 4867], [18.47, -34.36]], [[4959, 5523], [-70.5, -53.0]], [[5140, 5116], [-57.5, -35.0]], [[5479, 4391], [-35.0, -8.4]], [[8395, 3961], [77.5, 8.1]]], // scan px, real lon, lat
    snaps: [] },
  { id: 'dourado-atlantic', title: 'North Atlantic of Fernão Vaz Dourado, 1580', source: 'dourado-1580-k4', file: 'dourado-atlantic.jpg', scale: 4,
    landmarks: [[[7010, 5975], [-9.14, 38.72]], [[6877, 5458], [-9.26, 42.88]], [[7314, 6452], [-5.6, 36.0]], [[7407, 4624], [-4.77, 48.36]], [[6983, 3908], [-8.0, 53.4]], [[8626, 5432], [3.13, 41.85]], [[6532, 2610], [-18.5, 65.0]]], // scan px, real lon, lat
    snaps: [] },
  // Not the original: a painted copy of 1959 of the atlas's Mediterranean (sheets 5 to 8, Corsica and Sardinia drawn
  // once), CC BY 3.0. Ten places: Gibraltar, Lisbon, Finisterre, London, Corsica, Sardinia, Sicily, Venice, Crete, Cyprus.
  { id: 'catalan-atlas-1959-copy', title: 'Catalan Atlas, Mediterranean, a copy of 1959', source: 'catalan-atlas-1959-copy', file: 'catalan-atlas-1959-copy.jpg', scale: 4,
    landmarks: [[[3748, 5784], [-5.6, 35.97]], [[2961, 4997], [-9.14, 38.72]], [[2915, 4350], [-9.27, 42.88]], [[4072, 2360], [-0.12, 51.51]], [[6136, 3933], [9.05, 42.15]], [[6154, 4535], [9.0, 40.05]], [[7311, 4951], [14.1, 37.55]], [[7403, 3100], [12.33, 45.44]], [[9717, 5090], [24.9, 35.2]], [[11336, 4858], [33.2, 35.1]]], // scan px, real lon, lat
    snaps: [] },
  // Oliva family, 1621-1665 (Commons dates it "between"): the whole Mediterranean, its east edge torn, scanned on black. Lisbon, Finisterre, Venice, Sicily, Crete, Cyprus, the Nile delta.
  // The outline traces the skin's perimeter a few px out into the black (its three straight sides and the tear down the east), read off the scan at a quarter.
  { id: 'oliva-mediterranean', title: 'Portolan chart of the Mediterranean, Oliva family, 1621-1665', source: 'oliva-mediterranean', file: 'oliva-mediterranean.jpg', scale: 4,
    outline: [[17100, 768], [16392, 48], [612, 116], [492, 756], [588, 980], [448, 1104], [0, 3980], [0, 4396], [168, 4680], [80, 5468], [128, 5972], [360, 6840], [380, 8360], [556, 8620], [276, 10752], [440, 10928], [5440, 11056], [14120, 11040], [15600, 10840], [15612, 10732], [15440, 10620], [16040, 9320], [16164, 8824], [16880, 8260], [17268, 8068], [17244, 4356], [17160, 3204], [16972, 3028], [16988, 2876], [17144, 2776]], // scan px
    landmarks: [[[800, 5580], [-9.14, 38.72]], [[300, 3350], [-9.27, 42.88]], [[7050, 2620], [12.33, 45.44]], [[7250, 5600], [14.0, 37.55]], [[11200, 5700], [24.9, 35.2]], [[13850, 5080], [33.0, 35.0]], [[13750, 7000], [31.0, 31.5]]], // scan px, real lon, lat
    snaps: [] },
  // Sebastião Lopes, about 1565: a photograph of the chart (perhaps of a facsimile), full size. Finisterre, Lisbon, Cape St Vincent, Gibraltar, Lanzarote, Gran Canaria, Tenerife.
  { id: 'lopes-atlantic', title: 'Atlantic chart of Sebastião Lopes, about 1565', source: 'lopes-1565', file: 'lopes-atlantic.jpg', scale: 1,
    landmarks: [[[1280, 1170], [-9.27, 42.88]], [[1290, 1400], [-9.14, 38.72]], [[1335, 1535], [-9.0, 37.03]], [[1570, 1560], [-5.35, 36.13]], [[1170, 2040], [-13.6, 29.0]], [[1040, 2080], [-15.6, 28.0]], [[975, 2065], [-16.55, 28.3]]], // scan px, real lon, lat
    snaps: [] },
  // Bartolomé Olives, Venice 1559 (Bodleian MS. Canon. Ital. 143, fol. 3r): drawn south up, Africa at the top, so the sheet is turned half round (levelFit's scale comes out negative). Gibraltar, Cape St Vincent, Lisbon, Finisterre, Sardinia, Corsica, Sicily.
  // The photograph shows the chart in its dark binding on black, the binding fading into the background: the outline is four straight(ish) sides, the
  // left and right tangent to the binding's outermost brown (the right a shade convex), the top clipping a little dark red by the upper rose, the bottom the scan's own edge.
  { id: 'olives-1559', title: 'Chart of the central and western Mediterranean, Bartolomé Olives, 1559', source: 'olives-1559', file: 'olives-1559.jpg', scale: 1, up: 180,
    outline: [[285, 42], [3755, 78], [3792, 450], [3792, 750], [3782, 1050], [3770, 1350], [3758, 1650], [3750, 1950], [3736, 2250], [3720, 2660], [285, 2660]], // scan px
    landmarks: [[[2925, 875], [-5.35, 36.13]], [[3165, 960], [-9.0, 37.03]], [[3150, 1105], [-9.14, 38.72]], [[3150, 1435], [-9.27, 42.88]], [[1740, 1360], [9.0, 40.05]], [[1750, 1580], [9.1, 42.2]], [[1250, 1170], [14.1, 37.55]]], // scan px, real lon, lat
    snaps: [] },
  // Banet Panades, Messina 1557 (Galata Museo del Mare, Genoa): a handheld museum photograph, north up but lying about 11 degrees off level, and unevenly lit; laid by a similarity with its turn. Cap Corse, Bonifacio, Cape Teulada, Marsala, Cape Passero, Messina, Cape Spartivento.
  { id: 'panades-1557', title: 'Chart of the Mediterranean, Banet Panades, Messina, 1557', source: 'panades-1557', file: 'panades-1557.jpg', scale: 1, turned: true,
    landmarks: [[[1010, 970], [9.4, 43.0]], [[1000, 1200], [9.15, 41.38]], [[1040, 1605], [8.65, 38.87]], [[1500, 1625], [12.43, 37.8]], [[1830, 1735], [15.15, 36.69]], [[1880, 1535], [15.65, 38.27]], [[1960, 1590], [16.05, 37.92]]], // scan px, real lon, lat
    snaps: [] },
  // Piri Reis, Kitab-ı Bahriye (Walters W.658, fol. 208a): the Adriatic drawn up the page, north to the upper right, so laid by a
  // similarity with its turn. Venice, the tip of Istria, the Gargano, Leuca, Corfu, the Bay of Kotor, Vlorë. The outline is the folio,
  // a few px out into the scanner's grey; the neighbouring folio's edge at the right is keyed with it.
  { id: 'kitab-i-bahriye-adriatic', title: 'Kitab-ı Bahriye: the Adriatic, Piri Reis', source: 'kitab-i-bahriye-adriatic', file: 'kitab-i-bahriye-adriatic.jpg', scale: 1, turned: true,
    outline: [[32, 36], [1208, 36], [1208, 1756], [32, 1756]], // scan px
    landmarks: [[[555, 268], [12.33, 45.44]], [[645, 470], [13.91, 44.77]], [[575, 1030], [16.19, 41.89]], [[645, 1390], [18.36, 39.80]], [[715, 1500], [19.85, 39.62]], [[850, 1120], [18.69, 42.43]], [[770, 1395], [19.45, 40.45]]], // scan px, real lon, lat
    snaps: [] },
  // The Carte Pisane, about 1275 (BnF, GE B-1118): the oldest surviving portolan chart, photographed south up (England at the
  // foot, Africa along the top), so its similarity turns it half round. Cape Passero, Messina, Trapani, Genoa, Marseille,
  // Barcelona, Valencia, Almería, Acre, Cyprus, Crete. The Black Sea end is stained past reading and holds no landmark.
  { id: 'carte-pisane', title: 'Carte Pisane, about 1275', source: 'carte-pisane', file: 'carte-pisane.jpg', scale: 4, dark: true, turned: true,
    landmarks: [[[9500, 2690], [15.13, 36.69]], [[9440, 3220], [15.55, 38.19]], [[10580, 3020], [12.5, 38.02]], [[11900, 5650], [8.93, 44.41]], [[12550, 4900], [5.37, 43.3]], [[13700, 4320], [2.17, 41.38]], [[14220, 3150], [-0.33, 39.47]], [[14680, 2200], [-2.46, 36.83]], [[3180, 2350], [35.07, 32.93]], [[3900, 2900], [33.3, 35.1]], [[6400, 2500], [24.9, 35.25]]], // scan px, real lon, lat
    snaps: [] },
  // Pietro Vesconte, the atlas of 1313 (BnF, btv1b5901108m): one chart of it across two leaves, the Tyrrhenian coast of Italy
  // up the left leaf and the sea south-west of it on the right, drawn east up, so its similarity turns it 107°. The right
  // leaf's coasts are faded past reading, so the landmarks all lie on the Italian shore: Elba, Piombino, Corneto, Santa Severa, Rome's shore, Terracina,
  // Gaeta, Palinuro. The skin fills the scan but for a thin black rim, so the outline is four straight sides on its edge.
  { id: 'vesconte-1313', title: 'Chart from the atlas of Pietro Vesconte, 1313', source: 'vesconte-1313', file: 'vesconte-1313.jpg', scale: 1, turned: true,
    outline: [[11, 11], [2620, 16], [2620, 2236], [22, 2272]], // scan px: straight sides, the skin's worn edge kept and a sliver of black riding along
    landmarks: [[[546, 1811], [10.27, 42.78]], [[536, 1736], [10.5, 42.93]], [[586, 1581], [11.7, 42.23]], [[671, 1509], [11.96, 42.02]], [[636, 1476], [12.25, 41.74]], [[716, 1359], [13.25, 41.28]], [[709, 1276], [13.57, 41.21]], [[803, 1044], [15.27, 40.03]]], // scan px, real lon, lat
    snaps: [] },
  // Angelino Dulcert, Majorca 1339 (BnF, GE B-696): the Mediterranean, the Black Sea and Europe's Atlantic coasts, north up,
  // scanned on a dark cloth that no key separates from the skin's shadowed edge, so the outline is the skin's four sides.
  // Finisterre, Porto, Lisbon, Cap Corse, Cape Teulada, Trapani, Crete, Cyprus, Jaffa, Alexandria.
  { id: 'dulcert-1339', title: 'Chart of Angelino Dulcert, Majorca, 1339', source: 'dulcert-1339', file: 'dulcert-1339.jpg', scale: 4, turned: true,
    outline: [[290, 160], [4092, 130], [8184, 95], [12276, 200], [16200, 340], [16210, 6000], [16210, 9100], [16060, 11770], [12276, 11830], [8184, 11970], [4092, 11900], [290, 12010], [260, 6000]], // scan px
    landmarks: [[[1960, 6260], [-9.27, 42.88]], [[1990, 6770], [-8.67, 41.15]], [[2000, 7250], [-9.14, 38.72]], [[6150, 5430], [9.4, 43.0]], [[6100, 6790], [8.65, 38.87]], [[7110, 6830], [12.5, 38.02]], [[10150, 7050], [24.9, 35.25]], [[12250, 6620], [33.3, 35.1]], [[12720, 7640], [34.75, 32.05]], [[11580, 8020], [29.9, 31.2]]], // scan px, real lon, lat
    snaps: [] },
  // De Bry after John White, the arrival of the Englishmen in Virginia (Briefe and True Report, 1590): the Outer Banks
  // and Roanoke drawn west up, the ocean at the foot, so its similarity turns it a quarter round. Fitted to the barrier
  // islands alone: Hatorask, the island north of the inlet south of Roanoke, Trinety harbor and the banks north of it. A
  // picture more than a survey: the sounds are drawn far too narrow, so a fit that also took Roanoke and the mainland
  // (Dasamonquepeuc, the Albemarle, Pasquenoke) laid the drawn banks over the real sounds and its line along the real
  // banks ran through the drawn sea. Laid by the banks, the drawn coast faces the real ocean; Roanoke and the mainland
  // fall inland of their places, as the drawing has them.
  { id: 'debry-virginia', title: 'The arrival of the Englishmen in Virginia, de Bry after John White, 1590', source: 'debry-virginia', file: 'debry-virginia.jpg', scale: 1, turned: true,
    outline: [[34, 0], [2304, 0], [2304, 1672], [80, 1672]], // scan px: straight sides, the margin and the red border kept; the left the leaf's own edge at the gutter, slanting a little
    landmarks: [[[250, 1150], [-75.49, 35.57]], [[470, 1030], [-75.55, 35.8]], [[1400, 1010], [-75.75, 36.16]], [[1900, 960], [-75.82, 36.33]]], // scan px, real lon, lat: Hatorask, the island north of the inlet south of Roanoke, Trinety harbor, the banks off Corolla
    snaps: [] },
];

// The sheet's own placement. With the chart's drawn `parallels` ([{ lat, from, to }], top first, in scan px): the turn
// that lays them level, the scale that sets them their Mercator distance apart, the latitude that puts the scan's centre
// where it lies against them, and the longitude midway between where the first and last pieces' fits put the centre.
// Without: level, its scale the geometric mean of the first and last pieces' and its centre midway between where those
// two fits put the scan's centre; a chart with one piece takes that fit as it is. The snaps: each piece's fit applied
// to the whole scan, labelled.
export function sheetPlacements(pieces, labels, width, height, parallels = null) {
  const fits = pieces.map(([, , fit]) => fit), sheets = fits.map((f) => sheetOf(f, width, height));
  const snaps = sheets.length === 1 ? [] : sheets.map((s, i) => ({ label: labels[i], ...s }));
  const first = sheets[0], last = sheets[sheets.length - 1], lon = (first.lon + last.lon) / 2;
  if (parallels) {
    const slope = (l) => (l.to[1] - l.from[1]) / (l.to[0] - l.from[0]), m = parallels.reduce((t, l) => t + slope(l), 0) / parallels.length;
    const yAt = (l, x) => l.from[1] + slope(l) * (x - l.from[0]), cx = width / 2, cy = height / 2, cos = Math.cos(Math.atan(m));
    const [top, bottom] = parallels, span = (yAt(bottom, cx) - yAt(top, cx)) * cos; // their distance apart, across the lines
    const scale = (mercDeg(top.lat) - mercDeg(bottom.lat)) / span;
    const merc = mercDeg(bottom.lat) - (cy - yAt(bottom, cx)) * cos * scale; // the centre's Mercator latitude: below the bottom line is south
    return { sheet: { lon, lat: latOf(merc), scale, turn: -Math.atan(m) * 180 / Math.PI }, snaps };
  }
  if (sheets.length === 1) return { sheet: sheets[0], snaps };
  return { sheet: { lon, lat: latOf((mercDeg(first.lat) + mercDeg(last.lat)) / 2), scale: Math.sqrt(first.scale * last.scale), turn: 0 }, snaps };
}
// The line each placement was fitted to, in today's geography (scripts/fit-lines.mjs): a snap's, the coast its piece's
// landmarks lie on; the chart's own, with drawn `parallels` today's equator and tropic across the sheet, else the
// coasts of the first and last pieces it is centred between (one piece: its own). `marks` holds each piece's landmarks
// as real [lon, lat]. Returns { sheetLine, snaps } with each snap's `line` beside its placement.
export function placementLines(land, marks, { sheet, snaps }, width, height, parallels = null) {
  const lines = marks.map((m) => fitLine(land, m));
  const own = parallels ? parallelLines(parallels, sheet, width, height) : lines.length === 1 ? lines[0] : [...lines[0], ...lines.at(-1)];
  return { sheetLine: own, snaps: snaps.map((sn, i) => ({ ...sn, line: lines[i] })) };
}
const piecesOf = (c, md) => (c.landmarks ? [[0, null, c.turned ? similarityFit(c.landmarks) : levelFit(c.landmarks)]] : c.pieces(md)); // `turned`: a photographed chart lying at an angle, fitted with its turn
const marksOf = (c, md) => (c.landmarks ? [c.landmarks.map(([, ll]) => ll)] : c.marks(md));
const mercDeg = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;
const latOf = (m) => (2 * Math.atan(Math.exp((m * Math.PI) / 180)) - Math.PI / 2) * 180 / Math.PI;

// The chart's drawn parallels: the long thin red lines across the skin (Juan de la Cosa's equator and Tropic of
// Cancer). Thin red runs (1 to 5 px tall) in every column are points; a Hough vote over slopes within 4 degrees of
// level and 1 px intercept bins finds the `n` strongest lines at least 60 px apart, each then refitted by least
// squares to its points within 3 px. Returns them top first, as { from: [x, y], to: [x, y] } in the canvas's px
// (the line through its outermost points), or throws when fewer than `n` are found.
export function redLines(ctx, w, h, n = 2) {
  const d = ctx.getImageData(0, 0, w, h).data, red = (x, y) => { const i = (y * w + x) * 4; return d[i] > 120 && d[i] - d[i + 1] > 45 && d[i] - d[i + 2] > 45; };
  const pts = [];
  for (let x = 0; x < w; x += 2) {
    for (let y = 0; y < h; y++) {
      if (!red(x, y)) continue;
      let y1 = y; while (y1 + 1 < h && red(x, y1 + 1)) y1++;
      if (y1 - y < 5) pts.push([x, (y + y1) / 2]);
      y = y1;
    }
  }
  let best = null;
  for (let m = -0.07; m <= 0.07; m += 0.0005) {
    const bins = new Map();
    for (const [x, y] of pts) { const b = Math.round(y - m * x); bins.set(b, (bins.get(b) ?? 0) + 1); }
    const peaks = [...bins.entries()].sort((a, b) => b[1] - a[1]), chosen = [];
    for (const [b, v] of peaks) { if (chosen.every(([cb]) => Math.abs(cb - b) >= 60)) chosen.push([b, v]); if (chosen.length === n) break; }
    const score = chosen.reduce((t, [, v]) => t + v, 0);
    if (chosen.length === n && (!best || score > best.score)) best = { m, lines: chosen.map(([b]) => b), score };
  }
  if (!best) throw new Error(`fewer than ${n} red lines across the scan`);
  return best.lines.map((b) => {
    const on = pts.filter(([x, y]) => Math.abs(y - best.m * x - b) <= 3), k = on.length;
    const mx = on.reduce((t, p) => t + p[0], 0) / k, my = on.reduce((t, p) => t + p[1], 0) / k;
    const m = on.reduce((t, [x, y]) => t + (x - mx) * (y - my), 0) / on.reduce((t, [x]) => t + (x - mx) ** 2, 0), c = my - m * mx;
    const x0 = Math.min(...on.map((p) => p[0])), x1 = Math.max(...on.map((p) => p[0]));
    return { from: [x0, +(m * x0 + c).toFixed(1)], to: [x1, +(m * x1 + c).toFixed(1)], n: k };
  }).sort((a, b) => a.from[1] - b.from[1]);
}

// The mask of the scanner's paper round the skin, on the shrunk scan: a flood fill from the image's border
// through light or grey unsaturated pixels (never the pale sea inside the skin, which is tinted), the outermost px
// keyed where they are background (a skin that runs to the edge of the scan stays whole, worn border and all), one px of feather at its edge. Returns { png, keyed }: the mask as an RGBA PNG (alpha 0 where paper) and the share of pixels keyed.
// `sides: false` keys no band down the left and right edges: a page cropped to its parchment, butted to the next.
export function paperMask(ctx, w, h, { dark = false, sides = true } = {}) {
  const d = ctx.getImageData(0, 0, w, h).data, n = w * h;
  // the paper and the scanner's shadow on it are light to mid grey, unsaturated; the skin is tinted even where it is pale
  // `dark`: a scan laid on black, where nothing light is background: the pale skin is unsaturated too, and a light test would flood into it
  const paper = (p) => { const i = p * 4, r = d[i], g = d[i + 1], b = d[i + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b); return dark ? mx < 40 && mx - mn < 25 : mn > 150 && mx - mn < 30; };
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.006)); // the scan's outermost px are the scanner's edge, never the skin
  const seen = new Uint8Array(n), stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !paper(p)) continue;
    seen[p] = 1;
    const x = p % w;
    if (x > 0) stack.push(p - 1); if (x < w - 1) stack.push(p + 1); if (p >= w) stack.push(p - w); if (p + w < n) stack.push(p + w);
  }
  const out = ctx.createImageData(w, h), o = out.data;
  let keyed = 0;
  for (let p = 0; p < n; p++) { const x = p % w, y = (p - x) / w; if (((sides && (x < band || x >= w - band)) || y < band || y >= h - band) && paper(p)) seen[p] = 1; }
  for (let p = 0; p < n; p++) {
    const x = p % w, edge = !seen[p] && ((x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (p >= w && seen[p - w]) || (p + w < n && seen[p + w]));
    o[p * 4 + 3] = seen[p] ? 0 : edge ? 128 : 255;
    if (seen[p]) keyed++;
  }
  return { mask: out, keyed: keyed / n };
}

// The mask from a chart's `outline`, a polygon in the shrunk scan's px drawn round the skin by eye: opaque inside, keyed
// outside, the edge antialiased by the canvas. For a scan whose background no key separates from the skin (a dark binding
// fading into black), where a crisp traced edge with a little background riding along is wanted over a flood fill's ragged one.
export function outlineMask(ctx, w, h, outline) {
  const c = createCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#000'; g.beginPath();
  outline.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath(); g.fill();
  const mask = g.getImageData(0, 0, w, h);
  let keyed = 0;
  for (let p = 0; p < w * h; p++) if (mask.data[p * 4 + 3] === 0) keyed++;
  return { mask, keyed: keyed / (w * h) };
}

async function scanOf(src) {
  const path = join(DL, src.file);
  const bytes = existsSync(path) ? readFileSync(path) : await fetchBytesWithRetry(src.url, { onRetry: (e, n) => console.warn(`retry ${n}: ${e.message}`) });
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== src.sha256) throw new Error(`${src.file}: sha256 ${got} does not match the manifest (${src.sha256})`);
  if (!existsSync(path)) { mkdirSync(DL, { recursive: true }); writeFileSync(path, bytes); } // a bad fetch never reaches disk
  return bytes;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sources = JSON.parse(readFileSync(join(ROOT, 'scripts', 'sources.json'), 'utf8')).sources;
  const md = readFileSync(join(ROOT, 'docs', 'atlas', 'ornaments.md'), 'utf8');
  const land = landIndex(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.resolve('coastlines/data/ne-land-10m'))), 'ne-land-10m.geojson'), 'utf8')));
  mkdirSync(OUT, { recursive: true });
  const overlays = [], only = process.argv.includes('--only') ? (process.argv[process.argv.indexOf('--only') + 1] ?? '').split(',').filter(Boolean) : null;
  if (only) { const bad = only.filter((id) => !CHARTS.some((c) => c.id === id)); if (!only.length || bad.length) throw new Error(`--only ${only.length ? `${bad.join(',')}: no such chart` : 'needs chart ids'} (${CHARTS.map((c) => c.id).join(', ')})`); }
  const kept = only ? JSON.parse(readFileSync(join(OUT, 'overlays.json'), 'utf8')).overlays : [];
  for (const c of CHARTS) {
    if (only && !only.includes(c.id)) { const old = kept.find((o) => o.id === c.id); if (old) overlays.push(old); continue; }
    if (c.pages) { overlays.push(await buildPages(c, sources, md, land)); continue; }
    const src = sources.find((s) => s.id === c.source);
    const img = await loadImage(await scanOf(src));
    const scale = c.scale, fw = Math.round(img.width / scale), fh = Math.round(img.height / scale);
    const canvas = createCanvas(fw, fh), g = canvas.getContext('2d');
    g.drawImage(img, 0, 0, fw, fh);
    writeFileSync(join(OUT, c.file), canvas.toBuffer('image/jpeg', 80));
    const { mask, keyed } = c.outline ? outlineMask(g, fw, fh, c.outline.map(([x, y]) => [x / scale, y / scale])) : paperMask(g, fw, fh, { dark: !!c.dark }), maskFile = `${c.id}-mask.png`;
    const mc = createCanvas(fw, fh); mc.getContext('2d').putImageData(mask, 0, 0);
    if (keyed > 0.001) writeFileSync(join(OUT, maskFile), mc.toBuffer('image/png'));
    const pieces = piecesOf(c, md).map(([x0, x1, fit]) => [x0, x1 ?? img.width, fit]);
    const parallels = c.parallels && redLines(g, fw, fh, c.parallels.length).map((l, i) => ({ lat: c.parallels[i], from: l.from.map((v) => v * scale), to: l.to.map((v) => v * scale) }));
    const placed = sheetPlacements(pieces, c.snaps, img.width, img.height, parallels), { sheet } = placed;
    const { sheetLine, snaps } = placementLines(land, marksOf(c, md), placed, img.width, img.height, parallels);
    overlays.push({
      id: c.id, title: c.title, source: src.page ?? src.url, licence: src.rights, file: c.file, ...(keyed > 0.001 && { mask: maskFile }),
      width: img.width, height: img.height, scale, sheet, sheetLine, snaps, ...(c.up != null && { up: c.up }), ...(parallels && { parallels }),
      pieces: pieces.map(([x0, x1, fit]) => ({ x0, x1, fit })),
    });
    console.log(`${c.id}: ${fw} x ${fh} from ${img.width} x ${img.height}, paper ${(keyed * 100).toFixed(1)}%${parallels ? `, parallels ${parallels.map((l) => `${l.lat}° at y ${l.from[1]} to ${l.to[1]}`).join('; ')}` : ''}, sheet ${sheet.scale.toFixed(4)} °/px turn ${sheet.turn.toFixed(2)}°`);
  }
  // a line's parts one to a row of the file, not a point to three rows
  const lines = [], json = JSON.stringify({ overlays }, (k, v) => (k === 'line' || k === 'sheetLine' ? `\u0000${lines.push(v) - 1}` : v), 2);
  writeFileSync(join(OUT, 'overlays.json'), `${json.replace(/"\\u0000(\d+)"/g, (_, i) => `[\n${lines[i].map((part) => `        ${JSON.stringify(part)}`).join(',\n')}\n      ]`)}\n`);
}

// A chart of pages: each page's scan cropped to its parchment and shrunk, its own JPEG and mask, a panel at its offset;
// the pieces and snaps from its fits; a thumbnail strip of the pages side by side, THUMB_W px wide.
async function buildPages(c, sources, md, land) {
  const THUMB_W = 480, at = pageOffsets(c.pages), panels = [], thumbs = [], scale = c.scale;
  for (const [i, p] of c.pages.entries()) {
    const src = sources.find((s) => s.id === p.source), img = await loadImage(await scanOf(src));
    const w = p.x1 - p.x0, h = img.height, fw = Math.round(w / scale), fh = Math.round(h / scale);
    const canvas = createCanvas(fw, fh), g = canvas.getContext('2d');
    g.drawImage(img, p.x0, 0, w, h, 0, 0, fw, fh);
    const file = `${c.id}-${p.n}.jpg`, maskFile = `${c.id}-${p.n}-mask.png`;
    writeFileSync(join(OUT, file), canvas.toBuffer('image/jpeg', 80));
    const { mask, keyed } = paperMask(g, fw, fh, { sides: false }), mc = createCanvas(fw, fh);
    mc.getContext('2d').putImageData(mask, 0, 0);
    writeFileSync(join(OUT, maskFile), mc.toBuffer('image/png'));
    const tc = createCanvas(Math.max(1, Math.round(fw / 16)), Math.max(1, Math.round(fh / 16)));
    tc.getContext('2d').drawImage(canvas, 0, 0, tc.width, tc.height);
    thumbs.push(tc);
    panels.push({ file, mask: maskFile, x: at[i], width: w, height: h, scanX: p.x0 });
    console.log(`${c.id} sheet ${p.n}: ${fw} x ${fh} from x ${p.x0} to ${p.x1} of ${img.width} x ${img.height}, at ${at[i]}, paper ${(keyed * 100).toFixed(1)}%`);
  }
  const width = at.at(-1) + panels.at(-1).width, height = Math.max(...panels.map((p) => p.height));
  const strip = createCanvas(THUMB_W, Math.round((THUMB_W * height) / width)), sg = strip.getContext('2d');
  thumbs.forEach((t, i) => sg.drawImage(t, (panels[i].x / width) * THUMB_W, 0, (panels[i].width / width) * THUMB_W, (panels[i].height / height) * strip.height));
  writeFileSync(join(OUT, c.thumb), strip.toBuffer('image/jpeg', 80));
  const pieces = c.pieces(md), placed = sheetPlacements(pieces, c.snaps, width, height), { sheet } = placed;
  const { sheetLine, snaps } = placementLines(land, c.marks(md), placed, width, height);
  const src = sources.find((s) => s.id === c.source);
  console.log(`${c.id}: ${c.pages.length} pages, ${width} x ${height}, sheet ${sheet.scale.toFixed(5)} °/px at ${sheet.lon.toFixed(1)}, ${sheet.lat.toFixed(1)}`);
  return {
    id: c.id, title: c.title, source: src.page ?? src.url, licence: src.rights, thumb: c.thumb,
    width, height, scale, sheet, sheetLine, snaps, panels, pieces: pieces.map(([x0, x1, fit]) => ({ x0, x1, fit })),
  };
}
