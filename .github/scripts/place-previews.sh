#!/usr/bin/env bash
# place-previews: copy each holding branch's built site, already downloaded under
# PREVIEW_DIR/preview-<slug>/, to _site/preview/<slug>/ beside main's, so the one Pages deployment
# serves main and every preview. It runs none of a branch's code: pages.yml builds each preview in
# a job of its own, with no token, and this only places the files. Reads the previews from stdin
# (slug<TAB>branch<TAB>sha, freshest first, as preview-branches.mjs prints them). Run from main's
# checkout once main's own build has filled _site/.
#
# GitHub Pages publishes a site of at most 1 GB, and main's site alone is most of that, so a preview
# ships without the directories named in PREVIEW_DROP (the finest coastline band, which the page
# skips when its index is missing, drawing the next band instead), and a preview that would take
# the whole site past PREVIEW_BUDGET_BYTES is left out with every older one. A preview that did not
# build is left out with a warning; main's site is never touched.
#
#   PREVIEW_DIR           where the preview artifacts were downloaded, one preview-<slug>/ each
#   PREVIEW_DROP          site-relative directories a preview ships without (space-separated)
#   PREVIEW_BUDGET_BYTES  the whole site's ceiling (default 950000000, under the 1 GB limit)
#   PREVIEW_SITE_URL      the site's root URL, for the links in the job summary
set -euo pipefail

from=${PREVIEW_DIR:?the directory the preview artifacts were downloaded to}
budget=${PREVIEW_BUDGET_BYTES:-950000000}
drop=${PREVIEW_DROP:-}
site=${PREVIEW_SITE_URL:-}
summary=${GITHUB_STEP_SUMMARY:-/dev/null}

[ -d _site ] || { echo "place-previews: no _site/ here; build main first" >&2; exit 2; }
bytes() { du -sb "$1" | cut -f1; }

echo "### Previews" >> "$summary"
while IFS=$'\t' read -r slug branch sha; do
  [ -n "$sha" ] || continue
  # preview-branches.mjs makes slugs safe as one path segment; hold that here too.
  [[ $slug =~ ^[a-z0-9][a-z0-9._-]*$ ]] || { echo "::warning::$branch has no usable slug ($slug), so the site goes without its preview"; continue; }
  dir="$from/preview-$slug"
  if [ ! -d "$dir" ]; then
    echo "::warning::the preview of $branch at ${sha:0:7} did not build, so the site goes without it"
    continue
  fi
  for d in $drop; do rm -rf "${dir:?}/$d"; done
  if [ $(( $(bytes _site) + $(bytes "$dir") )) -gt "$budget" ]; then
    echo "::warning::the preview of $branch would take the site past $budget bytes, so it and any older holding branch are left out"
    break
  fi
  mkdir -p _site/preview
  mv "$dir" "_site/preview/$slug"
  echo "- [$branch](${site}preview/$slug/) at \`${sha:0:7}\`" >> "$summary"
  echo "place-previews: $branch at ${sha:0:7} -> _site/preview/$slug/"
done
