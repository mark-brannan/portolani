#!/usr/bin/env node
// Builds docs/learn/*.md into <site>/learn/*.html: the Learn pages the drawer links to. The markdown
// is the small subset those pages use (headings, paragraphs, lists, tables, > quotes, links, *emphasis*,
// **strong**, `code`), so no dependency is needed. Run alone (`node scripts/learn.mjs`) it writes _site/learn/.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A link keeps only http(s) and relative targets; a relative .md target becomes the built .html.
const href = (u) => (/^(https?:\/\/|[\w./#-]+$)/.test(u) ? u.replace(/^((?!https?:)[^#]*)\.md(#.*)?$/, '$1.html$2') : '#');

export const inline = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  .replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_, t, u) => `<a href="${esc(href(u.replace(/&amp;/g, '&')))}">${t}</a>`);

// markdown -> { title, html }; the first `# ` line is the title.
export function render(md) {
  let title = '', out = [];
  for (const block of md.trim().split(/\n\s*\n/)) {
    const lines = block.split('\n');
    if (/^# /.test(block)) { title ||= block.slice(2).trim(); continue; }
    if (/^## /.test(block)) out.push(`<h2>${inline(block.slice(3).trim())}</h2>`);
    else if (lines.every((l) => /^- /.test(l))) out.push(`<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`);
    else if (lines.every((l) => /^\d+\. /.test(l))) out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\. /, ''))}</li>`).join('')}</ol>`);
    else if (lines.length > 2 && lines.every((l) => /^\|.*\|$/.test(l)) && /^\|[\s:|-]+\|$/.test(lines[1])) {
      const cells = (l) => l.slice(1, -1).split('|').map((c) => inline(c.trim()));
      const row = (l, t) => `<tr>${cells(l).map((c) => `<${t}>${c}</${t}>`).join('')}</tr>`;
      out.push(`<table><thead>${row(lines[0], 'th')}</thead><tbody>${lines.slice(2).map((l) => row(l, 'td')).join('')}</tbody></table>`);
    }
    else if (lines.every((l) => /^>/.test(l))) out.push(`<blockquote>${inline(lines.map((l) => l.replace(/^> ?/, '')).join(' '))}</blockquote>`);
    else out.push(`<p>${inline(lines.join(' '))}</p>`);
  }
  return { title, html: out.join('\n') };
}

const page = ({ title, html }, index) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} - Portolani</title>
<style>
  body { margin: 0; background: #efe3c8; color: #2b2118; font: 18px/1.55 Georgia, 'Times New Roman', serif; }
  main { max-width: 38rem; margin: 0 auto; padding: 1.5rem 16px 4rem; }
  nav { font-size: 0.9rem; margin-bottom: 1.5rem; }
  a { color: #6b2d1a; }
  h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 1rem; }
  h2 { font-size: 1.2rem; margin: 2rem 0 0.5rem; }
  h2:last-of-type { border-top: 1px solid #b9a27a; padding-top: 1rem; }
  code { font-size: 0.9em; }
  table { border-collapse: collapse; font-size: 0.85rem; line-height: 1.4; margin: 1rem 0; display: block; overflow-x: auto; }
  th, td { border-bottom: 1px solid #b9a27a; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
  blockquote { margin: 1rem 0; padding-left: 1rem; border-left: 3px solid #b9a27a; font-style: italic; }
</style></head><body><main>
<nav>${index ? '' : '<a href="index.html">Learn</a> &middot; '}<a href="../">Back to the map</a></nav>
<h1>${esc(title)}</h1>
${html}
</main></body></html>
`;

// Writes every docs/learn/*.md as <out>/learn/<name>.html; returns the names written.
export async function buildLearn(root, out) {
  const src = path.join(root, 'docs', 'learn'), dest = path.join(out, 'learn');
  await mkdir(dest, { recursive: true });
  const names = (await readdir(src)).filter((f) => f.endsWith('.md')).sort();
  for (const f of names) {
    const r = render(await readFile(path.join(src, f), 'utf8'));
    if (!r.title) throw new Error(`${f}: no "# Title" line`);
    await writeFile(path.join(dest, f.replace(/\.md$/, '.html')), page(r, f === 'index.md'));
  }
  return names;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  console.log(`learn: ${(await buildLearn(root, path.join(root, '_site'))).length} pages into _site/learn/`);
}
