# Ornaments at wide views

Issue #162, part 1. The world and overview bands (a sheet paced below zoom 8) take their ornaments from three world charts drawn in the portolan manner, and at every view a rose is held to the share of the page that a chart's own rose takes.

## What the charts carry

Counted and measured by eye on reductions of the scans (about 1920 px wide), so a count is good to about two and a diameter to about 10%. A diameter is the rose's outer ring over the chart's width (the sheet's torn edge to edge for de la Cosa).

| Chart | Scan | Roses | Of them large | Large rose, share of width | Small rose, share of width | Ships | Monsters |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Juan de la Cosa, 1500 | [1500 map by Juan de la Cosa rotated.jpg](https://commons.wikimedia.org/wiki/File:1500_map_by_Juan_de_la_Cosa_rotated.jpg) | 9 | 1 | 5.0% | 2.4% | 0 | 0 |
| Cantino planisphere, 1502 | [Cantino planisphere (1502).jpg](https://commons.wikimedia.org/wiki/File:Cantino_planisphere_(1502).jpg) | 19 | 1 | 4.9% | 2.3% | 4 | 0 |
| Diogo Ribeiro, 1529 | [Map Diego Ribero 1529.jpg](https://commons.wikimedia.org/wiki/File:Map_Diego_Ribero_1529.jpg) | 13, and a latitude wheel | 1 (the wheel's rose) | 5.7% (the wheel 12%) | 2.3% | 18 | 0 |
| Mean | | 14 | 1 | 5.2% | 2.3% | 7 | 0 |

A chart is one world wide; the app's world view at zoom 2 shows 0.78 of that. What the app drew at density 1 before this change, and after, in the views of `node scripts/measure-ornaments.mjs` (history on):

| View | Zoom | Before: roses / monsters / ships | After: roses / monsters / ships |
| --- | ---: | --- | --- |
| world, Atlantic | 2 | 5 / 5 / 3 | 7 / 1 / 4 |
| world, North Atlantic | 3 | 4 / 3 / 3 | 6 / 0 / 4 |
| overview, Caribbean | 6 | 4 / 5 / 1 | 6 / 3 / 1 |
| overview, Bay of Bengal | 6 | 3 / 10 / 2 | 4 / 0 / 3 |

## What changed

- A rose is at most 5% of the page wide, and a ring rose 2.4%, at every view (the issue: "cap the rose's size at narrower views by the same measure"); before, the region and close bands still drew 300 px roses. Before, the big Aguiar rose was 300 px of a 1600 px page (19%), which is the rose over Sardinia at the default view with history off.
- Those sheets hold up to 6 roses (they held 4) and 60% of the window budget goes to roses; of the rest a quarter is monsters and the rest ships. The charts carry no monsters and more roses than ships, two to one.
- The window budget, 10 at density 1, is unchanged (#158); the constants are `WIDE` and `ROSE_CAP` in `scripts/scene.mjs`.

Before and after, `docs/wide-ornaments/`: `{before,after}-world-seeded.jpg` is `#map=2.15/28.736/-60.871`, `{before,after}-default-seeded.jpg` the default view, both with history off; `{before,after}-world-historic.jpg` is the world view with history on. Drawn with the Node renderer (`scripts/scene.mjs`, 50m land), as the golden images are.
