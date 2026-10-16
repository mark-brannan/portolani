# Measurements

Draw times for the built preview (`_site/`) in headless Chromium, at a coastal spot (44.41, 8.93) with the default ink, parchment and density 1 ("on") or 0 ("off"), in ms (median / worst of 5 redraws, which draw the same view again; pan frames are the 60 moves of three drags). Measured on 2026-10-16 with `node scripts/measure-preview.mjs 44.41 8.93 2,5,9,10,11`, on main at c8a72d3 (after #164 to #169 and #173 to #175), three runs, each cell the median of the three runs' medians (and of their worst), on a laptop-class machine (Ryzen 7 H 255, 16 threads, 14 GB, WSL2, no GPU) with other sessions running (load average 4 to 12), served from localhost, so the network is not in the times. The runs agree to within 10% except where noted in the next paragraph; a stray run in a cell (one z5 off redraw of 666 against 243 and 260) is the median's job to drop.

| Size | Zoom | Ornaments | First draw (of it, data load) | Redraw | Pan frame painted |
| --- | ---: | --- | ---: | ---: | ---: |
| 1440x900 | z2 | on | 1921 (623) | 595 / 652 | 474 / 520 |
| 1440x900 | z2 | off | 1795 (663) | 447 / 487 | 464 / 729 |
| 1440x900 | z5 | on | 1664 (603) | 378 / 418 | 74 / 103 |
| 1440x900 | z5 | off | 1551 (637) | 260 / 308 | 69 / 123 |
| 1440x900 | z9 | on | 1732 (599) | 498 / 530 | 34 / 55 |
| 1440x900 | z9 | off | 1717 (629) | 443 / 454 | 34 / 49 |
| 1440x900 | z10 | on | 11531 (601) | 10854 / 11007 | 35 / 67 |
| 1440x900 | z10 | off | 4750 (630) | 3769 / 3972 | 34 / 56 |
| 1440x900 | z11 | on | 2542 (634) | 1831 / 1929 | 35 / 61 |
| 1440x900 | z11 | off | 1520 (656) | 741 / 789 | 34 / 47 |
| 1024x768 | z2 | on | 1865 (625) | 575 / 622 | 466 / 572 |
| 1024x768 | z2 | off | 1741 (629) | 443 / 528 | 456 / 617 |
| 1024x768 | z5 | on | 1651 (612) | 374 / 430 | 69 / 92 |
| 1024x768 | z5 | off | 1523 (619) | 266 / 311 | 68 / 89 |
| 1024x768 | z9 | on | 1780 (604) | 508 / 558 | 34 / 68 |
| 1024x768 | z9 | off | 1636 (600) | 405 / 464 | 33 / 49 |
| 1024x768 | z10 | on | 11954 (620) | 10723 / 10859 | 34 / 64 |
| 1024x768 | z10 | off | 4725 (653) | 3764 / 3877 | 34 / 47 |
| 1024x768 | z11 | on | 2642 (662) | 1707 / 1778 | 35 / 59 |
| 1024x768 | z11 | off | 1516 (661) | 723 / 769 | 34 / 53 |

The pan-frame times at z9 and above sit at two animation frames (33 ms at 60 Hz, 34 to 35 measured), the floor of the method; at z5 the frame now costs 69 to 74 ms painted with ornaments on or off (it was 33), and at z2 the whole world is drawn each frame, 90 ms of it in drawing (the script's "pan frame drawn" column) and 456 to 474 painted (it was 364 to 366). Sizes do not change the data fetched; the table below is the same at both.

Redraws and first draws are slower than they were because the decorations (relief, trees, rivers, lakes, names, patches) are now on by default and the packs grew.

z10 with ornaments on redraws in 10.9 s against 3.8 s with them off; z9 and z11 stay under 2 s.

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
| 50m land, coast, places, lakes, rivers and urban areas (`geo/*.geojson`) | 4,622,485 | every view (5,804,923 at z2) |
| Scanned sprites (`packs/scanned/`, default settings; whole pack 5,519,197) | 5,217,733 | every view, ornaments on or off |
| Vivid sprites (`packs/vivid/`, default settings; whole pack 1,765,157) | 1,759,084 | every view, ornaments on or off |
| de Bry sprites (`packs/debry/`, default settings; whole pack 880,263) | 678,760 | every view, ornaments on or off |
| 10m cells around the view (`geo/10m/`) | 126 KB at Genoa z10, 12 KB at z11, none at z9 (`measure-preview.mjs`) | z10 and z11 at Genoa; whole set is 18,861,693 |
| 10m rivers and lakes around the view (`geo/water-10m/`) | 0.7 MB at Seattle, 1.7 MB at the Great Lakes | past z7, when water is drawn |
| GSHHG "h" cells around the view (`geo/h/`, 1° cells) | 6 KB at Genoa, 181 KB at Bergen at z10.5 (126 KB at z13), 52 KB at Seattle | past z10; whole set is 19,273 cells, 132 MB; built only when the installed `coastlines` carries `gshhg-land-h` |
| GSHHG "f" cells around the view (`geo/f/`, 0.5° cells) | 330 KB at Seattle at z13.5 | past z12; whole set is 70,692 cells, 384 MB |
| GSHHG lakes around the view (`geo/h-lakes/`, `geo/f-lakes/`) | 168 KB in Finland, 53 KB in Minnesota at z10 | past z10, when lakes are drawn; 50 MB whole |
| Font (`font/IMFeENrm28P.ttf`) | 194,992 | every view |

## Ornaments per window

One budget of 10 ornaments (roses, monsters and ships together) a window holds at density 1 (#147); the density slider scales it. 10 is the per-window caps summed: 4 roses, 4 monsters, 2 ships. A sheet's share is its territory in windows, its extent less the smaller curated sheets over it, and a window here is the sheet's pacing window: the page at its band's first zoom, or in the world band at the zoom the sheet is one window wide. The roses take 4 of every 10 at most, the rest go two monsters to a ship; a rose that cannot stand gives its place to the beasts, so the total stays the budget. A curated chart's own figures (history on, the default) count inside the sheet's share, roses first, then monsters, then ships.

Measured on 2026-10-16 (main at c8a72d3) with `node scripts/measure-ornaments.mjs` (density 1, `scale: 'off'`, the 50m land only, one scene per view, about 2 s each, 12 views, about 25 s a run; not part of `npm test`). Counted: figures whose centre lies on the page.

History on (the default). A Mediterranean or Baltic view is empty because the charts there draw none of their own (#146).

| View | Zoom | Roses | Monsters | Ships | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| world, Atlantic | 2 | 7 | 1 | 4 | 12 |
| world, North Atlantic | 3 | 6 | 0 | 4 | 10 |
| world, Baltic | 5 | 0 | 0 | 0 | 0 |
| overview, Caribbean | 6 | 6 | 3 | 1 | 10 |
| overview, Mediterranean | 6 | 0 | 0 | 0 | 0 |
| overview, Bay of Bengal | 6 | 4 | 0 | 3 | 7 |
| general, Aegean | 8 | 1 | 9 | 2 | 12 |
| general, Caribbean | 8 | 2 | 0 | 0 | 2 |
| coastal, Aegean | 10 | 0 | 0 | 3 | 3 |
| coastal, Liguria | 10 | 2 | 0 | 1 | 3 |
| approach, Cyclades | 12 | 2 | 2 | 2 | 6 |
| harbour, Genoa | 14 | 0 | 0 | 3 | 3 |

mean 5.7, max 12 of 12 views at density 1.

History off (seeded figures everywhere):

| View | Zoom | Roses | Monsters | Ships | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| world, Atlantic | 2 | 10 | 1 | 4 | 15 |
| world, North Atlantic | 3 | 13 | 1 | 5 | 19 |
| world, Baltic | 5 | 1 | 0 | 0 | 1 |
| overview, Caribbean | 6 | 6 | 3 | 1 | 10 |
| overview, Mediterranean | 6 | 6 | 4 | 3 | 13 |
| overview, Bay of Bengal | 6 | 4 | 0 | 3 | 7 |
| general, Aegean | 8 | 1 | 9 | 2 | 12 |
| general, Caribbean | 8 | 2 | 0 | 0 | 2 |
| coastal, Aegean | 10 | 0 | 0 | 3 | 3 |
| coastal, Liguria | 10 | 2 | 0 | 1 | 3 |
| approach, Cyclades | 12 | 2 | 2 | 2 | 6 |
| harbour, Genoa | 14 | 0 | 0 | 3 | 3 |

mean 7.8, max 19 of 12 views at density 1.

Margin: no view is over 12 with history on, and none is over 13 with history off at the overview band and below (Mediterranean, one sheet at its band's first zoom, is the 13). Only the seeded world-band row at zoom 3 (19) is over 1.5 times the budget, with zoom 2 at it (15); they add the budgets of the two or three world sheets that overlap one window there, each paced at its own zoom. Views deeper into a band than its first zoom, or over coast, hold fewer: a sheet holds its share across its whole extent, and the land takes the sites a beast needs. Density 2 measures a mean of 7.3 and a maximum of 15 over the same views, 0.5 a mean of 3.6 and a maximum of 8, and 0 none (history on). `test/rose-sheets.test.mjs` checks that no sheet holds more than its share.