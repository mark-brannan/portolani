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

## A frame while dragging (#131)

What one frame costs while the map is dragged with every decoration on (the page's defaults: plain rivers, hatched lakes, coloured mountains, Carta Marina trees, continents and regions named, ornaments on), and what each drawing that used to wait for the stop adds to it. The budget is 16.7 ms, one frame at 60 Hz.

Measured on 2026-10-15 with `node scripts/measure-preview.mjs 44.41 8.93 <zooms> --sizes=1440x900 --ornaments=on --late=<layer>` on the built preview in headless Chromium (Genoa, 1440x900; the page's own "frame" figure, `drawGround` and `drawAnchored` for one pointer move; 3 drags of 20 moves, so 60 frames a cell; each move is 6 px east and 2 px south). The machine is the laptop above (Ryzen 7 H 255, 16 threads, WSL2, no GPU) with other sessions running (load average 5 to 11), so a cell is good to about 3 ms at p90; one run each. `--late=none` draws none of the late drawings (the frame as it was before), `relief` or `trees` that one only, `all` every one. Median / p90, ms:

| Zoom | none (before) | + relief | + trees | + all | as shipped |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2 | 91.9 / 105.1 | 93.1 / 106.5 | 91.1 / 104.8 | 94.4 / 117.5 | 99.8 / 127.0 |
| 3 | 33.9 / 40.9 | 42.7 / 93.8 | 33.7 / 40.9 | 32.7 / 39.6 | 33.7 / 42.6 |
| 4 | 25.9 / 28.5 | 26.8 / 34.3 | 29.3 / 39.0 | 25.4 / 30.6 | 26.0 / 29.4 |
| 5 | 19.3 / 22.9 | 20.0 / 22.0 | 18.9 / 21.9 | 21.9 / 28.9 | 19.5 / 21.8 |
| 6 | 11.5 / 13.7 | 12.9 / 15.5 | 14.0 / 18.7 | 14.4 / 16.2 | 14.4 / 15.5 |
| 7 | 9.1 / 11.2 | 11.1 / 13.2 | 10.9 / 12.7 | 12.5 / 14.0 | 12.8 / 15.7 |
| 8 | 11.8 / 13.4 | 15.3 / 20.0 | 14.0 / 15.8 | 16.5 / 18.9 | 14.3 / 17.1 (trees were in) |
| 9 | 11.0 / 12.3 | 15.0 / 19.1 | 14.5 / 16.4 | 19.3 / 22.8 | 14.4 / 16.6 |
| 10 | 14.8 / 17.0 | 18.4 / 23.5 | 18.6 / 21.0 | 23.8 / 43.6 | 14.6 / 17.3 |
| 11 | 7.7 / 9.1 | 10.4 / 11.9 | 13.7 / 17.1 | 15.3 / 18.9 | 10.3 / 14.6 |
| 12 | 8.4 / 11.5 | 8.5 / 10.0 | 12.9 / 17.7 | 12.5 / 14.8 | 12.6 / 14.9 |

The ground, the lines and the ornaments alone are over the budget at zoom 5 and below (the whole world is drawn each frame), so nothing late is added there. The rivers and lakes are not late: a drag already draws them with the ground. What each late drawing adds is its column less "none":

| Drawing | Added to a frame, median | In the drag |
| --- | --- | --- |
| Region and continent names (`worldNames`) | within the noise in the browser; 0.0 to 0.3 ms in the Node renderer | at every zoom |
| City plans (`cities`) | not run in the browser (no city is in a Genoa view); in the Node renderer, Venice at zoom 13 (one city), 4.5 / 5.7 ms median / p90, against 3.6 / 5.6 for relief at the same view | at every zoom |
| Shaded hills and mountains (`relief`) | zoom 5 to 12: 0.7, 1.4, 2.0, 3.5, 4.0, 3.6, 2.7, 0.1 | zooms 6, 7, 11, 12 |
| Trees and palms (`trees`) | zoom 5 to 12: -0.4, 2.5, 1.8, 2.2, 3.5, 3.8, 6.0, 4.5 | zooms 6, 7, 9, 12 |
| Town washes and houses (the footprint wash and `housesIn` of `drawScene`) | in the Node renderer: 40 (Genoa z9), 68 (z11), 328 (z12), 8 to 12 (Venice z12, z13); that renderer's whole ground-and-ornaments frame is 60 to 65 at z9 and z11 | stays late |

A layer is in the drag at a zoom where the frame with it stays within 16.7 ms at p90. Relief and trees are both in only where "+ all" fits (zooms 6, 7 and 12); where one fits (9: trees, 11: relief) that one is in; at 8 neither relief (20.0) nor, once measured as shipped, trees (17.1, over by 0.4 ms) fits, so trees were taken out of 8 after the last run, and that cell is not re-measured. At 10 the ground alone is over (17.0 ms), and 13 and above were not measured, so the late drawings wait for the stop there (the names and cities excepted, which cost nothing measurable). The town washes and houses are one wash and a lattice of houses per footprint, redrawn every frame, several times the budget at every zoom they show; they stay late. The Node renderer figures come from `node scripts/measure-drag.mjs` (`DOWNLOADS=downloads` for the 10m footprints): the same drawing code in `@napi-rs/canvas`, which draws the ground about six times slower than Chromium does, so they are read as ratios and not as frame times.

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

One budget of 10 ornaments (roses, monsters and ships together) a window holds at density 1 (#147); the density slider scales it. 10 is the per-window caps summed: 4 roses, 4 monsters, 2 ships. A sheet's share is its territory in windows, its extent less the smaller curated sheets over it, and a window here is the sheet's pacing window: the page at its band's first zoom, or in the world band at the zoom the sheet is one window wide. The roses take 4 of every 10 at most, the rest go two monsters to a ship; a rose that cannot stand gives its place to the beasts, so the total stays the budget. A curated chart's own figures (history on, the default) count inside the sheet's share, roses first, then monsters, then ships.

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

Margin: no view is over 15 (1.5 times the budget) with history on, and none is over 16 with history off at the overview band and below (Mediterranean, one sheet at its band's first zoom, is the 16, above 1.5 times the budget without overlapping world sheets). The two seeded world-band rows above it (zoom 2 and 3) add the budgets of the two or three world sheets that overlap one window there, each paced at its own zoom. Views deeper into a band than its first zoom, or over coast, hold fewer: a sheet holds its share across its whole extent, and the land takes the sites a beast needs. Density 2 measures a mean of 8.2 and a maximum of 19 over the same views, 0.5 a mean of 3.3 and a maximum of 7, and 0 none (history on). `test/rose-sheets.test.mjs` checks that no sheet holds more than its share.
