# Under the hood

A temporary developer view, there while the roses and rhumb lines are being worked on: the atlas's sheets drawn in red, and the knobs fixed in the code exposed in the link and in the settings drawer's last section, "Under the hood (temporary)". Every one is off, or at the code's own value, by default, so a link without them draws as before.

| Hash | Default | What it changes | Constant | For |
|---|---|---|---|---|
| `debug=sheets` | off | Each sheet the scene uses at this view, outlined in red through the live projection, its name (and a curated sheet's source) inside its top-left corner; a curated sheet's shadows dashed | `drawSheetsDebug`, scripts/scene.mjs:2477 | #107, #199 |
| `debug=sheets,rings` | off | And each sheet's hidden circle, its hub a hollow dot and its sixteen nodes filled (hollow in shadow) | as above | #107, #199 |
| `tune=radius:` | 0.4 | A grid sheet's hidden circle, as a fraction of the sheet's height (0.25 to 0.8); curated sheets keep their read radius | `SHEET_RADIUS`, scripts/scene.mjs:2716 | #107 |
| `tune=reach:` | 1 | The reach of every sheet's lines and of the Catalan rose's, times the sheet's page diagonal (0.5 to 2) | `sheetReach`, scripts/scene.mjs:2718 | #199 |
| `tune=origin:` | `rose` | The point every band's grid counts from: `rose` (the Catalan Atlas rose, 20.7°W 42.1°N) or `zero` (0°E 0°N, NOAA's own) | `ROSE`, scripts/atlas.mjs:14; `ORIGINS`, :18 | #138 |
| `tune=curated:` | 1 | 0: grid cells everywhere, no curated sheet; the world band stays one sheet | `sheetsFor(…, { curated })`, scripts/atlas.mjs:234 | #199 |
| `tune=roselines:` | 1 | 0: the Catalan rose's 32 lines are no longer added as one more hub at every zoom | scripts/scene.mjs:1825 | #138, #199 |
| `tune=roseshare:` | each band's own (0.4; 0.6 below zoom 8) | The share of a sheet's allotment that goes to roses (0 to 1), in every band; the monsters and ships take the rest | `ROSE_SHARE`, scripts/scene.mjs:174; `WIDE.roseShare`, :181 | #162 |
| `tune=sheetroses:` | each band's own (4; 6 below zoom 8) | The most roses a sheet holds (1 to 8), in every band | `SHEET_ROSES`, scripts/scene.mjs:174; `WIDE.sheetRoses`, :181 | #162 |

Knobs go in one `tune=` as comma-separated `name:value`, e.g. `#tune=radius:0.5,reach:1.5,origin:zero`. A value out of range or malformed falls back to the default; a knob at its default is left out of the link. Headless, `createScene(env, { debug: ['sheets', 'rings'], tune: { radius: 0.5 } })`; the knobs and their ranges are `TUNE_KNOBS` (scripts/scene.mjs:2723).

The overlay is drawn over everything, in the same pass as the rhumb lines, so it moves with a drag as they do; it places nothing and clears nothing.

[View 4 of #199](https://mark-brannan.github.io/portolani/#map=6.14/40.474/7.400&debug=sheets,rings) (`#map=6.14/40.474/7.400&debug=sheets,rings`): the Carte Pisane's western sheet holds the view, and the overview cell north of it still reaches down to 42.1°N, the rose's row.

![View 4, sheets and rings](under-the-hood/view4-sheets-rings.jpg)

[View 2 of #199](https://mark-brannan.github.io/portolani/#map=4.33/39.525/-26.502&debug=sheets,rings) (`#map=4.33/39.525/-26.502&debug=sheets,rings`): four ocean-band cells cornered on the Catalan rose, and their rings.

![View 2, sheets and rings](under-the-hood/view2-sheets-rings.jpg)

The drawer's section:

![The Under the hood section](under-the-hood/drawer.jpg)
