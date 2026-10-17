#!/usr/bin/env node
// try-it: print the "Try it" block a PR body carries, so a reviewer serves this
// PR's head from its own worktree with one paste and no edits.
//
//   node scripts/try-it.mjs <pr-number>     (or: npm run try-it -- <pr-number>)
//
// Reads checkout:, install: and serve: from .github/show-dont-tell.yml (the
// same file the shared show-dont-tell check reads), so the block here and the
// one the check expects never drift. Port is 10000 + PR number. The fetch
// lands on refs/pr/<N>, not a branch, so a second paste never trips
// "refusing to fetch into checked-out branch"; the worktree is detached and
// moved with checkout --detach. The head SHA is informational (gh, if present).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function parseConfig(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, '').trimEnd();
    const m = /^(checkout|install|serve):\s*(.+)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, '$2');
  }
  return out;
}

export function tryItBlock({ pr, head, checkout, install, serve }) {
  const port = 10000 + Number(pr);
  const wt = `${checkout}/.claude/worktrees/pr-${pr}`;
  const run = [install, serve.replace(/\{port\}/g, String(port))].filter(Boolean).join(' && ');
  const cmd = [
    `git -C ${checkout} fetch origin +pull/${pr}/head:refs/pr/${pr}`,
    `{ [ -d ${wt} ] || git -C ${checkout} worktree add --detach ${wt} refs/pr/${pr}; }`,
    `git -C ${wt} checkout -q --detach refs/pr/${pr}`,
    `cd ${wt}`,
    run,
  ];
  const code = cmd.map((l, i) => (i ? `      && ${l}` : `    ${l}`)).join(' \\\n');
  const at = head ? ` (head ${head.slice(0, 7)} when this was written)` : '';
  return `## Try it

${code}

Serves PR #${pr}${at} on http://localhost:${port} from its own worktree. Paste again after a push to the PR: it fetches and moves the worktree. Remove: \`git -C ${checkout} worktree remove --force ${wt}\`
`;
}

function main() {
  const pr = process.argv[2];
  if (!/^\d+$/.test(pr || '')) { console.error('usage: node scripts/try-it.mjs <pr-number>'); return 2; }
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const cfg = parseConfig(readFileSync(join(root, '.github/show-dont-tell.yml'), 'utf8'));
  if (!cfg.serve || !cfg.checkout) { console.error('.github/show-dont-tell.yml needs checkout: and serve:'); return 2; }
  let head = '';
  try { head = execFileSync('gh', ['pr', 'view', pr, '--json', 'headRefOid', '-q', '.headRefOid'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { /* no gh or no PR: the block still works */ }
  process.stdout.write(tryItBlock({ pr, head, ...cfg }));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
