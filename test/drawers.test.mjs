// One mode (#211): dark margins round the map, parchment inside every drawer, whatever the browser's
// light/dark setting. The page follows no `prefers-color-scheme`, and this fast, offline check keeps it so:
// the string appears nowhere in public/. The drawers themselves are specified in docs/spec/drawer.md.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const pub = fileURLToPath(new URL('../public/', import.meta.url));

test('no prefers-color-scheme rule anywhere in public/', () => {
  for (const f of readdirSync(pub, { recursive: true })) {
    const p = path.join(pub, f);
    if (!/\.(html|css|m?js)$/.test(p)) continue;
    assert.doesNotMatch(readFileSync(p, 'utf8'), /prefers-color-scheme/, `${f} follows the browser's light/dark setting`);
  }
});

// The skull clears the map while a drawer is in use (docs/spec/drawer.md, 'The skull stays in reach while a drawer is
// in use'): it sits over the drawers, an open drawer stops above it, and the faint skull wipe replaces the broom.
test('the skull sits over the drawers, and the broom is gone', () => {
  const html = readFileSync(path.join(pub, 'index.html'), 'utf8'), js = readFileSync(path.join(pub, 'page.js'), 'utf8');
  const z = (sel) => Number(html.match(new RegExp(`\\n  ${sel} \\{[^}]*z-index: (\\d+)`))?.[1]);
  assert.ok(z('#memento') > z('\\.drawer'), 'the skull is drawn over the drawers');
  assert.match(html, /\.drawer \{[^}]*max-height: calc\(100dvh[^;}]*var\(--memento-h\)/, 'an open drawer stops above the skull');
  assert.doesNotMatch(html + js, /broom/i, 'the broom is retired');
  assert.match(html, /<div id="wipe"/, 'the wipe is there');
});

// The skull is the one clear (docs/spec/design.md, 'The skull is the one clear'): it lifts the voyages and the charts as
// well as the table, leaves the view alone, and the Voyages drawer has no Clear of its own.
test('the skull is the one clear, and the voyages have no Clear of their own', () => {
  const js = readFileSync(path.join(pub, 'page.js'), 'utf8');
  const body = js.match(/\nfunction clearMap\(\) \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.match(js, /\$\('sweep'\)\.addEventListener\('click', \(\) => \{\s*clearMap\(\);/, 'the skull runs clearMap');
  assert.match(body, /clearTable\(\)/, 'it clears the table');
  assert.match(body, /voyages: \[\]/, 'it takes every voyage off');
  assert.match(body, /overlays: \[\], sheets: \{\}/, 'it lifts every sheet, back to its own place');
  assert.doesNotMatch(body, /\bview\b|turnWorld|goTo|projection/, 'it leaves the view and the projection alone');
  assert.doesNotMatch(js, /groupTools\('Voyages'/, 'the Voyages drawer has no Clear');
});
