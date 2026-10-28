# The link

## Observables a test can read (all verified)

- The hash: `location.hash`, rewritten with `history.replaceState` (no history entry) by `writeHash` [page.js:119]. A setting at its default is left out. The hash is written when the map stops (drag lift, 300 ms after the last wheel event, flight landing), not while it moves [page.js:642].
- Control state: chips carry `aria-checked`; thumbs carry `aria-pressed`; `#density`, `#continentsZoom`, `#regionsZoom` are range inputs; `#title` shows the cartouche's own lettering while Automatic is on [page.js:355-372, 540].
- `#status` text `z<zoom>: load N ms, placement + parchment N ms, draw N ms (total N ms)` after each placement [page.js:540].
- Canvas pixels of `#map` (1600 x 1000 backing store) for visible effects.
- Default view when the hash has no valid `map`: `{ zoom 5.48, lat 40.265, lon 7 }` (measured: `DEFAULT_VIEW`, scene.mjs:304, node import).
- Hash key order as written: `map, projection, sprites, townsize, names, rhumb, continents, regions, regionszoom, autotitle, title, land, islands, rivers, lakes, mountains, trees, placement, voyage, overlay, overlayopacity, seas, scaleborder, scale, cartouche, scalepos, density, ink, parchment` [page.js:119-146; `voyage` from #205, `cartouche` and `scalepos` from #219, none of them specified here yet; `overlay` (default none, `null`) and `overlayopacity` (default `0.6`) from #161, in drawer.md "Scan overlay", tested offline by test/overlays.test.mjs].

---

## The hash and the view

Feature: Map view  (hash key `map=<zoom>/<lat>/<lon>`, default `5.48/40.265/7.000`, zoom 1..15) [verified page.js:68-73, 119-121; scene.mjs:312]
  Tested by: test/hash.test.mjs — 'map: the view round-trips through the hash'
  Tested by: test/hash.test.mjs — 'map: a zoom past the top is clamped to 15, not rejected'
  Tested by: test/hash.test.mjs — 'map: a view that fails the pattern opens the default view'
  Tested by: test/hash.test.mjs — 'map: longitude wraps'
  Scenario: the view round-trips through the hash
    Given the chart at `#map=8.00/43.700/7.300`
    When the page loads
    Then `#status` begins `z8.0` and the hash is still `map=8.00/43.700/7.300` (zoom 2 dp, lat and lon 3 dp)
  Scenario: a malformed or out-of-range view is clamped, not rejected
    Given the chart at `#map=99/40/5`
    When the page loads
    Then the view is zoom 15 (`ZOOM.max`) and the next hash write says `map=15.00/...`
    # `#map=1.2.3/40/5` fails the regex and falls back to the default view [page.js:68-70]
  Scenario: longitude wraps
    Given the chart at `#map=5/40/190`
    When the page loads
    Then the first hash write has lon `-170.000` (`wrapLon`, scene.mjs:312) (unverified: `wrapLon` body not read)

Feature: Hash change redraws  (any hash edit while the page is open) [verified page.js:829]
  Tested by: test/hash.test.mjs — 'hashchange: editing the hash redraws without a reload'
  Scenario: editing the hash redraws without a reload
    Given the chart at the default view
    When a test sets `location.hash = 'map=5.48/40.265/7.000&ink=5a1a1a'`
    Then the style, selection and placement controls show the new values and the map is placed again
    # a legacy hash set this way is NOT rewritten; only the first load rewrites (page.js:513)

Feature: Reset  (button `#reset`) [verified page.js:~590, index.html "share"]
  Tested by: test/hash.test.mjs — 'reset: every control back to default, only the view kept'
  Scenario: every control back to default, place kept
    Given the chart at `#map=7.00/43.700/7.300&ink=5a1a1a&density=1.5&projection=miller`
    When the user clicks Reset
    Then the hash is exactly `#map=7.00/43.700/7.300`
    # Mismatch: tooltip says "the view stays", but projection is dropped with the rest (only `map` is kept), so the chart returns to Mercator.

Feature: Copy link  (button `#copy`) [verified page.js:~600]
  Tested by: test/hash.test.mjs — 'copy link: the clipboard holds the page URL'
  Tested by: test/hash.test.mjs — 'copy link: a refused clipboard selects the link in a box'
  Scenario: the link is the page URL
    Given the chart at any hash and clipboard permission
    When the user clicks Copy link
    Then the clipboard holds `location.href` and `#shareNote` reads "Link copied"
  Scenario: clipboard refused
    Given clipboard permission denied
    When the user clicks Copy link
    Then `#shareUrl` is visible, selected, holding `location.href`, and `#shareNote` reads "Could not copy automatically: the link is selected, press Ctrl+C"
