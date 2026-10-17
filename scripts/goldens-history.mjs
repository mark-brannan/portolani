#!/usr/bin/env node
// The goldens history sheet: for each of the last N commits that touched the goldens, every golden
// that commit changed, as before / after / diff pictures and the shared golden-diff engine's score
// (SSIM, changed-pixel fraction, bounding-box union, grade). Run by goldens-history.yml on dispatch;
// a measurement, never a gate.
//
//   node scripts/goldens-history.mjs [N=20]      out: $OUT_DIR/index.html, history.md, history.json, images/
//
// Portable: the constants below are all a port to another repo changes.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const GOLDEN_DIR = process.env.GOLDEN_DIR || 'test/golden/';          // repo-relative, trailing slash
const ENGINE_DIR = resolve(process.env.ENGINE_DIR || '.golden-diff-engine/.github/scripts'); // holds golden-diff.mjs
const OUT_DIR = resolve(process.env.OUT_DIR || 'out/goldens-history');
const LARGE_SSIM = Number(process.env.LARGE_SSIM || 0.80);            // the engine's defaults
const MEDIUM_SSIM = Number(process.env.MEDIUM_SSIM || 0.95);
const EMPTY_TREE = '4b825dc642cb6eb9a748508b50d4fb4b4b5a4a8b';        // parent of a root commit

const N = Number(process.argv[2] || 20);
if (!Number.isInteger(N) || N < 1) { console.error('goldens-history: N must be a positive integer'); process.exit(2); }

// The engine is a module (scorePair, grade); its PNG codec comes from its own deps.mjs.
const engine = await import(pathToFileURL(join(ENGINE_DIR, 'golden-diff.mjs')).href);
const { PNG } = await import(pathToFileURL(join(ENGINE_DIR, 'golden-diff', 'deps.mjs')).href);
const { scorePair, grade } = engine;

const git = (...a) => execFileSync('git', a, { maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const gitText = (...a) => git(...a).toString();

const commits = gitText('log', `-n${N}`, '--first-parent', '--format=%H%x09%cs%x09%s', '--', GOLDEN_DIR)
  .split('\n').filter(Boolean).map((l) => { const [sha, date, ...s] = l.split('\t'); return { sha, date, title: s.join('\t') }; })
  .reverse(); // oldest first, like a history

mkdirSync(join(OUT_DIR, 'images'), { recursive: true });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stemOf = (p) => p.replace(/\.png$/i, '').split('/').join('__').replace(/[^\w.-]/g, '_');
const prOf = (title) => (title.match(/\(#(\d+)\)\s*$/) || [])[1] || '';

const rows = [];
for (const c of commits) {
  let parent = EMPTY_TREE;
  try { parent = gitText('rev-parse', '--verify', '--quiet', `${c.sha}^`).trim() || EMPTY_TREE; } catch { /* root commit */ }
  const files = gitText('diff-tree', '-r', '--no-renames', '--name-status', '-z', parent, c.sha, '--', GOLDEN_DIR).split('\0');
  const short = c.sha.slice(0, 7);
  for (let i = 0; i + 1 < files.length; i += 2) {
    const status = files[i][0], path = files[i + 1];
    if (!/\.png$/i.test(path)) continue;
    const row = { commit: short, date: c.date, pr: prOf(c.title), title: c.title, path,
      status: status === 'A' ? 'added' : status === 'D' ? 'removed' : 'modified' };
    const stem = `${short}__${stemOf(path)}`;
    const save = (suffix, bytes) => { const f = `images/${stem}-${suffix}.png`; writeFileSync(join(OUT_DIR, f), bytes); return f; };
    try {
      const before = row.status === 'added' ? null : git('show', `${parent}:${path}`);
      const after = row.status === 'removed' ? null : git('show', `${c.sha}:${path}`);
      if (before) row.before = save('before', before);
      if (after) row.after = save('after', after);
      if (row.status === 'modified') {
        const { picture, ...score } = scorePair(PNG.sync.read(before), PNG.sync.read(after));
        row.diff = save('diff', PNG.sync.write(picture));
        Object.assign(row, score, { grade: grade(score, LARGE_SSIM, MEDIUM_SSIM) });
      } else row.grade = row.status === 'added' ? 'new' : 'removed';
    } catch (e) { row.error = e.message.split('\n')[0]; row.grade = 'large'; }
    rows.push(row);
  }
}

// --- the sheet -------------------------------------------------------------
const img = (f) => (f ? `<a href="${f}"><img src="${f}" loading="lazy" width="160"></a>` : '');
const f3 = (x) => x.toFixed(3);
const pct = (x, d) => `${(100 * x).toFixed(d)}%`;
const name = (r) => r.path.slice(GOLDEN_DIR.length);
const ssimCell = (r) => (r.status === 'modified' && !r.error ? f3(r.ssim) : r.error ? 'unreadable' : r.status);
const fracs = (r) => [r.diffFrac === undefined ? '' : pct(r.diffFrac, 1), r.bboxUnionFrac === undefined ? '' : pct(r.bboxUnionFrac, 0)];

const body = rows.map((r) => { const [px, bb] = fracs(r);
  return `<tr class="${r.grade}"><td><code>${r.commit}</code><br>${esc(r.date)}</td>`
  + `<td>${r.pr ? `#${r.pr} ` : ''}${esc(r.title)}</td><td>${esc(name(r))}</td>`
  + `<td>${esc(ssimCell(r))}</td><td>${px}</td><td>${bb}</td>`
  + `<td class="g"><b>${r.grade}</b>${r.sizeChanged ? '<br>size changed' : ''}</td>`
  + `<td>${img(r.before)}</td><td>${img(r.after)}</td><td>${img(r.diff)}</td></tr>`; }).join('\n');
writeFileSync(join(OUT_DIR, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Goldens history</title>
<style>body{font:14px system-ui;margin:1rem}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px;vertical-align:top}
tr.large td.g{background:#f8c9c0}tr.medium td.g{background:#fbe8b0}tr.noise td.g{background:#d6efd2}img{display:block}</style>
<h1>Goldens history: last ${commits.length} commit(s) touching <code>${esc(GOLDEN_DIR)}</code></h1>
<p>Oldest first. Each golden against its parent commit's version, scored by the shared golden-diff engine
(large = SSIM &lt; ${LARGE_SSIM} or a size change; medium = SSIM &lt; ${MEDIUM_SSIM}; else noise).</p>
<table><tr><th>commit</th><th>PR / title</th><th>golden</th><th>SSIM</th><th>pixels</th><th>box union</th><th>grade</th><th>before</th><th>after</th><th>diff</th></tr>
${body}
</table>`);

const md = ['| commit | PR | golden | SSIM | pixels | box union | grade |', '|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.commit} | ${r.pr ? `#${r.pr}` : ''} | ${name(r).replace(/\.png$/i, '')} | ${ssimCell(r)} | ${fracs(r).join(' | ')} | ${r.grade} |`)].join('\n');
writeFileSync(join(OUT_DIR, 'history.md'), md + '\n');
writeFileSync(join(OUT_DIR, 'history.json'), JSON.stringify({ n: N, goldenDir: GOLDEN_DIR, commits, rows }, null, 2));
process.stdout.write(md + '\n');
console.error(`goldens-history: ${rows.length} row(s) over ${commits.length} commit(s); sheet in ${OUT_DIR}/index.html`);
