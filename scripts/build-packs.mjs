// Pack build: crop public-domain scans into sprites and write each pack's pack.json.
// Usage: node scripts/build-packs.mjs [--only <packName>] [--keep <dir> [idPrefix]]
//   (needs ImageMagick 7 `magick` on PATH; network for the first run)
// `--only` builds just that pack and downloads just its scans; the other packs and ASSETS.md are
// left untouched.
// `--keep` also writes each sprite's working images into <dir>, for sprites whose id starts with
// idPrefix (all when omitted): `<id>.raw.png`, the crop as cut and deskewed from the scan with no
// background removal; `<id>.key.png`, the key between them, white where the sprite is opaque and
// black where it is not, after the levels, silhouette and masks and before the scan's colour is
// put back; and `<id>.cut.png`, the finished sprite laid on parchment at 1:1. They are the before,
// the middle and the after of the keying, kept so a crop can be judged and refined later
// (docs/towns-aguiar, docs/debry-virginia).
//
// scripts/sources.json is the sources manifest: every file, URL, sha256 and rights line. Scans are
// downloaded into downloads/ when missing, checked against it, and ASSETS.md is written from it.
//
// A sprite PNG keeps the scan's own colour, with alpha = ink coverage. The RGB is the scan divided
// by its paper tone, so the renderer can composite with `multiply` and the source reds, greens and
// gilt land on our parchment as they sat on theirs. A pack with `colour: 'ink'` is written as
// black RGB instead, and the renderer fills it with the pack ink, so one ink setting retints it.
//
// Keying: crop -> darkness channel (luminance, or min(R,G,B) so gilt and colour wash count as ink)
// -> levels -> masks (saturation silhouette for coloured figures on hatched sea, a polygon drawn
// round a figure whose sea is printed in the same ink, circle for roses, rectangles erased for
// lettering) -> trim -> downscale. Line work on blank paper needs no mask: darkness alone keys it.
//
// Two keys (`key` on a pack, overridden per sprite). `patch`, the default: alpha is the figure's
// outline alone, the masks with their feathered edges, and everything inside stays, the water a
// ship sits in, the grass under a tree, the hatching round a village. The paper is divided out,
// so under the renderer's `multiply` it vanishes into our parchment and the figure lands on the
// map as it sat on the plate; the levels only seed a silhouette. `ink`: alpha is ink coverage from
// the levels, so paper and every wash lighter than the levels drop out; it thins colour and loses
// the surroundings (the scanned pack was cut this way, see #111), so it is for a pack drawn in ink
// alone, where nothing but line is wanted.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DL = join(ROOT, 'downloads');

const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'scripts', 'sources.json'), 'utf8'));
const SOURCES = Object.fromEntries(MANIFEST.sources.map((s) => [s.id, { ...s, path: join(DL, s.file) }]));

