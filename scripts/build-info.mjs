// The commit a site is served from, for the page's bottom-right corner (page.js): build-preview.mjs
// writes it as build.json with the build's time, the dev server answers it live without one.
// Null where there is no git history to read.
import { spawnSync } from 'node:child_process';

export function buildInfo(root) {
  const git = spawnSync('git', ['log', '-1', '--format=%H%n%cI%n%s'], { cwd: root, encoding: 'utf8' });
  if (git.status !== 0 || !git.stdout.trim()) return null;
  const [sha, committed, subject] = git.stdout.trim().split('\n');
  return { sha, committed, subject };
}
