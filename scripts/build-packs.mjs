// Pack build: crop public-domain scans into ink-mask sprites and write each pack's pack.json.
// Usage: node scripts/build-packs.mjs   (needs ImageMagick 7 `magick` on PATH; network for the first run)
//
// scripts/sources.json is the sources manifest: every file, URL, sha256 and rights line. Scans are
// downloaded into downloads/ when missing, checked against it, and ASSETS.md is written from it.
//
// A sprite PNG is black RGB with alpha = ink coverage. The renderer fills it with the pack ink
// and composites with `multiply`, so one ink setting retints the whole pack.
//
// Keying: crop -> darkness channel (luminance, or min(R,G,B) so gilt and colour wash count as ink)
// -> levels -> threshold + feather -> optional fill (lettering inside dark fields) -> masks (saturation silhouette for figures on hatched sea, circle for roses,
// rectangles erased for lettering) -> trim.

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
    const res = await fetch(src.url, { headers: { 'user-agent': 'portolani-build/0.1 (https://github.com/mark-brannan/portolani)' } });
    if (!res.ok) throw new Error(`${src.url}: ${res.status}`);
    writeFileSync(src.path, Buffer.from(await res.arrayBuffer()));
  }
  const got = createHash('sha256').update(readFileSync(src.path)).digest('hex');
  if (got !== src.sha256) throw new Error(`${src.file}: sha256 ${got} does not match the manifest (${src.sha256})`);
}

// Key: ink = darkness after levels; alpha = ink above `threshold`, then softened by `feather` px.
// A hard cut with a short feather leaves no grey fringe of parchment-tinted ink around the line work.
const KEY = { threshold: 50, feather: 0.6 };

// Figures on the Carta Marina sit on hatched sea, so they take a saturation silhouette.
const SEA_FIGURE_LEVEL = [26, 56]; // woodcut line only; colour fills and sea hatching mostly drop out
const SEA_FIGURE = { sat: 24, close: 7, open: 5, dilate: 9, feather: 4, minArea: 900 };

const PACKS = [
  {
    name: 'carta-marina',
    title: 'Carta Marina, Olaus Magnus, 1539',
    licence: 'Public domain (PD-Art); scan: James Ford Bell Library via Wikimedia Commons',
    ink: '#3b2a1a',
    sprites: [
      { id: 'serpent-a', kind: 'monster', scan: 'carta-marina', crop: [1698, 880, 2065, 1190], sizePx: 200, minClearancePx: 160, weight: 3, level: SEA_FIGURE_LEVEL, silhouette: SEA_FIGURE, erase: [[1975, 935, 2065, 1102], [1715, 1112, 1800, 1145]] },
      { id: 'whale-b', kind: 'monster', scan: 'carta-marina', crop: [2040, 358, 2350, 532], sizePx: 190, minClearancePx: 150, weight: 2, level: SEA_FIGURE_LEVEL, silhouette: SEA_FIGURE },
      { id: 'pistrix-c', kind: 'monster', scan: 'carta-marina', crop: [374, 1236, 566, 1432], sizePx: 150, minClearancePx: 130, weight: 2, level: SEA_FIGURE_LEVEL, silhouette: SEA_FIGURE },
      { id: 'cete-e', kind: 'monster', scan: 'carta-marina', crop: [1788, 572, 2046, 732], sizePx: 180, minClearancePx: 140, weight: 1, level: SEA_FIGURE_LEVEL, silhouette: SEA_FIGURE },
      { id: 'ship-a', kind: 'ship', scan: 'carta-marina', crop: [1160, 800, 1312, 1000], sizePx: 80, heading: 'right', level: SEA_FIGURE_LEVEL, silhouette: { ...SEA_FIGURE, dilate: 6, close: 9 }, erase: [[1215, 975, 1275, 1000]] },
      { id: 'ship-b', kind: 'ship', scan: 'carta-marina', crop: [2085, 708, 2212, 802], sizePx: 64, heading: 'right', level: SEA_FIGURE_LEVEL, silhouette: { ...SEA_FIGURE, dilate: 6, minArea: 300 } },
    ],
  },
  {
    name: 'catalan',
    title: 'Portolan roses and cartouche: Jorge de Aguiar 1492, Catalan Atlas 1375, Frederik de Wit',
    licence: 'Public domain; scans via Wikimedia Commons (Beinecke Library, Yale; BnF Gallica btv1b55002481n; Royal Museums Greenwich)',
    ink: '#3b2a1a',
    sprites: [
      { id: 'rose-aguiar', kind: 'rose', scan: 'aguiar', crop: [55, 80, 665, 690], sizePx: 300, dark: 'min', level: [12, 78], circle: [300, 300, 300],
        // wind names: those on dark petals are filled in, the inner-ring letters are cleared
        fill: [[340, 108, 402, 160], [178, 195, 235, 235], [490, 190, 552, 232], [110, 358, 172, 390], [548, 370, 612, 402], [168, 495, 215, 545], [335, 590, 372, 640], [500, 505, 555, 552]],
        erase: [[259, 274, 286, 301], [444, 272, 471, 298], [220, 364, 243, 390], [468, 364, 500, 388], [444, 444, 466, 470], [272, 454, 296, 478], [342, 494, 366, 520]] },
      { id: 'rose-catalan', kind: 'rose', scan: 'catalan', crop: [120, 185, 440, 505], sizePx: 110, dark: 'min', level: [10, 70], circle: [160, 160, 152],
        erase: [[236, 188, 316, 222], [124, 266, 150, 294], [392, 306, 424, 360]] },
      { id: 'cartouche-dewit', kind: 'cartouche', scan: 'dewit', crop: [196, 250, 1229, 1039], sizePx: 340, dark: 'min', level: [12, 66],
        // panel lettering and scale bars cleared so the renderer can letter the panel; SYRIA and coast cleared
        erase: [[232, 772, 1180, 1039], [196, 250, 300, 690]], panel: [232, 772, 1180, 1030] },
    ],
  },
];

