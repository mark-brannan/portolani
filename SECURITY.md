# Security Policy

Only the latest `main` is supported. There is nothing published to npm.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately:

1. Go to [Security → Report a vulnerability](https://github.com/mark-brannan/portolani/security/advisories/new).
2. Say what you found and how to reproduce it.

You should get an acknowledgement within a week. This is a spare-time project maintained by one person, so a fix may take longer; you will be told where it stands. If you get no response within two weeks, open a public issue saying only that you are waiting on a private report.

## What is in scope

- The build scripts, which download pinned sources and check their sha256.
- The page and renderer, which draw untrusted GeoJSON in a browser or in Node.
- The Pages deployment and the workflows in `.github/`.

Natural Earth's data and the museum scans are out of scope; report problems upstream.
