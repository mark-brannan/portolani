# portolani

[![Italy and the western Mediterranean as a portolan chart: rhumb lines, wind roses, a sea monster and a cartouche lettered PORTOLANI, on parchment](docs/readme.jpg)](https://mark-brannan.github.io/portolani/)

A base map drawn the way a 15th-century portolan chart would have drawn it: ink on parchment, rhumb lines radiating from wind roses, names lettered along the coast, ships and sea monsters where the ocean is empty. The geometry under the ornament is today's. A fun alternative for a chart plotter.

**[See the current proof of concept →](https://mark-brannan.github.io/portolani/)**

It opens on the western Mediterranean, drawn in your browser from Natural Earth data and ornaments after public-domain charts (Olaus Magnus's *Carta Marina*, the Catalan Atlas, Aguiar, de Wit), drawn as vectors or cropped from the scans. Drag to pan and wheel or pinch to zoom, anywhere in the world; the view is kept in the URL, so a place can be linked. Ink colour, parchment tone and ornament density are adjustable, and so is which roses, monsters, ships and towns are drawn, one by one or by family, scans and vectors mixed. Ornaments are placed again each time the map stops, and the known defects are still visible: a few sprites over land, some flipped names, halos around sprites. The live page is the work in progress and will change as the project moves toward a working map.

## Where this is going

The plan, and the reasons for it, are in [#26](https://github.com/mark-brannan/portolani/issues/26). In short: one renderer, run in the browser or in Node, drawing the same map either way, with ornament packs the user can choose and tune. The earlier coastline-compression tool this repository used to hold was withdrawn; the story is in [#25](https://github.com/mark-brannan/portolani/issues/25).

## Run it yourself

```shell
npm ci
npm run build:preview   # assembles _site/ (downloads pinned sources, checks their sha256)
npm run render          # draws the same scene in Node to out/
npm run packs           # rebuilds the ornament packs from the scans (maintainers)
```

Node 20 or newer. Sources, licences and checksums are in [ASSETS.md](ASSETS.md).

## Measurements

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

## Reading a portolan chart

- Rhumb lines run from each wind rose: black for the eight winds, green for the half-winds, red for the quarter-winds.
- A course is the line parallel to the track, followed back to a rose to read the wind's name.
- Ports are lettered inland, at right angles to the coast; important ones in red, lesser ones in black.
- More: [Trinity College Library](https://trinitycollegelibrarycambridge.wordpress.com/2015/08/14/portolan-chart-of-the-mediterranean/) and [Cartography Unchained](https://www.cartographyunchained.com/chug1/).

## Licence

MIT for the code. Natural Earth is public domain. GSHHG (the "h" shoreline past z10 and the "f" shoreline past z12) is by Wessel and Smith, LGPL-3.0-or-later; "h" ships unchanged through `coastlines`, and the site carries its copyright and permission notice beside the cells (`geo/gshhg-licence.txt`). The scans are public domain, credited to their holding institutions in [ASSETS.md](ASSETS.md). IM Fell English is under the SIL OFL 1.1, shipped with its licence text.
