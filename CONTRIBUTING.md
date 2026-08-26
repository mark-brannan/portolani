# Contributing

Thanks for looking. portolani generates **portolani** — simplified,
delta-encoded coastline and land geometry small enough to ship inside a web
page, with the provenance to reproduce them exactly.

It is a one-shot generator. You run it, you keep the output, and the output
outlives the run. That shape decides most of what follows.

## Where the documentation lives

- **[README.md](README.md)** — what it does and how to drive it, including the
  two knobs (`--tolerance`, `--precision`) that are easy to waste on each other.
- **[docs/portolano-format.md](docs/portolano-format.md)** — the output format,
  specified independently of this package so that a decoder in another language
  is nine lines rather than a dependency. **It is the contract**, and its
  [section 8](docs/portolano-format.md#8-changes) is the change policy. Read it
  before touching anything that lands in a file.

The sibling packages: [coastlines](https://github.com/mark-brannan/coastlines)
publishes ready-made output of this tool;
[coast-wright](https://github.com/mark-brannan/coast-wright) draws it. A bug in
drawing belongs there, not here.

## Reproducibility is the point

A private script means *trust me*. A published tool that stamps its knob values
and the source digest into every file it writes means anyone can re-run it and
diff. So:

- **The same inputs must produce the same bytes**, on any machine, on any
  supported Node. If a change makes output depend on platform floating point,
  key iteration order, locale, or the clock, that is a bug even if the geometry
  is prettier.
- **A change to emitted geometry is a change to somebody's shipped asset.** The
  file in their repository was generated once and is not regenerated on their
  behalf. Say so in the pull request.
- **Anything new that lands in a file has to fit the format spec**, or the spec
  changes first and the pull request quotes the clause. New optional members of
  `provenance` or `counts` are free; touching `geometry`, `encoding`, `kind`
  semantics or the digest definition takes a new `format` value.

## Reporting a bug

Open an [issue](https://github.com/mark-brannan/portolani/issues/new/choose)
using the bug form. The single most useful thing you can give is **the exact
command line** — with the source, the ref, and every knob — because the tool is
deterministic and that reproduces it outright.

Security problems go through [SECURITY.md](SECURITY.md) instead — privately, not
as an issue.

## Setting up

```shell
git clone https://github.com/mark-brannan/portolani.git
cd portolani
npm test
```

Node 20 or newer. **Zero runtime dependencies, by policy** — there is no
install step, and `npm test` runs on a fresh clone with the network
unavailable.

That last part is not incidental. `test/offline.test.mjs` replaces `fetch` and
asserts nothing reaches the network unless `--source` is a URL. The generator
of course fetches when you point it at one; the guarantee is that nothing else
does, so an offline test run is a real check rather than a check of the
sandbox's DNS.

## Before you open a pull request

```shell
npm test
```

Then:

- **Tests are required for new code**, and they assert values — point counts,
  bytes, coordinates, the digest — never printed layout.
- **Test against a fixture, never a live fetch.** `test/fixtures/` holds small
  GeoJSON inputs for exactly this. A test that needs the network is a test that
  fails in the sandbox and passes on your laptop.
- **A geometry change carries a before/after**: shape count, point count, and
  bytes, for at least one named Natural Earth layer. That is the number a
  consumer feels.
- **Branch from latest `main`**, and rebase onto it rather than merging it in.
- **One logical change per pull request.**
- **Commits are conventional**: `<type>(<scope>): <subject>`, imperative,
  50 characters or fewer.

## Versions

Consumers pin the generator to reproduce a file, so version numbers here mean
more than usual:

- **Anything that changes emitted bytes for unchanged inputs is at least a
  minor**, including a "better" simplification. Somebody's `npm run build`
  produces a different asset afterwards.
- A new option, a new source, or a new output format is a minor.
- A change requiring a new `format` value in the spec is a major.
- Fixes to the CLI's own behaviour — messages, exit codes, argument handling —
  that leave emitted files identical are patches.

## Code of Conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licence

Contributions are licensed under the [MIT licence](LICENSE) that covers this
project. Natural Earth data is public domain and carries its own attribution,
which the generator stamps into `provenance` — do not strip it.