// Download any scan that is missing, then refuse bytes that do not match the pinned sha256.
async function fetchSource(src) {
  mkdirSync(DL, { recursive: true });
  if (!existsSync(src.path)) {
    // the Art Institute of Chicago refuses a fetch without its own AIC-User-Agent header
    const ua = 'portolani-build/0.1 (https://github.com/mark-brannan/portolani)';
    const res = await fetch(src.url, { headers: { 'user-agent': ua, 'aic-user-agent': ua } });
    if (!res.ok) throw new Error(`${src.url}: ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    checkSha(src, bytes); // a bad fetch never reaches disk, so the next run retries it
    writeFileSync(src.path, bytes);
    return;
  }
  checkSha(src, readFileSync(src.path));
}

function checkSha(src, bytes) {
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== src.sha256) throw new Error(`${src.file}: sha256 ${got} does not match the manifest (${src.sha256})`);
}

// Figures on the Carta Marina sit on hatched sea, so they take a saturation silhouette.
const SEA_FIGURE_LEVEL = [26, 56]; // woodcut line only; colour fills and sea hatching mostly drop out
const SEA_FIGURE = { sat: 24, close: 7, open: 5, dilate: 4, feather: 2, minArea: 900 };

// The Carta Marina's own paper (the mean of the bright land patch round Svecia), divided out of the sea figures: a crop
// of open sea holds no paper, so its surroundings would be taken for paper and the sea wash lost with it.
const CARTA_PAPER = '#ded2af';
const PARCHMENT = '#e9d8b4'; // the renderer's default paper, for the kept `.cut.png`
const argv = process.argv.slice(2), keepAt = argv.indexOf('--keep'), onlyAt = argv.indexOf('--only');
const keep = keepAt >= 0 ? join(ROOT, argv[keepAt + 1]) : null;
const keepPrefix = keepAt >= 0 && argv[keepAt + 2] && !argv[keepAt + 2].startsWith('--') ? argv[keepAt + 2] : '';
const only = onlyAt >= 0 ? argv[onlyAt + 1] : null;
if (keep) mkdirSync(keep, { recursive: true });

const CLEAN_DISK = 5; // px radius of the closing that removes scanned lettering
const TOWN_LEVEL = [30, 80]; // darkness levels for the Aguiar towns: the thin brown ink is pushed to full alpha so it reads at map size
// Woodcuts and engravings on blank paper (Paré, Master W): darkness alone keys them. The silhouette
// is taken from the ink itself (`ink`: alpha % that counts), which drops paper grain, stains and
// the faint lettering that shows through from the reverse; sizes are for ~600 dpi scans.
const PAPER_LEVEL = [20, 50];
const PAPER_FIGURE = { ink: 50, close: 14, open: 1, dilate: 8, feather: 4, minArea: 40000 };
const MASK_FEATHER = 6; // px blur on a polygon mask's edge, in scan pixels (`maskFeather` widens it)
const MAX_SCALE = 3; // a sprite is stored at most this many px wide per CSS px it is drawn (sizePx)

// One pack of scanned sprites; each sprite's `style` names the design family it belongs to, which
// the renderer offers as a setting (a rose set, a monster family, a town drawing).
const PACKS = [
  {
    name: 'scanned',
    key: 'ink', // cut before the patch key existed; re-keying it as patches is #111, a sprite at a time (`key: 'patch'` on the sprite; the Carta Marina monsters and ships are done)
    title: 'Sprites cropped from scans: Olaus Magnus, Carta Marina 1539; Jorge de Aguiar 1492; Catalan Atlas 1375; Genoese chart c. 1320-1350; Frederik de Wit; Ambroise Paré, Des monstres; Master W with the Key, two ship engravings c. 1475-1490',
    licence: 'Public domain (PD-Art); scans via Wikimedia Commons (James Ford Bell Library; Beinecke Library, Yale; BnF Gallica btv1b55002481n; Library of Congress 2003630429; Royal Museums Greenwich). The pare-* sprites: Wellcome Collection, CC BY 4.0. Ships ship-w-*: Art Institute of Chicago 27881 (CC0) and Rijksmuseum RP-P-2014-30 (Public Domain Mark)',
    ink: '#3b2a1a',
    sprites: [
      // Carta Marina figures are patches (#111): the whole crop, sea and swell and all, its edge feathered.
      // `figure` is the old tight box round the subject: the sprite is drawn so the figure keeps its sizePx
      // and its anchor, with the extra water round it. `erase` cuts only lettering and neighbouring figures.
      // the sea serpent with the ship it coils round; the ship, boat and coast beside it, and lettering, erased
      { id: 'serpent-a', kind: 'monster', style: 'carta-marina', scan: 'carta-marina', key: 'patch', paper: CARTA_PAPER, crop: [1670, 874, 2065, 1215], figure: [1698, 880, 2065, 1190], sizePx: 200, minClearancePx: 160, weight: 3,
        // the polygon cuts the neighbouring ship and boat at the top right and fades into the sea (the tail runs on beneath them)
        mask: [[1670, 874], [1990, 874], [1990, 1124], [2065, 1124], [2065, 1215], [1670, 1215]], maskFeather: 12,
        erase: [[1715, 1108, 1845, 1146], [1900, 927, 1918, 945], [1676, 1008, 1727, 1030], [2010, 1178, 2070, 1215]] },
      // the whale with its swell and the sea below; the crop stops short of the monster heads either side and the wreck above
      { id: 'whale-b', kind: 'monster', style: 'carta-marina', scan: 'carta-marina', key: 'patch', paper: CARTA_PAPER, crop: [1996, 356, 2362, 590], figure: [2040, 358, 2350, 532], sizePx: 190, minClearancePx: 150, weight: 2,
        erase: [[2328, 550, 2362, 590]] }, // the coast house in the corner
      // the spiny sea-beast in its swell, with the water below; the lettering at its left edge erased
      { id: 'pistrix-c', kind: 'monster', style: 'carta-marina', scan: 'carta-marina', key: 'patch', paper: CARTA_PAPER, crop: [372, 1210, 566, 1480], figure: [374, 1236, 566, 1432], sizePx: 150, minClearancePx: 130, weight: 2,
        erase: [[370, 1236, 386, 1256], [370, 1334, 386, 1352]] },
      // the whale that has seized a ship, with its ripples and the sea below; "C" and the "CETE" lettering erased
      { id: 'cete-e', kind: 'monster', style: 'carta-marina', scan: 'carta-marina', key: 'patch', paper: CARTA_PAPER, crop: [1772, 572, 2060, 775], figure: [1788, 572, 2046, 732], sizePx: 180, minClearancePx: 140, weight: 1,
        erase: [[1960, 590, 1985, 612], [2036, 618, 2062, 640]] },
      // the three-master with the water round and under the hull; the "L" and "ANGLI" lettering erased
      { id: 'ship-a', kind: 'ship', style: 'carta-marina', scan: 'carta-marina', key: 'patch', paper: CARTA_PAPER, crop: [1130, 780, 1335, 1050], figure: [1160, 800, 1312, 1000], sizePx: 80, heading: 'right',
        erase: [[1210, 824, 1224, 838], [1232, 962, 1300, 990]] },
      // the smaller ship under sail; the coast lettering, the islet and the letters above erased
      { id: 'ship-b', kind: 'ship', style: 'carta-marina', scan: 'carta-marina', key: 'patch', paper: CARTA_PAPER, crop: [2050, 690, 2210, 840], figure: [2085, 708, 2212, 802], sizePx: 64, heading: 'right',
        erase: [[2198, 706, 2212, 738], [2170, 690, 2212, 705], [2168, 808, 2212, 842]] },
      { id: 'rose-aguiar', kind: 'rose', style: 'aguiar', scan: 'aguiar', crop: [55, 80, 665, 690], sizePx: 300, dark: 'min', level: [12, 78], circle: [300, 300, 300],
        // the scan's own wind names (norte, oeste, leste, sull and the petal inscriptions)
        clean: [[355, 122, 377, 180], [175, 187, 235, 237], [495, 200, 552, 257], [115, 365, 165, 387], [555, 374, 609, 394], [162, 512, 197, 587], [340, 577, 364, 630], [489, 500, 535, 544], [112, 182, 147, 217]] },
      { id: 'rose-catalan', kind: 'rose', style: 'aguiar', scan: 'catalan', crop: [120, 185, 440, 505], sizePx: 110, dark: 'min', level: [10, 70], circle: [160, 160, 152] },
      // a smaller rose from the whole Aguiar chart, its wind names closed away
      { id: 'rose-aguiar-b', kind: 'rose', style: 'aguiar', scan: 'aguiar-chart', crop: [4178, 2464, 4482, 2768], sizePx: 110, dark: 'min', level: [12, 78], circle: [152, 152, 148],
        clean: [[4225, 2605, 4258, 2633], [4411, 2608, 4443, 2630], [4325, 2505, 4341, 2538], [4323, 2693, 4341, 2728], [4236, 2513, 4290, 2566], [4385, 2528, 4425, 2572], [4238, 2664, 4282, 2708], [4386, 2668, 4421, 2700]] },
      { id: 'cartouche-dewit', kind: 'cartouche', style: 'dewit', scan: 'dewit', crop: [196, 250, 1229, 1039], sizePx: 340, dark: 'min', level: [12, 66],
        // panel lettering and scale bars cleared so the renderer can letter the panel; SYRIA and coast cleared
        erase: [[232, 772, 1180, 1039], [196, 250, 300, 690]], panel: [232, 772, 1180, 1030] },
      // land vignettes and a scale bar: the palms are not placed yet, the town is a town style, the scale bar the vivid one's source
      // the palms are less saturated than the paper, so darkness alone keys them and the faint rhumb lines drop out
      { id: 'palms-aguiar', kind: 'tree', style: 'aguiar', scan: 'aguiar-chart', crop: [2530, 2962, 2732, 3248], sizePx: 70, level: [30, 62],
        erase: [[2695, 2962, 2732, 2995], [2680, 3170, 2732, 3248]] },
      // Towns: every town drawing on the chart, one sprite each, taken in turn by the renderer. `rotate`
      // deskews a drawing that leans on the vellum (degrees clockwise), and sizePx is the height a town
      // stands at, flag to foot. Lettering, rivers and rhumb lines beside each are erased. The level is
      // tighter than the roses' so the thin brown ink reads at map size.
      // Venice in its lagoon halo; the name and flagpole above and the coast names beside erased
      { id: 'town-aguiar-venice', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [2930, 728, 3160, 888], sizePx: 84, dark: 'min', level: TOWN_LEVEL,
        erase: [[3060, 728, 3160, 756], [3036, 728, 3052, 772], [3098, 786, 3160, 888], [3000, 856, 3160, 888]] },
      // Genoa under its mountain: towers, a domed gate and the blue harbour mole
      { id: 'town-aguiar-genoa', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [2762, 882, 2940, 1018], sizePx: 80, dark: 'min', level: TOWN_LEVEL,
        erase: [[2762, 882, 2802, 935], [2762, 1002, 2940, 1018], [2905, 975, 2940, 1018]] },
      // Lisbon on the Tagus: red roofs behind a wall on a green hill, the river below
      { id: 'town-aguiar-lisbon', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [1822, 1472, 1958, 1578], sizePx: 72, dark: 'min', level: TOWN_LEVEL, rotate: -4,
        erase: [[1822, 1472, 1890, 1494], [1822, 1494, 1844, 1578], [1870, 1556, 1958, 1578], [1822, 1566, 1870, 1578]] },
      // the walled town in its lake, the lake cut away (the old town-aguiar crop kept it)
      { id: 'town-aguiar-lake', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [2326, 2372, 2430, 2452], sizePx: 72, dark: 'min', level: TOWN_LEVEL },
      // the same town with its lake, the rivers leaving it erased
      { id: 'town-aguiar-lake-moat', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [2300, 2358, 2448, 2486], sizePx: 84, dark: 'min', level: TOWN_LEVEL,
        erase: [[2350, 2340, 2368, 2366], [2300, 2455, 2322, 2486], [2435, 2425, 2448, 2486], [2345, 2470, 2365, 2486], [2405, 2466, 2425, 2486]] },
      // Smina on the Niger: a round walled town on a mound, leaning on the vellum; the river erased
      { id: 'town-aguiar-smina', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [2932, 3086, 3072, 3202], sizePx: 72, dark: 'min', level: TOWN_LEVEL, rotate: 6,
        erase: [[2932, 3086, 2962, 3112], [3040, 3086, 3072, 3142], [3062, 3142, 3072, 3202], [2932, 3188, 3072, 3202], [2932, 3150, 2958, 3202]] },
      // Jerusalem, in ink only and drawn lightly, so its level is pushed harder still: a keep and a domed church inside a wall
      { id: 'town-aguiar-jerusalem', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [4708, 1612, 4815, 1714], sizePx: 72, level: [45, 85],
        erase: [[4708, 1612, 4815, 1630], [4762, 1612, 4815, 1650], [4708, 1630, 4738, 1700], [4708, 1702, 4815, 1714], [4800, 1612, 4815, 1660]] },
      // a red gate tower on the Moroccan coast (Ceuta), the coast names round it erased
      { id: 'town-aguiar-ceuta', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [2010, 1908, 2092, 2012], sizePx: 56, dark: 'min', level: TOWN_LEVEL, rotate: 8,
        erase: [[2010, 1908, 2024, 2012], [2072, 1908, 2092, 2012], [2010, 1908, 2092, 1916], [2010, 1992, 2092, 2012]] },
      // Avignon: the long red palace with its flag, drawn askew on the chart
      { id: 'town-aguiar-avignon', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [2342, 1026, 2452, 1086], sizePx: 48, dark: 'min', level: TOWN_LEVEL, rotate: -14,
        erase: [[2342, 1026, 2452, 1034], [2342, 1080, 2452, 1086]] },
      { id: 'scale-genoese', kind: 'scale', style: 'genoese', scan: 'genoese', crop: [3708, 3815, 4400, 3940], sizePx: 260, dark: 'min', level: [8, 50] },
      // Paré's sea monsters (Des monstres), black line on blank paper, with Master W's ships
      { id: 'pare-truie', kind: 'monster', style: 'pare', scan: 'pare-3289', crop: [970, 520, 2950, 1600], sizePx: 190, minClearancePx: 150, weight: 3, level: PAPER_LEVEL, denoise: 3, silhouette: PAPER_FIGURE },
      { id: 'pare-boar', kind: 'monster', style: 'pare', scan: 'pare-3267', crop: [560, 2140, 2420, 3200], sizePx: 180, minClearancePx: 140, weight: 3, level: PAPER_LEVEL, denoise: 3, silhouette: PAPER_FIGURE },
      { id: 'pare-lion', kind: 'monster', style: 'pare', scan: 'pare-3060', crop: [670, 1220, 2350, 2230], sizePx: 180, minClearancePx: 140, weight: 2, level: PAPER_LEVEL, denoise: 3, silhouette: PAPER_FIGURE },
      { id: 'pare-calf', kind: 'monster', style: 'pare', scan: 'pare-3267', crop: [640, 620, 2440, 1510], sizePx: 170, minClearancePx: 140, weight: 2, level: PAPER_LEVEL, denoise: 3, silhouette: PAPER_FIGURE },
      { id: 'pare-elephant', kind: 'monster', style: 'pare', scan: 'pare-3289', crop: [880, 2480, 2930, 3510], sizePx: 180, minClearancePx: 140, weight: 2, level: PAPER_LEVEL, denoise: 3, silhouette: PAPER_FIGURE },
      { id: 'pare-bear', kind: 'monster', style: 'pare', scan: 'pare-3059', crop: [980, 3220, 2920, 3860], sizePx: 200, minClearancePx: 150, weight: 1, level: PAPER_LEVEL, denoise: 3, silhouette: PAPER_FIGURE },
      { id: 'pare-seaman', kind: 'monster', style: 'pare', scan: 'pare-3060', crop: [520, 2940, 2410, 3910], sizePx: 170, minClearancePx: 140, weight: 1, level: PAPER_LEVEL, denoise: 3, silhouette: PAPER_FIGURE },
      // the sea bishop is tall, so drawn narrower; a stain at his feet is outside the drawn outline
      { id: 'pare-bishop', kind: 'monster', style: 'pare', scan: 'pare-3059', crop: [1400, 630, 2520, 2470], sizePx: 110, minClearancePx: 140, weight: 1, level: PAPER_LEVEL, denoise: 3, silhouette: PAPER_FIGURE,
        mask: [[1990, 630], [2110, 650], [2200, 800], [2250, 1000], [2240, 1180], [2290, 1220], [2380, 1240], [2500, 1250], [2500, 1340], [2420, 1440], [2330, 1500], [2260, 1500], [2260, 2080], [2190, 2110], [2180, 2280], [2210, 2400], [2160, 2450], [2040, 2450], [1980, 2420], [1940, 2450], [1830, 2450], [1780, 2380], [1800, 2250], [1780, 2160], [1690, 2150], [1680, 2060], [1600, 1980], [1480, 1900], [1405, 1840], [1405, 1770], [1500, 1700], [1560, 1580], [1650, 1400], [1690, 1250], [1800, 1150], [1840, 900], [1910, 660]] },
      // both ships sail bow to the left: the anchor and bowsprit are at the left end
      // engraved lines are finer than a woodcut's: no median, and levels set by the paper
      { id: 'ship-w-key', kind: 'ship', style: 'pare', scan: 'master-w-ship', crop: [10, 20, 2110, 2990], sizePx: 84, heading: 'left', level: [40, 66], bolden: 2,
        // the waves fill the plate's foot and the plate cuts the bow: both fade out instead of ending at a cut
        mask: [[70, 0], [2139, 0], [2139, 2800], [1950, 2930], [1800, 2900], [1500, 2760], [1100, 2720], [700, 2700], [300, 2600], [70, 2450]], maskFeather: 50 },
      { id: 'ship-w-buss', kind: 'ship', style: 'pare', scan: 'master-w-buss', crop: [60, 140, 1780, 2160], sizePx: 80, heading: 'left', level: [45, 76], bolden: 2,
        erase: [[1380, 140, 1540, 240]] }, // the WA monogram
    ],
  },
  {
    // de Bry after John White, The arrival of the Englishmen in Virginia (1590): a hand-coloured engraving,
    // so the pack keeps the scan's colour (the default). Ships, the sea monster, trees and palisaded villages.
    name: 'debry',
    key: 'patch',
    title: 'Sprites cropped from Theodor de Bry after John White, The arrival of the Englishmen in Virginia, Briefe and True Report, 1590 (hand-coloured)',
    licence: 'Public domain; Harvard University via the Public Domain Image Archive (Public Domain Worldwide, no additional rights)',
    ink: '#3b2a1a',
    sprites: [
      // every sprite is the whole crop, feathered at its edge; `erase` cuts only what is not the subject.
      // The two three-masted ships, both bows to the left, with the sea below and round the hull
      // (a wrecked hull above the stern is erased)
      { id: 'debry-ship-a', kind: 'ship', style: 'debry', scan: 'debry-virginia', crop: [1121, 1063, 1679, 1579], sizePx: 84, heading: 'left',
        erase: [[1505, 1000, 1690, 1096]] },
      { id: 'debry-ship-b', kind: 'ship', style: 'debry', scan: 'debry-virginia', crop: [1830, 990, 2215, 1480], sizePx: 72, heading: 'left' },
      // the sea monster at the foot of the plate, with the swell it rises from and the water below
      { id: 'debry-monster', kind: 'monster', style: 'debry', scan: 'debry-virginia', crop: [440, 1215, 1010, 1590], sizePx: 190, minClearancePx: 150, weight: 2 },
      // a dugout canoe with two paddlers, on its own water
      { id: 'debry-canoe', kind: 'ship', style: 'debry', scan: 'debry-virginia', crop: [170, 690, 310, 790], sizePx: 34, heading: 'left', erase: [[285, 755, 312, 792]] },
      // trees: the figure with the grass mound and shrubs it stands among; a tall neighbour above the poplar is erased
      { id: 'debry-tree-poplar', kind: 'tree', style: 'debry', scan: 'debry-virginia', crop: [76, 120, 262, 320], sizePx: 36, erase: [[195, 100, 270, 195]] },
      { id: 'debry-tree-poplars', kind: 'tree', style: 'debry', scan: 'debry-virginia', crop: [92, 345, 255, 528], sizePx: 44 },
      { id: 'debry-tree-broadleaf', kind: 'tree', style: 'debry', scan: 'debry-virginia', crop: [262, 200, 478, 378], sizePx: 56 },
      { id: 'debry-tree-grove', kind: 'tree', style: 'debry', scan: 'debry-virginia', crop: [1375, 405, 1590, 582], sizePx: 54, erase: [[1370, 400, 1445, 424]] },
      // the grapevine's leaf beside the conifer is erased
      { id: 'debry-tree-conifer', kind: 'tree', style: 'debry', scan: 'debry-virginia', crop: [1585, 450, 1690, 575], sizePx: 26, erase: [[1666, 440, 1700, 500]] },
      { id: 'debry-tree-palm', kind: 'tree', style: 'debry', scan: 'debry-virginia', crop: [2005, 405, 2110, 595], sizePx: 24 },
      // palisaded Algonquian villages with the land, shore and haystacks round them; the place-name lettering is outside the crop
      { id: 'debry-village-dasamonguepeuc', kind: 'town', style: 'debry', scan: 'debry-virginia', crop: [585, 296, 695, 385], sizePx: 44 },
      { id: 'debry-village-pasquenoke', kind: 'town', style: 'debry', scan: 'debry-virginia', crop: [1288, 150, 1406, 228], sizePx: 44 },
      { id: 'debry-village-roanoac', kind: 'town', style: 'debry', scan: 'debry-virginia', crop: [755, 602, 925, 702], sizePx: 48, erase: [[785, 693, 835, 702]] },
    ],
  },
];

function magick(...args) {
  return execFileSync('magick', args.flat(), { encoding: 'utf8' }).trim();
}

// The anchor of a sprite cut wider than its figure: the figure's own anchor (centred across, a monster or
// ship 0.75 down, else centred), as a fraction of the finished sprite.
function figureAnchor(sprite, fig, ox, oy, tw, th) {
  const ay = sprite.kind === 'monster' || sprite.kind === 'ship' ? 0.75 : 0.5;
  const r = (v) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
  return [r(((fig[0] + fig[2]) / 2 - ox) / tw), r((fig[1] + ay * (fig[3] - fig[1]) - oy) / th)];
}

function buildSprite(sprite, colour, key, outDir, tmp) {
  const scan = SOURCES[sprite.scan];
  const [x0, y0, x1, y1] = sprite.crop;
  const w = x1 - x0, h = y1 - y0;
  const t = (n) => join(tmp, `${sprite.id}.${n}.png`);

  // `bolden` widens fine engraved lines (px, scan scale) that a large reduction would grey out
  const bolden = sprite.bolden ? ['-morphology', 'Erode', `Disk:${sprite.bolden}`] : [];
  magick(`${scan.path}[0]`, '-crop', `${w}x${h}+${x0}+${y0}`, '+repage', '-alpha', 'off', bolden, t('crop'));
  // deskew about the crop's centre; the corners fill from the edge pixels and fade out at the edge below
  if (sprite.rotate) magick(t('crop'), '-virtual-pixel', 'Edge', '-distort', 'SRT', String(sprite.rotate), t('crop'));
  // kept images carry no date chunks, so a rebuild with the same inputs is byte-identical
  if (keep && sprite.id.startsWith(keepPrefix)) magick(t('crop'), '-strip', '-define', 'png:exclude-chunk=all', join(keep, `${sprite.id}.raw.png`));

  // Lettering on the scan (wind names on a rose) is closed away from the colour image before keying:
  // a grayscale closing removes dark strokes thinner than the disk and keeps the petal wash beneath.
  for (const [cx0, cy0, cx1, cy1] of sprite.clean ?? []) {
    const cw = cx1 - cx0, ch = cy1 - cy0, at = `+${cx0 - x0}+${cy0 - y0}`;
    magick(t('crop'), '-crop', `${cw}x${ch}${at}`, '+repage', '-morphology', 'Close', `Disk:${CLEAN_DISK}`, t('closed'));
    magick('-size', `${cw}x${ch}`, 'xc:black', '-fill', 'white', '-draw', `rectangle 3,3 ${cw - 4},${ch - 4}`, '-blur', '0x2', t('cmask'));
    magick(t('closed'), t('cmask'), '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', t('cpatch'));
    magick(t('crop'), t('cpatch'), '-geometry', at, '-compose', 'Over', '-composite', t('crop'));
  }

  // Ink = darkness. 'lum' for line work; 'min' (min of R,G,B) so gilt and colour count as ink too.
  const dark = sprite.dark === 'min'
    ? [t('crop'), '-separate', '-evaluate-sequence', 'min']
    : [t('crop'), '-colorspace', 'gray'];
  // a grainy scan's paper speckles are taken out with a median before the levels catch them
  const denoise = sprite.denoise ? ['-statistic', 'Median', `${sprite.denoise}x${sprite.denoise}`] : [];
  const [lo, hi] = sprite.level ?? [18, 64];
  // Keep the tone: alpha is continuous ink coverage, so shading, hatching and washes survive.
  magick(dark, denoise, '-level', `${lo}%,${hi}%`, '-negate', t('ink'));

  const masks = [];
  if (sprite.silhouette) {
    const s = sprite.silhouette;
    const seed = s.ink ? [t('ink'), '-threshold', `${s.ink}%`]
      : [t('crop'), '-colorspace', 'HSL', '-channel', 'G', '-separate', '+channel', '-threshold', `${s.sat}%`];
    magick(seed, '-morphology', 'Open', 'Disk:1.5', '-morphology', 'Close', `Disk:${s.close}`,
      // fill enclosed holes: flood the outside from a 1 px border, then everything not outside is figure
      '-bordercolor', 'black', '-border', '1', '-fill', 'red', '-draw', 'color 0,0 floodfill',
      '-fill', 'white', '+opaque', 'red', '-fill', 'black', '-opaque', 'red', '-shave', '1x1',
      '-morphology', 'Open', `Disk:${s.open}`,
      '-define', `connected-components:area-threshold=${s.minArea}`, '-define', 'connected-components:mean-color=true',
      '-connected-components', '8',
      '-morphology', 'Dilate', `Disk:${s.dilate}`, '-blur', `0x${s.feather}`, t('sil'));
    masks.push(t('sil'));
  }
  if (sprite.mask) {
    // the figure's outline, drawn by eye on the scan, for a figure on sea hatched in its own ink
    const pts = sprite.mask.map(([mx, my]) => `${mx - x0},${my - y0}`).join(' ');
    magick('-size', `${w}x${h}`, 'xc:black', '-fill', 'white', '-draw', `polygon ${pts}`, '-blur', `0x${sprite.maskFeather ?? MASK_FEATHER}`, t('mask'));
    masks.push(t('mask'));
  }
  if (sprite.circle) {
    const [cx, cy, r] = sprite.circle;
    magick('-size', `${w}x${h}`, 'xc:black', '-fill', 'white', '-draw', `circle ${cx},${cy} ${cx + r},${cy}`, '-blur', '0x2', t('circle'));
    masks.push(t('circle'));
  }
  if (sprite.erase) {
    const draws = sprite.erase.flatMap(([ex0, ey0, ex1, ey1]) =>
      ['-draw', `rectangle ${ex0 - x0},${ey0 - y0} ${ex1 - x0},${ey1 - y0}`]);
    // erase boxes are in scan coordinates, so the mask turns with the crop
    const turn = sprite.rotate ? ['-virtual-pixel', 'Edge', '-distort', 'SRT', String(sprite.rotate)] : [];
    magick('-size', `${w}x${h}`, 'xc:white', '-fill', 'black', draws, turn, '-blur', '0x3', t('erase'));
    masks.push(t('erase'));
  }

  // fade the last few px at the crop edge so no sprite shows a cut line
  const f = 6;
  magick('-size', `${w - 2 * f}x${h - 2 * f}`, 'xc:white', '-bordercolor', 'black', '-border', String(f), '-blur', `0x${f / 2}`, t('edge'));
  masks.push(t('edge'));

  // the patch key starts from the whole crop and lets the masks cut the figure's outline
  let alpha = t('ink');
  if ((sprite.key ?? key) === 'patch') { magick('-size', `${w}x${h}`, 'xc:white', t('all')); alpha = t('all'); }
  for (const m of masks) {
    magick(alpha, m, '-compose', 'multiply', '-composite', t('alpha'));
    alpha = t('alpha');
  }

  if (keep && sprite.id.startsWith(keepPrefix)) magick(alpha, '-strip', '-define', 'png:exclude-chunk=all', join(keep, `${sprite.id}.key.png`));

  // Trim box on the alpha, recorded so the manifest crop is the final sprite's footprint in the scan.
  const trim = magick(alpha, '-fuzz', '3%', '-format', '%@', 'info:');
  const m = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(trim);
  const [tw, th, tx, ty] = m.slice(1).map(Number);
  const file = `${sprite.id}.png`;
  // Source colour: divide out the paper (the mean of the crop where there is no ink), so the
  // scan's paper reads as white under `multiply` and only the inks and washes carry tone.
  let rgb = ['-size', `${w}x${h}`, 'xc:black'];
  if (colour === 'source') {
    const paper = sprite.paper ?? magick(t('crop'), '(', alpha, '-negate', '-threshold', '96%', ')', '-alpha', 'off',
      '-compose', 'CopyOpacity', '-composite', '-scale', '1x1!', '-alpha', 'off', '-format', '%[pixel:p{0,0}]', 'info:');
    magick(t('crop'), '(', '-size', `${w}x${h}`, `xc:${paper}`, ')', '-compose', 'DivideDst', '-composite', t('rgb'));
    rgb = [t('rgb')];
  }
  // Keyed at full size, then shrunk with Lanczos to MAX_SCALE x sizePx across when wider (the
  // renderer draws a sprite sizePx wide), so line work stays crisp and no scan-sized PNG is kept.
  // `figure` is the box round the subject alone, for a sprite whose crop holds water or ground round it: the
  // figure keeps its sizePx and its anchor, so the extra surroundings do not shrink it on the map.
  const fig = sprite.figure;
  const sizePx = fig ? Math.round(sprite.sizePx * tw / (fig[2] - fig[0])) : sprite.sizePx;
  const most = MAX_SCALE * sizePx;
  const shrink = tw > most ? ['-filter', 'Lanczos', '-resize', `${most}x`] : [];
  magick(rgb, alpha, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    '-crop', `${tw}x${th}+${tx}+${ty}`, '+repage', shrink, '-strip', join(outDir, file));

  if (keep && sprite.id.startsWith(keepPrefix)) {
    // multiplied onto parchment, as the renderer draws it, so the kept `.cut.png` shows the true colours
    magick(join(outDir, file), '(', '+clone', '-alpha', 'off', '-fill', PARCHMENT, '-colorize', '100', ')', '+swap', '-compose', 'Multiply', '-composite',
      '-strip', '-define', 'png:exclude-chunk=all', join(keep, `${sprite.id}.cut.png`));
  }

  const entry = {
    id: sprite.id, kind: sprite.kind, style: sprite.style, file,
    anchor: fig ? figureAnchor(sprite, fig, x0 + tx, y0 + ty, tw, th) : [0.5, sprite.kind === 'monster' || sprite.kind === 'ship' ? 0.75 : 0.5],
    sizePx, bands: [0, 1],
    source: { url: scan.url, page: scan.page, crop: [x0 + tx, y0 + ty, x0 + tx + tw, y0 + ty + th] },
  };
  if (sprite.minClearancePx) entry.minClearancePx = sprite.minClearancePx;
  if (sprite.weight) entry.weight = sprite.weight;
  if (sprite.heading) entry.heading = sprite.heading;
  if (sprite.heightPx) entry.heightPx = sprite.heightPx;
  else if (sprite.kind === 'town') entry.heightPx = sprite.sizePx; // a town stands at sizePx, flag to foot
  if (sprite.panel) {
    const [px0, py0, px1, py1] = sprite.panel;
    // panel in sprite-local fractions, for lettering
    entry.panel = [(px0 - x0 - tx) / tw, (py0 - y0 - ty) / th, (px1 - x0 - tx) / tw, (py1 - y0 - ty) / th]
      .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000);
  }
  return entry;
}

const ASSETS_HEAD = `# Assets

Generated by \`npm run packs\` from \`scripts/sources.json\`; edit the manifest, not this file. Downloaded into \`downloads/\` (not committed) and checked against the sha256 below. Crop boxes per sprite are in each \`packs/*/pack.json\`.

| File | URL | sha256 | Rights |
|---|---|---|---|
`;

function writeAssets() {
  const rows = MANIFEST.sources.map((s) => {
    const file = `\`${s.file}\`${s.note ? ` ${s.note}` : ''}`;
    return `| ${file} | ${s.url}${s.page ? ` — page ${s.page}` : ''} | \`${s.sha256}\` | ${s.rights} |`;
  });
  writeFileSync(join(ROOT, 'ASSETS.md'), `${ASSETS_HEAD}${rows.join('\n')}\n\n${MANIFEST.footer.join('\n\n')}\n`);
}

const tmp = mkdtempSync(join(tmpdir(), 'packs-'));
try {
  const packs = only ? PACKS.filter((p) => p.name === only) : PACKS;
  if (!packs.length) throw new Error(`--only ${only}: no such pack (${PACKS.map((p) => p.name).join(', ')})`);
  const used = new Set(packs.flatMap((p) => p.sprites.map((s) => s.scan)));
  for (const id of used) await fetchSource(SOURCES[id]);
  for (const pack of packs) {
    const outDir = join(ROOT, 'packs', pack.name);
    mkdirSync(outDir, { recursive: true });
    const colour = pack.colour ?? 'source';
    const sprites = pack.sprites.map((s) => buildSprite(s, colour, pack.key ?? 'patch', outDir, tmp));
    const manifest = { name: pack.name, title: pack.title, licence: pack.licence, colour, ink: pack.ink, sprites };
    // keep short numeric arrays (anchor, crop, panel) on one line
    const json = JSON.stringify(manifest, null, 2).replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, xs) => `[${xs.split(/,\s*/).join(', ')}]`);
    writeFileSync(join(outDir, 'pack.json'), json + '\n');
    console.log(`${pack.name}: ${sprites.map((s) => s.id).join(', ')}`);
  }
  if (!only) writeAssets();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
