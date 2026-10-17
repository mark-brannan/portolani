// The Try it block is printed from .github/show-dont-tell.yml, the file the shared check reads, so
// the two cannot drift; this parses the real file, comments and all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseConfig, tryItBlock } from '../scripts/try-it.mjs';

test('the real show-dont-tell.yml yields a block that fetches and serves the PR', () => {
  const cfg = parseConfig(readFileSync(new URL('../.github/show-dont-tell.yml', import.meta.url), 'utf8'));
  assert.deepEqual(cfg, { checkout: '~/portolani', install: 'npm ci', serve: 'npm run dev -- --port {port}' });
  const block = tryItBlock({ pr: 198, head: '5a1630ae213cb0c20f44227aed9e7b47e49fe044', ...cfg });
  assert.match(block, /^## Try it\n/);
  assert.match(block, /fetch origin \+pull\/198\/head:refs\/pr\/198/);
  assert.match(block, /npm ci && npm run dev -- --port 10198/);
  assert.match(block, /head 5a1630a when this was written/);
  assert.match(block, /http:\/\/localhost:10198/);
});
