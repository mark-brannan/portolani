import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildLearn, render } from '../scripts/learn.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('the markdown subset renders, and escapes what it must', () => {
  const r = render('# T <x>\n\nA *b* **c** `d` [e](other.md#f) [g](javascript:alert(1)) <i>\n\n- one\n- two\n\n## H\n\n1. a\n2. b');
  assert.equal(r.title, 'T <x>');
  assert.match(r.html, /<em>b<\/em> <strong>c<\/strong> <code>d<\/code> <a href="other.html#f">e<\/a>/);
  assert.match(r.html, /<a href="#">g<\/a>/); // a script link is not kept
  assert.match(r.html, /&lt;i&gt;/);
  assert.match(render('[C](https://en.wikipedia.org/wiki/Cartouche_(design)) after').html, /<a href="https:\/\/en\.wikipedia\.org\/wiki\/Cartouche_\(design\)">C<\/a> after/); // a parenthesis in a URL stays in it
  assert.match(r.html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(r.html, /<h2>H<\/h2>\n<ol>/);
  const t = render('| A | *B* |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n\n> said *he*\n> once').html;
  assert.match(t, /<table><thead><tr><th>A<\/th><th><em>B<\/em><\/th><\/tr><\/thead><tbody><tr><td>1<\/td><td>2<\/td><\/tr><tr><td>3<\/td><td>4<\/td><\/tr><\/tbody><\/table>/);
  assert.match(t, /<blockquote>said <em>he<\/em> once<\/blockquote>/);
});

test('every page the drawer links to is built, each with a Sources section of fetched links', async () => {
  const out = await mkdtemp(path.join(tmpdir(), 'learn-'));
  await buildLearn(root, out);
  const built = await readdir(path.join(out, 'learn'));
  for (const slug of ['index', 'portolan-charts', 'charts-and-makers', 'rhumb-lines', 'scale-ladder', 'sea-monsters-and-ships', 'projections', 'mali-and-mansa-musa', 'trans-saharan-trade', 'royal-pilgrims', 'mali-on-the-charts', 'mali-in-memory']) {
    assert.ok(built.includes(`${slug}.html`), slug);
    if (slug === 'index') continue;
    const html = await readFile(path.join(out, 'learn', `${slug}.html`), 'utf8');
    assert.match(html, /<h2>Sources<\/h2>\s*<ul>(<li><a href="https:\/\/[^"]+">[^<]+<\/a>[^<]*<\/li>)+<\/ul>/, `${slug} cites its sources last`);
  }
  const idx = await readFile(path.join(out, 'learn', 'index.html'), 'utf8');
  for (const slug of built) if (slug !== 'index.html') assert.ok(idx.includes(`href="${slug}"`), `index links ${slug}`);
});
