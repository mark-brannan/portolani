#!/usr/bin/env bash
# build-previews: build each holding branch read from stdin (slug<TAB>branch<TAB>sha, freshest
# first, as preview-branches.mjs prints them) with that branch's own build, and move its site to
# _site/preview/<slug>/ beside main's, so the one Pages deployment serves main and every preview.
# Run from main's checkout once main's own build has filled _site/.
#
# GitHub Pages publishes a site of at most 1 GB, and main's site alone is most of that, so a preview
# ships without the directories named in PREVIEW_DROP (the finest coastline band, which the page
# skips when its index is missing, drawing the next band instead), and a preview that would take
# the whole site past PREVIEW_BUDGET_BYTES is left out with every older one. A branch that fails
# to build is left out with a warning; main's site is never touched.
#
#   PREVIEW_DROP          site-relative directories a preview ships without (space-separated)
#   PREVIEW_BUDGET_BYTES  the whole site's ceiling (default 950000000, under the 1 GB limit)
#   PREVIEW_BUILD         the build, run in the branch's worktree (default: npm ci && npm run build:preview)
#   PREVIEW_SITE_URL      the site's root URL, for the links in the job summary
set -euo pipefail

budget=${PREVIEW_BUDGET_BYTES:-950000000}
build=${PREVIEW_BUILD:-npm ci && npm run build:preview}
drop=${PREVIEW_DROP:-}
site=${PREVIEW_SITE_URL:-}
work=${RUNNER_TEMP:-$(mktemp -d)}
summary=${GITHUB_STEP_SUMMARY:-/dev/null}

[ -d _site ] || { echo "build-previews: no _site/ here; build main first" >&2; exit 2; }
bytes() { du -sb "$1" | cut -f1; }

echo "### Previews" >> "$summary"
while IFS=$'\t' read -r slug branch sha; do
  [ -n "$sha" ] || continue
  dir="$work/preview-$slug"
  if ! { git fetch --quiet --no-tags --depth=1 origin "$sha" && git worktree add --quiet --detach "$dir" "$sha"; } < /dev/null; then
    echo "::warning::$branch at ${sha:0:7} could not be fetched, so the site goes without its preview"
    continue
  fi
  # The pinned downloads main's build already fetched and checked; the branch's build adds any it pins anew.
  if [ -d downloads ]; then ln -s "$PWD/downloads" "$dir/downloads"; fi
  if ! (cd "$dir" && sh -c "$build") < /dev/null; then
    echo "::warning::the preview of $branch at ${sha:0:7} did not build, so the site goes without it"
    continue
  fi
  for d in $drop; do rm -rf "${dir:?}/_site/$d"; done
  if [ $(( $(bytes _site) + $(bytes "$dir/_site") )) -gt "$budget" ]; then
    echo "::warning::the preview of $branch would take the site past $budget bytes, so it and any older holding branch are left out"
    break
  fi
  mkdir -p _site/preview
  mv "$dir/_site" "_site/preview/$slug"
  echo "- [$branch](${site}preview/$slug/) at \`${sha:0:7}\`" >> "$summary"
  echo "build-previews: $branch at ${sha:0:7} -> _site/preview/$slug/"
done
