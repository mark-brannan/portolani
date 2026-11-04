// The Try it block is printed from .github/show-dont-tell.yml, the file the shared check reads; this
// parses the real file, comments and all. LINE is the user's known-good paste for #369, the line the
// check and the chat gate (demo-line-gate) both ask for.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseConfig, tryItBlock, tryItLine } from '../scripts/try-it.mjs';

const LINE = 'git -C ~/portolani fetch origin +pull/369/head:refs/pr/369 && { [ -d ~/portolani/.claude/worktrees/pr-369 ] || git -C ~/portolani worktree add --detach ~/portolani/.claude/worktrees/pr-369 refs/pr/369; } && git -C ~/portolani/.claude/worktrees/pr-369 checkout -q --detach refs/pr/369 && cd ~/portolani/.claude/worktrees/pr-369 && npm ci && npm run dev -- --port 10369';

test('the real show-dont-tell.yml yields the one exact line, in a bash fence', () => {
  const cfg = parseConfig(readFileSync(new URL('../.github/show-dont-tell.yml', import.meta.url), 'utf8'));
  assert.deepEqual(cfg, { checkout: '~/portolani', install: 'npm ci', serve: 'npm run dev -- --port {port}' });
  assert.equal(tryItLine({ pr: 369, ...cfg }), LINE);
  const block = tryItBlock({ pr: 369, head: '5a1630ae213cb0c20f44227aed9e7b47e49fe044', ...cfg });
  assert.ok(block.startsWith(`## Try it\n\n\`\`\`bash\n${LINE}\n\`\`\`\n`));
  assert.match(block, /head 5a1630a when this was written/);
  assert.match(block, /http:\/\/localhost:10369/);
  assert.doesNotMatch(tryItBlock({ pr: 369, head: '', ...cfg }), /\(head\s+when/);
});
