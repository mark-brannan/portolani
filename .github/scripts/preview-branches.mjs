#!/usr/bin/env node
// preview-branches: the holding branches the Pages site carries a preview of, one per line as
// slug<TAB>branch<TAB>sha, freshest commit first, for build-previews.sh to build into
// _site/preview/<slug>/.
//
//   GH_TOKEN=... node .github/scripts/preview-branches.mjs [owner/repo]
//
// A holding branch is one named hold/<name>; preview-relay.yml's push filter names the same
// prefix. A branch whose head is the head of a pull request already merged into main is left out,
// which is what tears its preview down: the merge pushes main, main's deploy rebuilds the site, and
// the merged branch is no longer listed. A later push to the branch brings its preview back.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const PREFIX = 'hold/';

// The path segment a branch is served under: its name past the prefix, lower-cased, anything but
// letters, digits, dot, dash and underscore run together into one dash.
export const slugOf = (branch, prefix = PREFIX) =>
  branch.slice(prefix.length).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[-.]+|[-.]+$/g, '');

// branches: [{ name, sha, date (ISO 8601), mergedHeads: [sha of each merged PR from it] }].
// Returns [{ slug, branch, sha }], freshest first, so a site over its size budget drops the stalest.
// Two branches that slug alike, or a name that slugs to nothing, take the short sha as well.
export function selectPreviews(branches, prefix = PREFIX) {
  const live = branches
    .filter((b) => b.name.startsWith(prefix) && !b.mergedHeads.includes(b.sha))
    .toSorted((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  const taken = new Set();
  return live.map((b) => {
    let slug = slugOf(b.name, prefix);
    if (!slug || taken.has(slug)) slug = [slug, b.sha.slice(0, 7)].filter(Boolean).join('-');
    taken.add(slug);
    return { slug, branch: b.name, sha: b.sha };
  });
}

const gh = (...args) => JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' }) || 'null');

function main() {
  const repo = process.argv[2] || process.env.GITHUB_REPOSITORY;
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo || '')) { console.error('usage: preview-branches.mjs <owner/repo> (or GITHUB_REPOSITORY)'); return 2; }
  const owner = repo.split('/')[0];
  const refs = gh('--paginate', '--slurp', `repos/${repo}/git/matching-refs/heads/${PREFIX}`).flat();
  const branches = refs.map(({ ref, object: { sha } }) => {
    const name = ref.replace(/^refs\/heads\//, '');
    const head = encodeURIComponent(`${owner}:${name}`);
    const pulls = gh(`repos/${repo}/pulls?state=closed&base=main&head=${head}&per_page=100`);
    const mergedHeads = pulls.filter((p) => p.merged_at).map((p) => p.head.sha);
    const date = gh(`repos/${repo}/commits/${sha}`).commit.committer.date;
    return { name, sha, date, mergedHeads };
  });
  for (const p of selectPreviews(branches)) console.log([p.slug, p.branch, p.sha].join('\t'));
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
