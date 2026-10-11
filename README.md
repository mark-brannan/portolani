# portolani

An antique-chart base map: Natural Earth coastlines drawn as a portolan chart (parchment, wash, rhumb lines, ornament from public-domain scans), served as ordinary map tiles.

This repository was reset on 2026-10-10. Why the earlier coastline-compression work stopped is in [#25](https://github.com/mark-brannan/portolani/issues/25); the new direction and its build plan are in [#26](https://github.com/mark-brannan/portolani/issues/26).

The mockup renderer and pack scripts are lifted as they stood in `scripts/` and `packs/`; the reference render is `docs/mockup/`. Scan sources and hashes are in [ASSETS.md](ASSETS.md). To rebuild the mockup: fetch the files listed there into `downloads/`, then `npm install && npm run packs && npm run render` (needs ImageMagick 7).
