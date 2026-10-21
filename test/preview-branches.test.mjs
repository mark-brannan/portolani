// Which holding branches the Pages site previews (.github/scripts/preview-branches.mjs), that
// pages.yml builds them apart from main and only for this repository's holding branches, and that
// place-previews.sh puts each under _site/preview/<slug>/ within the size budget, run against
// stand-in built sites, so no network and no real build:preview.
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

test('pages.yml takes a relayed run only from a push to a holding branch of this repository', () => {
  const pages = readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  const gate = `github.event.workflow_run.event == 'push' && github.event.workflow_run.head_repository.full_name == github.repository && startsWith(github.event.workflow_run.head_branch, '${PREFIX}')`;
  for (const job of ['list', 'build']) assert.ok(jobOf(pages, job).replace(/\s+/g, ' ').includes(gate), `${job} is gated`);
});

test("a holding branch's build runs in a job with no token, no secrets and no cache", () => {
  const job = jobOf(readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8'), 'preview');
  assert.match(job, /^ {4}permissions: \{\}$/m);
  assert.doesNotMatch(job.replace(/^\s*#.*$/gm, ''), /secrets\.|github\.token|GH_TOKEN|actions\/cache|actions\/checkout/);
});

// One job of a workflow, from its key to the next job's, its comments included.
function jobOf(workflow, name) {
  const jobs = workflow.slice(workflow.indexOf('\njobs:\n'));
  const start = jobs.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, `no job ${name}`);
  const next = jobs.slice(start + 1).search(/\n {2}[a-z][\w-]*:\n/);
  return next === -1 ? jobs.slice(start) : jobs.slice(start, start + 1 + next);
}

test('place-previews.sh puts each built preview under _site/preview/<slug>/, drops PREVIEW_DROP, keeps to the budget', () => {
  const script = fileURLToPath(new URL('../.github/scripts/place-previews.sh', import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), 'place-previews-'));
  const site = join(dir, 'main'), from = join(dir, 'previews');
  mkdirSync(join(site, '_site'), { recursive: true });
  writeFileSync(join(site, '_site', 'index.html'), 'main');
  // A built preview as its artifact downloads: its page, a 2000-byte fine band, and for "three",
  // the one that breaks the budget, 100 kB of data. "two" did not build, so it has none.
  const built = (slug, extra = 0) => {
    mkdirSync(join(from, `preview-${slug}`, 'geo', 'f'), { recursive: true });
    writeFileSync(join(from, `preview-${slug}`, 'index.html'), slug);
    writeFileSync(join(from, `preview-${slug}`, 'geo', 'f', 'cell.json'), Buffer.alloc(2000));
    if (extra) writeFileSync(join(from, `preview-${slug}`, 'big'), Buffer.alloc(extra));
  };
  built('one'); built('three', 100000); built('four');
  const sha = (c) => c.repeat(40);
  const out = execFileSync('bash', [script], {
    cwd: site,
    input: [['one', 'hold/one', sha('1')], ['two', 'hold/two', sha('2')], ['three', 'hold/three', sha('3')], ['four', 'hold/four', sha('4')]]
      .map((r) => r.join('\t')).join('\n') + '\n',
    env: { ...process.env, PREVIEW_DIR: from, PREVIEW_DROP: 'geo/f', PREVIEW_BUDGET_BYTES: '60000', GITHUB_STEP_SUMMARY: join(dir, 'summary.md'), PREVIEW_SITE_URL: 'https://x.example/' },
    encoding: 'utf8',
  });
  assert.equal(readFileSync(join(site, '_site/preview/one/index.html'), 'utf8'), 'one');
  assert.equal(existsSync(join(site, '_site/preview/one/geo/f')), false, 'PREVIEW_DROP is gone from a preview');
  assert.equal(existsSync(join(site, '_site/preview/two')), false, 'did not build');
  assert.match(out, /::warning::the preview of hold\/two at 2222222 did not build/);
  assert.equal(existsSync(join(site, '_site/preview/three')), false, 'over the budget');
  assert.equal(existsSync(join(site, '_site/preview/four')), false, 'older than one over the budget');
  assert.equal(readFileSync(join(site, '_site/index.html'), 'utf8'), 'main');
  assert.match(out, /::warning::the preview of hold\/three would take the site past 60000 bytes/);
  assert.match(readFileSync(join(dir, 'summary.md'), 'utf8'), /- \[hold\/one\]\(https:\/\/x\.example\/preview\/one\/\)/);
  rmSync(dir, { recursive: true, force: true });
});
