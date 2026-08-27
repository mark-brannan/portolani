# Security Policy

## Supported versions

**This is a one-shot generator, so "supported" means something different here
than it does for a library.** You run portolani, you keep the file, and the file
does not depend on the tool afterwards. Nothing you shipped stops working
because a newer version exists.

| Version | Supported |
| ------- | --------- |
| latest `0.x` on [npm](https://www.npmjs.com/package/portolani) | yes |
| anything older | no — but see below |

Only the latest version gets fixes; there are no maintenance branches. What
makes that tolerable is that upgrading is not urgent by default:

- **A file already generated is unaffected by a later release.** It is plain
  JSON with a written [format spec](docs/portolano-format.md), and its
  `provenance.generator.version` records which version made it, so you can
  always tell what you have.
- **The reason to upgrade is a fix in the generator**, and the way to consume
  one is to re-run it and diff the output. That is the whole design.
- **The output format is versioned separately** from the package, by the
  `format` field, under the spec's
  [change policy](docs/portolano-format.md#8-changes).

Where the version *does* matter is `npx portolani`, which always fetches the
latest, and a `devDependency` pinned in a build that regenerates an asset.
Those run current code against a network source, so keep them current.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Report it
privately through GitHub:

1. Go to
   [Security → Report a vulnerability](https://github.com/mark-brannan/portolani/security/advisories/new).
2. Describe what you found, which version you saw it in, and how to reproduce
   it. The tool is deterministic, so **an exact command line is usually the
   whole report** — with a fixture attached if the input matters.

You should get an acknowledgement within a week. This is a spare-time project
maintained by one person, so a fix may take longer than that — you will be told
where it stands rather than left waiting. If a report is valid and you want
credit, you will be named in the advisory.

If you get no response at all within two weeks, open a public issue saying only
that you are waiting on a private report — no details — and it will be picked
up.

## What is in scope

This tool fetches a remote document, parses it, and writes a file. Those three
verbs are the surface.

- **`--source` as a URL.** It will fetch what you point it at. A way to make it
  reach somewhere the operator did not name — through a redirect chain, a
  crafted layer name, or the Natural Earth ref — is in scope. So is a response
  that causes unbounded memory or an unterminated read.
- **GeoJSON parsing.** The fetched document is untrusted input. A crafted
  document that crashes the process, hangs it, or exhausts memory is in scope.
  So is one that produces a portolano whose `provenance` misrepresents where it
  came from — the digest and the attribution are the trust anchor of every file
  this tool writes.
- **`--out` and file writing.** Path traversal, following a symlink out of the
  intended directory, or clobbering something the operator did not name.
- **`--format esm` and `--format cjs`.** These emit executable modules. Source
  data must never be able to influence what runs when that module is imported.
- **The published tarball** — anything shipped in `files` that should not be
  there, or a discrepancy between npm and this repository at the corresponding
  tag.

## What is out of scope

- Natural Earth's own data, its accuracy, and its hosting. This tool fetches
  what `naturalearthdata.com` publishes, records the digest, and does not vouch
  for the cartography.
- The fact that `npx portolani` runs code fetched at that moment from npm. That
  is npm's model, and it is why the install instructions also offer a pinned
  `devDependency`.
- Geometry that looks wrong — a missing island, an over-simplified bay. That is
  a bug, and it belongs in a public issue with the command line that produced
  it.
- Consumers of the output:
  [coastlines](https://github.com/mark-brannan/coastlines/issues) publishes it,
  [coast-wright](https://github.com/mark-brannan/coast-wright/issues) draws it.

## Notes on how this package is built

- **Zero runtime dependencies, by policy.** Nothing in this package's tree
  executes at install or at run time other than this package itself.
- **The tests run with the network unavailable.** `test/offline.test.mjs`
  replaces `fetch` and asserts that nothing reaches the network unless
  `--source` is a URL, so an offline `npm test` proves the property rather than
  the sandbox's DNS.
- **Every file the tool writes carries a `sha256` over the raw fetched bytes**,
  before parsing, plus the exact knob values. A reader can re-fetch, re-run and
  diff without trusting this repository or the person who ran it.
