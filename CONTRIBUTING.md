# Contributing

Thanks for looking. portolani is becoming an antique-chart base map; the plan is in [#26](https://github.com/mark-brannan/portolani/issues/26).

## Setting up

```shell
git clone https://github.com/mark-brannan/portolani.git
cd portolani
npm ci
npm test
```

Node 20 or newer. `npm test` runs with the network unavailable. `npm run build:preview` and `npm run render` fetch the pinned sources once.

## Before you open a pull request

- **Same inputs, same pixels.** The renderer is deterministic: `npm run render` must reproduce `docs/mockup/*.png` byte for byte unless the change is meant to move them, and then the pull request says so.
- **Every ornament source is recorded.** A new sprite adds its URL, crop box, licence and sha256 to [ASSETS.md](ASSETS.md), and names its `style` (the design family it belongs to) in its pack's `pack.json`. Public domain or an open licence only.
- Tests assert values, never printed layout, and never need the network.
- **Golden images.** `test/golden.test.mjs` compares three views with `test/golden/*.png`; after a change that is meant to move the pixels, run `npm run golden` and commit the new PNGs (the test font in `test/fixtures/` is a copy of the one in ASSETS.md). `region-z5` is also the README's picture, so it is drawn with the custom title PORTOLANI.
- **Timings.** Draw times and fetched bytes: [docs/measurements.md](docs/measurements.md); re-measure with `scripts/measure-preview.mjs`.
- Branch from latest `main`. One logical change per pull request.
- Commits are conventional: `<type>(<scope>): <subject>`, imperative, 50 characters or fewer.

## Bugs

Open an [issue](https://github.com/mark-brannan/portolani/issues/new/choose) with the view you were looking at (zoom, place, settings) and a screenshot. Security problems go through [SECURITY.md](SECURITY.md), privately.

## Code of Conduct

Participation is governed by the [Code of Conduct](https://github.com/mark-brannan/.github/blob/main/CODE_OF_CONDUCT.md), the org-wide default.

## Licence

Contributions are licensed under the [MIT licence](LICENSE) that covers the code. Natural Earth is public domain and credited in ASSETS.md; keep that credit.
