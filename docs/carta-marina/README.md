# Carta Marina comparisons

Sheets that set the scan of Olaus Magnus's Carta Marina (1539) beside what the chart draws in
code, so a review can judge the likeness. The scan is
[Carta_Marina.jpeg](https://upload.wikimedia.org/wikipedia/commons/e/ea/Carta_Marina.jpeg)
(5016 x 3715, public domain, sha256 `1fd3debb10d5f96ca117b0747c99dba8f17b9bc8d7543da68b03b19a1a7a0571`); crop boxes are in its px, as (x0,y0)-(x1,y1).

## buildings.png

Each row is a crop of the scan beside the buildings of `scripts/buildings.mjs`, both magnified 2x,
and under each building the same glyph at map size (18 px, the height a lesser place stands at
from zoom 9). The last strip is the chart itself: Genoa, a lesser place, at zoom 10 (8.7 E 44.3 N).

| Row | Scan crop | Drawn |
| --- | --- | --- |
| 1 | Svecia, (2860,2040)-(3080,2180): houses at Mo, Noral, Soderala | `house`, `church` |
| 2 | Vplandia, (2760,2460)-(3000,2600): churches, Arosia, round towers | `church`, `castle`, `round-tower` |
| 3 | Lappia, (3080,960)-(3320,1100): tents at Bircarli | `tent`, `house` |

## Hills and mountains

![Scan crops beside the drawn relief](relief.png)

`relief.png` sets two crops of the scan, shown at half size, beside the relief `scripts/relief.mjs`
draws, at map size (one map pixel to one sheet pixel), in both styles, `marina` and `engraved`:

| Row | Scan crop, scan px (x0,y0)-(x1,y1) | Drawn view, zoom/lat/lon | Map crop, px (x, y, w, h) |
| --- | --- | --- | --- |
| The Scandian spine | (2200,1500)-(3000,2100) | 5/63/13 | 520, 480, 400, 300 |
| Norvegia, the lesser hills | (1850,1950)-(2650,2550) | 10/61/9 | 420, 330, 400, 300 |

The drawn views are rendered with the continents and Latin regions on and rivers and lakes in the Carta Marina style.

## trees.png

Each row is a crop of the scan beside the trees of `scripts/trees.mjs`, both magnified 3x; the
last strip is the chart itself at map size (`trees=marina`, 15.5 E 59.5 N, zoom 9).

| Row | Scan crop | Drawn |
| --- | --- | --- |
| 1 | Svecia, (2850,2185)-(2950,2235): a row and a clump | `marina`: rows and a forest clump |
| 2 | Lappia, (2950,1085)-(3050,1135): a row of oval crowns | `marina`: ovals and conifers |
| 3 | Svecia, (2790,2160)-(2890,2210): Orsa's rows | `ink` |
