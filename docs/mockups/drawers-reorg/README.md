# Settings drawers reorg: mockup

Not for merge. Three groupings of the settings drawers, beside today's, rendered from the live drawer's own controls
by `public/mockup-drawers-reorg.mjs`, so every chip still works. The PNGs here are its renders, made by `shoot.mjs`.

| `?mock=` | Grouping | Renders |
|---|---|---|
| (none) | Today | `0-today-*.png` |
| 1 | Moods, then one scroll, families as chips | `1-one-scroll-*.png` |
| 2 | Moods, then tabs Sea · Land · Margins (`&tab=1` or `&tab=2` opens another) | `2-tabs-*.png` |
| 3 | The rose keeps the look; the chart's own controls move to the Charts drawer as *This sheet* | `3-split-*.png` |

## View live

Serve the app (`npm ci && npm run dev -- --port 10319`) and open `http://localhost:10319/?mock=1#map=5.48/40.265/7.000`
(or `?mock=2`, `?mock=2&tab=2`, `?mock=3` and the Charts instrument). Without `?mock=` the page is today's.

## Re-render

With the server running: `CHROME=<path to chrome> node docs/mockups/drawers-reorg/shoot.mjs <outdir> '' 10319`.
