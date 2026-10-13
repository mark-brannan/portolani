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

## Checks

- [ ] `npm test` passes, with the network unavailable
- [ ] Any new sprite or source is recorded in ASSETS.md with URL, licence and sha256
- [ ] Branched from latest `main` (rebased, not merged)
- [ ] One logical change
