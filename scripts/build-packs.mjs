// Pack build: crop public-domain scans into sprites and write each pack's pack.json.
// Usage: node scripts/build-packs.mjs   (needs ImageMagick 7 `magick` on PATH; network for the first run)
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

// Woodcuts and engravings on blank paper (Paré, Master W): darkness alone keys them. The silhouette
// is taken from the ink itself (`ink`: alpha % that counts), which drops paper grain, stains and
// the faint lettering that shows through from the reverse; sizes are for ~600 dpi scans.
const PAPER_LEVEL = [20, 50];
const PAPER_FIGURE = { ink: 50, close: 14, open: 1, dilate: 8, feather: 4, minArea: 40000 };

const CLEAN_DISK = 5; // px radius of the closing that removes scanned lettering
const MASK_FEATHER = 6; // px blur on a polygon mask's edge, in scan pixels (`maskFeather` widens it)
const MAX_SCALE = 3; // a sprite is stored at most this many px wide per CSS px it is drawn (sizePx)

// One pack of scanned sprites; each sprite's `style` names the design family it belongs to, which
// the renderer offers as a setting (a rose set, a monster family, a town drawing).
const PACKS = [
  {
    name: 'scanned',
    title: 'Sprites cropped from scans: Olaus Magnus, Carta Marina 1539; Jorge de Aguiar 1492; Catalan Atlas 1375; Genoese chart c. 1320-1350; Frederik de Wit; Ambroise Paré, Des monstres; Master W with the Key, two ship engravings c. 1475-1490',
    licence: 'Public domain (PD-Art); scans via Wikimedia Commons (James Ford Bell Library; Beinecke Library, Yale; BnF Gallica btv1b55002481n; Library of Congress 2003630429; Royal Museums Greenwich). The pare-* sprites: Wellcome Collection, CC BY 4.0. Ships ship-w-*: Art Institute of Chicago 27881 (CC0) and Rijksmuseum RP-P-2014-30 (Public Domain Mark)',
    ink: '#3b2a1a',
    sprites: [
      { id: 'serpent-a', kind: 'monster', style: 'carta-marina', scan: 'carta-marina', crop: [1698, 880, 2065, 1190], sizePx: 200, minClearancePx: 160, weight: 3, level: SEA_FIGURE_LEVEL, silhouette: SEA_FIGURE, erase: [[1975, 935, 2065, 1102], [1715, 1112, 1800, 1145]] },
      { id: 'whale-b', kind: 'monster', style: 'carta-marina', scan: 'carta-marina', crop: [2040, 358, 2350, 532], sizePx: 190, minClearancePx: 150, weight: 2, level: SEA_FIGURE_LEVEL, silhouette: SEA_FIGURE },
      { id: 'pistrix-c', kind: 'monster', style: 'carta-marina', scan: 'carta-marina', crop: [374, 1236, 566, 1432], sizePx: 150, minClearancePx: 130, weight: 2, level: SEA_FIGURE_LEVEL, silhouette: SEA_FIGURE },
      { id: 'cete-e', kind: 'monster', style: 'carta-marina', scan: 'carta-marina', crop: [1788, 572, 2046, 732], sizePx: 180, minClearancePx: 140, weight: 1, level: SEA_FIGURE_LEVEL, silhouette: SEA_FIGURE },
      { id: 'ship-a', kind: 'ship', style: 'carta-marina', scan: 'carta-marina', crop: [1160, 800, 1312, 1000], sizePx: 80, heading: 'right', level: SEA_FIGURE_LEVEL, silhouette: { ...SEA_FIGURE, dilate: 3, close: 9 }, erase: [[1215, 975, 1275, 1000]] },
      { id: 'ship-b', kind: 'ship', style: 'carta-marina', scan: 'carta-marina', crop: [2085, 708, 2212, 802], sizePx: 64, heading: 'right', level: SEA_FIGURE_LEVEL, silhouette: { ...SEA_FIGURE, dilate: 3, minArea: 300 } },
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
      // a walled town in its lake; the rivers leaving the lake erased
      { id: 'town-aguiar', kind: 'town', style: 'aguiar', scan: 'aguiar-chart', crop: [2300, 2350, 2450, 2465], sizePx: 60, dark: 'min', level: [10, 70],
        erase: [[2350, 2340, 2365, 2354], [2300, 2440, 2322, 2470], [2435, 2415, 2460, 2470], [2345, 2460, 2365, 2470], [2405, 2458, 2425, 2470]] },
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
];

function magick(...args) {
  return execFileSync('magick', args.flat(), { encoding: 'utf8' }).trim();
}

function buildSprite(sprite, colour, outDir, tmp) {
  const scan = SOURCES[sprite.scan];
  const [x0, y0, x1, y1] = sprite.crop;
  const w = x1 - x0, h = y1 - y0;
  const t = (n) => join(tmp, `${sprite.id}.${n}.png`);

  // `bolden` widens fine engraved lines (px, scan scale) that a large reduction would grey out
  const bolden = sprite.bolden ? ['-morphology', 'Erode', `Disk:${sprite.bolden}`] : [];
  magick(`${scan.path}[0]`, '-crop', `${w}x${h}+${x0}+${y0}`, '+repage', '-alpha', 'off', bolden, t('crop'));

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
    magick('-size', `${w}x${h}`, 'xc:white', '-fill', 'black', draws, '-blur', '0x3', t('erase'));
    masks.push(t('erase'));
  }

  // fade the last few px at the crop edge so no sprite shows a cut line
  const f = 6;
  magick('-size', `${w - 2 * f}x${h - 2 * f}`, 'xc:white', '-bordercolor', 'black', '-border', String(f), '-blur', `0x${f / 2}`, t('edge'));
  masks.push(t('edge'));

  let alpha = t('ink');
  for (const m of masks) {
    magick(alpha, m, '-compose', 'multiply', '-composite', t('alpha'));
    alpha = t('alpha');
  }

  // Trim box on the alpha, recorded so the manifest crop is the final sprite's footprint in the scan.
  const trim = magick(alpha, '-fuzz', '3%', '-format', '%@', 'info:');
  const m = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(trim);
  const [tw, th, tx, ty] = m.slice(1).map(Number);
  const file = `${sprite.id}.png`;
  // Source colour: divide out the paper (the mean of the crop where there is no ink), so the
  // scan's paper reads as white under `multiply` and only the inks and washes carry tone.
  let rgb = ['-size', `${w}x${h}`, 'xc:black'];
  if (colour === 'source') {
    const paper = magick(t('crop'), '(', alpha, '-negate', '-threshold', '96%', ')', '-alpha', 'off',
      '-compose', 'CopyOpacity', '-composite', '-scale', '1x1!', '-alpha', 'off', '-format', '%[pixel:p{0,0}]', 'info:');
    magick(t('crop'), '(', '-size', `${w}x${h}`, `xc:${paper}`, ')', '-compose', 'DivideDst', '-composite', t('rgb'));
    rgb = [t('rgb')];
  }
  // Keyed at full size, then shrunk with Lanczos to MAX_SCALE x sizePx across when wider (the
  // renderer draws a sprite sizePx wide), so line work stays crisp and no scan-sized PNG is kept.
  const most = MAX_SCALE * sprite.sizePx;
  const shrink = tw > most ? ['-filter', 'Lanczos', '-resize', `${most}x`] : [];
  magick(rgb, alpha, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    '-crop', `${tw}x${th}+${tx}+${ty}`, '+repage', shrink, '-strip', join(outDir, file));

  const entry = {
    id: sprite.id, kind: sprite.kind, style: sprite.style, file,
    anchor: [0.5, sprite.kind === 'monster' || sprite.kind === 'ship' ? 0.75 : 0.5],
    sizePx: sprite.sizePx, bands: [0, 1],
    source: { url: scan.url, page: scan.page, crop: [x0 + tx, y0 + ty, x0 + tx + tw, y0 + ty + th] },
  };
  if (sprite.minClearancePx) entry.minClearancePx = sprite.minClearancePx;
  if (sprite.weight) entry.weight = sprite.weight;
  if (sprite.heading) entry.heading = sprite.heading;
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
  const used = new Set(PACKS.flatMap((p) => p.sprites.map((s) => s.scan)));
  for (const id of used) await fetchSource(SOURCES[id]);
  for (const pack of PACKS) {
    const outDir = join(ROOT, 'packs', pack.name);
    mkdirSync(outDir, { recursive: true });
    const colour = pack.colour ?? 'source';
    const sprites = pack.sprites.map((s) => buildSprite(s, colour, outDir, tmp));
    const manifest = { name: pack.name, title: pack.title, licence: pack.licence, colour, ink: pack.ink, sprites };
    // keep short numeric arrays (anchor, crop, panel) on one line
    const json = JSON.stringify(manifest, null, 2).replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, xs) => `[${xs.split(/,\s*/).join(', ')}]`);
    writeFileSync(join(outDir, 'pack.json'), json + '\n');
    console.log(`${pack.name}: ${sprites.map((s) => s.id).join(', ')}`);
  }
  writeAssets();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
