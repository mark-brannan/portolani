# #199's eight views and #138's pinned rose, re-rendered at main 3b5663f

1600x1000, default settings, Playwright against `npm run dev`. Each view is two panels: left, the
10-30 render from `docs/atlas/rerender-2026-10-30` (main 55ef356); right, main now. The rose strip is
the Catalan rose's pin (20.7W 42.1N) at zoom 2, 4, 6 and 8. Nothing was fixed or regenerated.

| # | hash | now, against the report |
|---|---|---|
| 1 | `#map=3.17/-18.526/-111.901` | still wrong: lines run one general way, no node or rose in view (a figure now stands in the sea) |
| 2 | `#map=4.33/39.525/-26.502` | reads right: no seam, roses and beasts present; one grey scan tile among the beasts looks odd |
| 3 | `#map=4.33/36.013/-0.489` | reads right: roses at the nodes, more relief than on 10-30 |
| 4 | `#map=6.14/40.474/7.400` | one hub rose, as on 10-30; still wrong as a Carte Pisane: no hand-lettered coast names, lines modern-clean |
| 5 | `#map=1.00/4.215/10.000` | still wrong: whole world, dense fan at the centre, now with grey scan tiles over Asia |
| 6 | `#map=2.00/40.899/173.403` | still wrong: sparse lines across the Pacific, no rose; grey scan tiles over south Asia |
| 7 | `#map=6.00/-9.000/-140.000` | reads right: lines and roses; the network differs from 10-30 but is as dense |
| 8 | `#map=5.67/-9.238/-139.742` | partly right: lines present, no roses, so 7 against 8 still differ |

## The pinned Catalan rose (#138)

| zoom | seen |
|---|---|
| 2 | the rose stands at the pin, at the hub of the fan |
| 4 | the rose stands at the pin, small |
| 6 | a small rose stands near the pin; the hub nearest the window centre has none |
| 8 | wrong: the lines' hub sits near the centre and carries no rose in this window |

Views that still read wrong: 1, 4 (as a Carte Pisane), 5, 6, 8, and the rose at zoom 8 (and
perhaps 6).

The left panels are cropped from `rerender-2026-10-30/view*.jpg` (their second panel). The grey
rectangles in 2, 5 and 6 and in the rose strip at zoom 2 are scan patches as drawn at main; they
are reported, not judged.
