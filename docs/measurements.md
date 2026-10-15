# Measurements

Draw times for the built preview (`_site/`) in headless Chromium, at a coastal spot (44.41, 8.93) with the default ink, parchment and density 1 ("on") or 0 ("off"), in ms (median / worst of 5 redraws, which draw the same view again; pan frames are the 60 moves of three drags). Measured on 2026-10-13 with `scripts/measure-preview.mjs`, one run each, on a laptop-class machine (8-core Ryzen 7, 16 threads, 14 GB, WSL2, no GPU), served from localhost, so the network is not in the times.

| Size | Zoom | Ornaments | First draw (of it, data load) | Redraw | Pan frame painted |
| --- | ---: | --- | ---: | ---: | ---: |
| 1440x900 | z2 | on | 973 (294) | 410 / 494 | 372 / 403 |
| 1440x900 | z2 | off | 418 (112) | 157 / 183 | 366 / 400 |
| 1440x900 | z5 | on | 297 (99) | 54 / 84 | 33 / 39 |
| 1440x900 | z5 | off | 281 (116) | 28 / 39 | 33 / 40 |
| 1440x900 | z9 | on | 249 (97) | 30 / 40 | 33 / 35 |
| 1440x900 | z9 | off | 246 (100) | 27 / 34 | 33 / 34 |
| 1440x900 | z10 | on | 283 (121) | 21 / 27 | 33 / 34 |
| 1440x900 | z10 | off | 257 (118) | 15 / 19 | 33 / 34 |
| 1440x900 | z11 | on | 257 (113) | 21 / 28 | 33 / 34 |
| 1440x900 | z11 | off | 271 (121) | 16 / 23 | 33 / 34 |
| 1024x768 | z2 | on | 676 (98) | 404 / 451 | 364 / 613 |
| 1024x768 | z2 | off | 404 (97) | 156 / 178 | 364 / 389 |
| 1024x768 | z5 | on | 299 (99) | 58 / 82 | 33 / 36 |
| 1024x768 | z5 | off | 268 (107) | 28 / 40 | 33 / 40 |
| 1024x768 | z9 | on | 249 (98) | 24 / 38 | 33 / 34 |
| 1024x768 | z9 | off | 256 (102) | 29 / 34 | 33 / 34 |
| 1024x768 | z10 | on | 264 (119) | 21 / 27 | 33 / 34 |
| 1024x768 | z10 | off | 280 (141) | 22 / 42 | 33 / 34 |
| 1024x768 | z11 | on | 255 (114) | 22 / 26 | 33 / 34 |
| 1024x768 | z11 | off | 255 (119) | 15 / 22 | 33 / 34 |

The pan-frame times at z5 and above sit at two animation frames (33 ms at 60 Hz), the floor of the method; at z2 the whole world is drawn each frame, about 60 ms of it in drawing. Sizes do not change the data fetched; the table below is the same at both.

| What | Bytes | Fetched at |
| --- | ---: | --- |
| 50m land, coast and places (`geo/*.geojson`) | 3,523,998 | every view |
| Scanned sprites (`packs/scanned/`, default settings; whole pack 3,344,546) | 576,745 | every view, ornaments on or off |
| Vivid sprites (`packs/vivid/`, default settings; whole pack 28,398) | 21,816 | every view, ornaments on or off |
| 10m cells around the view (`geo/10m/`) | not measured at z9 to z10 | z9 to z10; whole set is 18,786,827 |
| 10m rivers and lakes around the view (`geo/water-10m/`) | 0.7 MB at Seattle, 1.7 MB at the Great Lakes | past z7, when water is drawn |
| GSHHG "h" cells around the view (`geo/h/`, 1° cells) | 6 KB at Genoa, 181 KB at Bergen at z10.5 (126 KB at z13), 52 KB at Seattle | past z10; whole set is 19,273 cells, 132 MB; built only when the installed `coastlines` carries `gshhg-land-h` |
| GSHHG "f" cells around the view (`geo/f/`, 0.5° cells) | 330 KB at Seattle at z13.5 | past z12; whole set is 70,692 cells, 384 MB |
| GSHHG lakes around the view (`geo/h-lakes/`, `geo/f-lakes/`) | 168 KB in Finland, 53 KB in Minnesota at z10 | past z10, when lakes are drawn; 50 MB whole |
| Font (`font/IMFeENrm28P.ttf`) | 194,992 | every view |

