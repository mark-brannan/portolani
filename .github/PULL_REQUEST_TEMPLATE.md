## What and why

<!--
Motivation and approach, not mechanics; the diff shows what changed. If this
closes an issue, say so here: closes #12
-->

## Does this move the rendered pixels?

<!--
`npm run render` must reproduce docs/mockup/*.png byte for byte. If it does not,
say why and attach the new image. Write "no" if the output is identical.
-->

## Try it

<!--
Paste the block `node scripts/try-it.mjs <this PR's number>` prints, as it
stands: one line that fetches, installs and serves this PR on port 10000 + N.
No clone of the tooling? Open the PR with this section empty: the check's red
summary prints the block; copy it from there and the check re-runs.
-->

## Checks

- [ ] `npm test` passes, with the network unavailable
- [ ] Any new sprite or source is recorded in ASSETS.md with URL, licence and sha256
- [ ] Branched from latest `main` (rebased, not merged)
- [ ] One logical change
