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
