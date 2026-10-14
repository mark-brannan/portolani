# Decisions

One line per ruling, newest last. An ADR supersedes a line here.

- 2026-10-13 — "The essential ingredient of drawing line-based maps is best suited to geojson data or similar vector based or vector-like representations of the maps that do not use tiles. Use coastlines or coast-wright in their new/reimagined versions. Or use natural earth geojson data. I want rich overlays for decorative elements if we can get that." Ruled by Solace. ([#26](https://github.com/mark-brannan/portolani/issues/26))
- 2026-10-13 — "you should use coast-wright though.  It draws things!   If we don't have what we need inside coast-wright already then we can request it (change it ourselves) easily" Ruled by Solace. ([#26](https://github.com/mark-brannan/portolani/issues/26))
- 2026-10-14 — Vectors, not raster; delivery is open: "Geometry is vector at every zoom and drawn through coast-wright. Whether it arrives as one file or as chunks by region and zoom band is an implementation matter. Raster is never the coastline." Clarifies the first 2026-10-13 line: "do not use tiles" means no raster tiles. Ruled by Solace. ([#26](https://github.com/mark-brannan/portolani/issues/26))
- 2026-10-14 — The cartouche and the scale bar are on the window, not on the map: "pinned to the screen." Ruled by Solace. ([#107](https://github.com/mark-brannan/portolani/issues/107), [docs/atlas](atlas/README.md))