## Ornaments per window

One budget of 10 ornaments (roses, monsters and ships together) a window holds at density 1 (#147); the density slider scales it. It is main's window placement summed (4 roses, 4 monsters, 2 ships; counted from the code, not guessed). A sheet's share is its territory in windows, its extent less the smaller curated sheets over it, and a window here is the sheet's pacing window: the page at its band's first zoom, or in the world band at the zoom the sheet is one window wide. The roses take 4 of every 10 at most, the rest go two monsters to a ship; a rose that cannot stand gives its place to the beasts, so the total stays the budget. A curated chart's own figures (history on, the default) count inside the sheet's share, roses first, then monsters, then ships.

Measured on 2026-10-15 with `node scripts/measure-ornaments.mjs` (density 1, `scale: 'off'`, the 50m land only, one scene per view, about 2 s each, 12 views, about 25 s a run; not part of `npm test`). Counted: figures whose centre lies on the page.

History on (the default). A Mediterranean or Baltic view is empty because the charts there draw none of their own (#146).

| View | Zoom | Roses | Monsters | Ships | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| world, Atlantic | 2 | 5 | 5 | 3 | 13 |
| world, North Atlantic | 3 | 4 | 3 | 3 | 10 |
| world, Baltic | 5 | 0 | 0 | 0 | 0 |
| overview, Caribbean | 6 | 4 | 6 | 1 | 11 |
| overview, Mediterranean | 6 | 0 | 0 | 0 | 0 |
| overview, Bay of Bengal | 6 | 3 | 10 | 2 | 15 |
| general, Aegean | 8 | 1 | 9 | 2 | 12 |
| general, Caribbean | 8 | 2 | 0 | 0 | 2 |
| coastal, Aegean | 10 | 0 | 0 | 3 | 3 |
| coastal, Liguria | 10 | 2 | 0 | 1 | 3 |
| approach, Cyclades | 12 | 2 | 1 | 2 | 5 |
| harbour, Genoa | 14 | 0 | 0 | 3 | 3 |

mean 6.4, max 15 of 12 views at density 1.

History off (seeded figures everywhere):

| View | Zoom | Roses | Monsters | Ships | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| world, Atlantic | 2 | 7 | 7 | 2 | 16 |
| world, North Atlantic | 3 | 9 | 8 | 4 | 21 |
| world, Baltic | 5 | 1 | 0 | 0 | 1 |
| overview, Caribbean | 6 | 4 | 6 | 1 | 11 |
| overview, Mediterranean | 6 | 3 | 11 | 2 | 16 |
| overview, Bay of Bengal | 6 | 3 | 10 | 2 | 15 |
| general, Aegean | 8 | 1 | 9 | 2 | 12 |
| general, Caribbean | 8 | 2 | 0 | 0 | 2 |
| coastal, Aegean | 10 | 0 | 0 | 3 | 3 |
| coastal, Liguria | 10 | 2 | 0 | 1 | 3 |
| approach, Cyclades | 12 | 2 | 1 | 2 | 5 |
| harbour, Genoa | 14 | 0 | 0 | 3 | 3 |

mean 9.0, max 21 of 12 views at density 1.

Margin: no view is over 15 (1.5 times the budget) with history on, and none is over 15 with history off at the overview band and below. The two seeded world-band rows above it (zoom 2 and 3) add the budgets of the two or three world sheets that overlap one window there, each paced at its own zoom. Views deeper into a band than its first zoom, or over coast, hold fewer: a sheet holds its share across its whole extent, and the land takes the sites a beast needs. Density 2 measures a mean of 8.2 and a maximum of 19 over the same views, 0.5 a mean of 3.3 and a maximum of 7, and 0 none (history on). `test/rose-sheets.test.mjs` checks that no sheet holds more than its share.

Before this change the same views held at most 15 on the page (zoom 2, history on), and 8 at the overview band over the Caribbean against 11 now; the per-sheet caps summed to more than one window holds wherever sheets overlap it.
