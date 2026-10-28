// docs/decisions.md lines are plain statements: the date, the statement, the link. No deciding verb
// ("ruled", "ruling", "decided", "approved") on a line outside quotation marks. Quoted text is exempt,
// since a line may cite a verb from a source. Reads one file; runs in milliseconds.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const file = new URL('../docs/decisions.md', import.meta.url);
const verbs = /\b(?:rul(?:ed|ing)|decided|approved)\b/i;

// Drop text inside "straight" or “curly” quotes, and inline code.
const unquoted = (line) => line.replace(/"[^"]*"|“[^”]*”|`[^`]*`/g, '');

test('docs/decisions.md carries no deciding verb outside quotes', () => {
  const hits = readFileSync(file, 'utf8')
    .split('\n')
    .map((text, i) => ({ n: i + 1, text }))
    .filter(({ text }) => verbs.test(unquoted(text)));
  assert.deepEqual(hits.map(({ n, text }) => `line ${n}: ${text.trim()}`), []);
});
