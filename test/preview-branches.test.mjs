// Which holding branches the Pages site previews (.github/scripts/preview-branches.mjs), and that
// build-previews.sh puts each under _site/preview/<slug>/ within the size budget, run against a
// throwaway repository with a stand-in build, so no network and no real build:preview.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREFIX, selectPreviews, slugOf } from '../.github/scripts/preview-branches.mjs';

const branch = (name, sha, date, mergedHeads = []) => ({ name, sha, date, mergedHeads });

test('the prefix is the one preview-relay.yml pushes on', () => {
  const relay = readFileSync(new URL('../.github/workflows/preview-relay.yml', import.meta.url), 'utf8');
  assert.match(relay, new RegExp(`branches: \\['${PREFIX}\\*\\*'\\]`));
});

test('a slug is the name past the prefix, safe as one path segment', () => {
  assert.equal(slugOf('hold/voyages'), 'voyages');
  assert.equal(slugOf('hold/Sea Monsters/v2'), 'sea-monsters-v2');
  assert.equal(slugOf('hold/..'), '');
});

test('previews are the unmerged holding branches, freshest first', () => {
  const got = selectPreviews([
    branch('hold/old', 'a'.repeat(40), '2026-10-01T00:00:00Z'),
    branch('main', 'b'.repeat(40), '2026-10-20T00:00:00Z'),
    branch('hold/new', 'c'.repeat(40), '2026-10-19T00:00:00Z'),
    branch('feature/hold', 'd'.repeat(40), '2026-10-19T00:00:00Z'),
  ]);
  assert.deepEqual(got.map((p) => p.branch), ['hold/new', 'hold/old']);
  assert.deepEqual(got[0], { slug: 'new', branch: 'hold/new', sha: 'c'.repeat(40) });
});

test('a branch merged at its head is torn down; a push after the merge brings it back', () => {
  const merged = 'e'.repeat(40), later = 'f'.repeat(40);
  assert.deepEqual(selectPreviews([branch('hold/x', merged, '2026-10-20T00:00:00Z', [merged])]), []);
  assert.deepEqual(selectPreviews([branch('hold/x', later, '2026-10-21T00:00:00Z', [merged])]).map((p) => p.slug), ['x']);
});

test('slugs that collide, or come out empty, take the short sha', () => {
  const got = selectPreviews([
    branch('hold/A', '1111111aaaa', '2026-10-20T00:00:00Z'),
    branch('hold/a', '2222222bbbb', '2026-10-19T00:00:00Z'),
    branch('hold/--', '3333333cccc', '2026-10-18T00:00:00Z'),
  ]);
  assert.deepEqual(got.map((p) => p.slug), ['a', 'a-2222222', '3333333']);
});

test('build-previews.sh builds each branch into _site/preview/<slug>/, drops PREVIEW_DROP, keeps to the budget', () => {
  const script = fileURLToPath(new URL('../.github/scripts/build-previews.sh', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'build-previews-'));
  const repo = join(dir, 'repo'), git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  mkdirSync(repo);
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  git('config', 'uploadpack.allowAnySHA1InWant', 'true');
  git('remote', 'add', 'origin', repo);
  const commit = (label) => {
    writeFileSync(join(repo, 'label'), label);
    git('add', 'label');
    git('commit', '-q', '-m', label);
    return git('rev-parse', 'HEAD');
  };
  const one = commit('one'), two = commit('two'), three = commit('three');
  mkdirSync(join(repo, '_site'));
  writeFileSync(join(repo, '_site', 'index.html'), 'main');
  // The stand-in build: the branch's label as its page, a 2000-byte fine band, and 100 kB of data
  // for "three", the one that breaks the budget.
  const build = 'mkdir -p _site/geo/f && cp label _site/index.html && head -c 2000 /dev/zero > _site/geo/f/cell.json'
    + ' && if grep -q three label; then head -c 100000 /dev/zero > _site/big; fi';
  const out = execFileSync('bash', [script], {
    cwd: repo,
    input: [['one', 'hold/one', one], ['two', 'hold/two', two], ['three', 'hold/three', three], ['four', 'hold/four', one]]
      .map((r) => r.join('\t')).join('\n') + '\n',
    env: { ...process.env, PREVIEW_BUILD: build, PREVIEW_DROP: 'geo/f', PREVIEW_BUDGET_BYTES: '60000', RUNNER_TEMP: dir, GITHUB_STEP_SUMMARY: join(dir, 'summary.md'), PREVIEW_SITE_URL: 'https://x.example/' },
    encoding: 'utf8',
  });
  assert.equal(readFileSync(join(repo, '_site/preview/one/index.html'), 'utf8'), 'one');
  assert.equal(readFileSync(join(repo, '_site/preview/two/index.html'), 'utf8'), 'two');
  assert.equal(existsSync(join(repo, '_site/preview/one/geo/f')), false, 'PREVIEW_DROP is gone from a preview');
  assert.equal(existsSync(join(repo, '_site/preview/three')), false, 'over the budget');
  assert.equal(existsSync(join(repo, '_site/preview/four')), false, 'older than one over the budget');
  assert.equal(readFileSync(join(repo, '_site/index.html'), 'utf8'), 'main');
  assert.match(out, /::warning::the preview of hold\/three would take the site past 60000 bytes/);
  assert.match(readFileSync(join(dir, 'summary.md'), 'utf8'), /- \[hold\/one\]\(https:\/\/x\.example\/preview\/one\/\)/);
  rmSync(dir, { recursive: true, force: true });
});
