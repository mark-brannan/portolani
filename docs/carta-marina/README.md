# Carta Marina comparisons

Sheets that set the scan of Olaus Magnus's Carta Marina (1539) beside what the chart draws in
code, so a review can judge the likeness. The scan is
[Carta_Marina.jpeg](https://upload.wikimedia.org/wikipedia/commons/e/ea/Carta_Marina.jpeg)
(5016 x 3715, public domain); crop boxes are in its px, as (x0,y0)-(x1,y1).

## buildings.png

Each row is a crop of the scan beside the buildings of `scripts/buildings.mjs`, both magnified 2x,
and under each building the same glyph at map size (18 px, the height a lesser place stands at
from zoom 9). The last strip is the chart itself: Genoa, a lesser place, at zoom 10 (8.7 E 44.3 N).

| Row | Scan crop | Drawn |
| --- | --- | --- |
| 1 | Svecia, (2860,2040)-(3080,2180): houses at Mo, Noral, Soderala | `house`, `church` |
| 2 | Vplandia, (2760,2460)-(3000,2600): churches, Arosia, round towers | `church`, `castle`, `round-tower` |
| 3 | Lappia, (3080,960)-(3320,1100): tents at Bircarli | `tent`, `house` |