function magick(...args) {
  return execFileSync('magick', args.flat(), { encoding: 'utf8' }).trim();
}

function buildSprite(sprite, outDir, tmp) {
  const scan = SOURCES[sprite.scan];
  const [x0, y0, x1, y1] = sprite.crop;
  const w = x1 - x0, h = y1 - y0;
  const t = (n) => join(tmp, `${sprite.id}.${n}.png`);

  magick(`${scan.path}[0]`, '-crop', `${w}x${h}+${x0}+${y0}`, '+repage', '-alpha', 'off', t('crop'));

  // Ink = darkness. 'lum' for line work; 'min' (min of R,G,B) so gilt and colour count as ink too.
  const dark = sprite.dark === 'min'
    ? [t('crop'), '-separate', '-evaluate-sequence', 'min']
    : [t('crop'), '-colorspace', 'gray'];
  const [lo, hi] = sprite.level ?? [18, 64];
  const key = { ...KEY, ...sprite.key };
  magick(dark, '-level', `${lo}%,${hi}%`, '-negate', '-threshold', `${key.threshold}%`, '-blur', `0x${key.feather}`, t('ink'));

  // fill: boxes where lettering sits inside a dark field (wind names on petals); close the glyph holes
  if (sprite.fill) {
    const draws = sprite.fill.flatMap(([fx0, fy0, fx1, fy1]) =>
      ['-draw', `rectangle ${fx0 - x0},${fy0 - y0} ${fx1 - x0},${fy1 - y0}`]);
    magick('-size', `${w}x${h}`, 'xc:black', '-fill', 'white', draws, t('fillbox'));
    magick(t('ink'), '-morphology', 'Close', 'Disk:4', t('closed'));
    magick(t('closed'), t('fillbox'), '-compose', 'multiply', '-composite', t('closedbox'));
    magick(t('ink'), t('closedbox'), '-compose', 'lighten', '-composite', t('ink'));
  }

  const masks = [];
  if (sprite.silhouette) {
    const s = sprite.silhouette;
    magick(t('crop'), '-colorspace', 'HSL', '-channel', 'G', '-separate', '+channel',
      '-threshold', `${s.sat}%`, '-morphology', 'Open', 'Disk:1.5', '-morphology', 'Close', `Disk:${s.close}`,
      // fill enclosed holes: flood the outside from a 1 px border, then everything not outside is figure
      '-bordercolor', 'black', '-border', '1', '-fill', 'red', '-draw', 'color 0,0 floodfill',
      '-fill', 'white', '+opaque', 'red', '-fill', 'black', '-opaque', 'red', '-shave', '1x1',
      '-morphology', 'Open', `Disk:${s.open}`,
      '-define', `connected-components:area-threshold=${s.minArea}`, '-define', 'connected-components:mean-color=true',
      '-connected-components', '8',
      '-morphology', 'Dilate', `Disk:${s.dilate}`, '-blur', `0x${s.feather}`, t('sil'));
    masks.push(t('sil'));
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
  magick('-size', `${w}x${h}`, 'xc:black', alpha, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite',
    '-crop', `${tw}x${th}+${tx}+${ty}`, '+repage', '-strip', join(outDir, file));

  const entry = {
    id: sprite.id, kind: sprite.kind, file,
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
    const sprites = pack.sprites.map((s) => buildSprite(s, outDir, tmp));
    const manifest = { name: pack.name, title: pack.title, licence: pack.licence, ink: pack.ink, sprites };
    // keep short numeric arrays (anchor, crop, panel) on one line
    const json = JSON.stringify(manifest, null, 2).replace(/\[\s+([-\d.,\s]+?)\s+\]/g, (_, xs) => `[${xs.split(/,\s*/).join(', ')}]`);
    writeFileSync(join(outDir, 'pack.json'), json + '\n');
    console.log(`${pack.name}: ${sprites.map((s) => s.id).join(', ')}`);
  }
  writeAssets();
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
