// Old versus new for the goldens a branch moved: for each test/golden/*.png that differs from the
// base, writes <name>-old.png, <name>-new.png and <name>-diff.png (changed pixels red, the rest
// dimmed new) to out/golden-diff/, and a markdown table of them to $GITHUB_STEP_SUMMARY (or stdout).
//   node scripts/golden-diff.mjs [base-ref]      base-ref defaults to origin/main
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { compare } from './golden-compare.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'out', 'golden-diff');
const base = process.argv[2] || 'origin/main';
const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 26 });

const mergeBase = git('merge-base', base, 'HEAD').toString().trim();
const files = git('diff', '--name-status', '--no-renames', mergeBase, 'HEAD', '--', 'test/golden/')
  .toString().split('\n').filter((l) => l.endsWith('.png')).map((l) => l.split('\t'));

const rows = [];
mkdirSync(OUT, { recursive: true });
for (const [status, path] of files) {
  const name = basename(path, '.png');
  const oldBytes = status === 'A' ? null : git('show', `${mergeBase}:${path}`);
  const newBytes = status === 'D' ? null : readFileSync(join(ROOT, path));
  if (newBytes) writeFileSync(join(OUT, `${name}-new.png`), newBytes);
  if (oldBytes) writeFileSync(join(OUT, `${name}-old.png`), oldBytes);
  if (!oldBytes || !newBytes) { rows.push(`| ${name} | ${oldBytes ? 'removed' : 'added'} | |`); continue; }
  const was = await loadImage(oldBytes), now = await loadImage(newBytes);
  const w = now.width, h = now.height;
  const px = (img) => { const c = createCanvas(w, h), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, w, h).data; };
  const a = px(now), b = px(was);
  const c = createCanvas(w, h), g = c.getContext('2d');
  const { bad, data: out } = compare(a, b, w, h, (x, y) => g.createImageData(x, y));
  g.putImageData(out, 0, 0);
  writeFileSync(join(OUT, `${name}-diff.png`), c.toBuffer('image/png'));
  rows.push(`| ${name} | changed | ${(100 * bad / (w * h)).toFixed(2)}% of pixels |`);
}

const body = rows.length
  ? `## Goldens moved by this branch\n\n| golden | change | size of the change |\n|---|---|---|\n${rows.join('\n')}\n\nOld, new and diff images of each are in the \`golden-diff\` workflow artifact (\`<name>-old.png\`, \`<name>-new.png\`, \`<name>-diff.png\`).\n`
  : '## Goldens moved by this branch\n\nNone: test/golden/ is the same as the base.\n';
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, body); else console.log(body);
