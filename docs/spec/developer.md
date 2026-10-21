# Developer options

Headless, not a user surface.

Feature: `createScene(env, opts)`  [verified scene.mjs:2553-2578]
  Scenario: defaults differ from the page's DEFAULTS
    Given `createScene(env)` with no options
    When it places
    Then `land` is `islands`, `rivers`, `lakes`, `trees` are `off`, `relief` is none, `continents` false, `regions` `off`, `historical` true, `scale` `genoese`, `view` is `DEFAULT_VIEW`, `autoTitle` true (page: `land` ochre, rivers `plain`, lakes `marina`, trees `marina`, mountains colour)
    # per CLAUDE.md the headless scene keeps relief, trees, rivers and lakes off so each golden isolates one thing
  Options read: `ink, parchment, density, names, rhumb, scale, scaleBorder, land, islands, seaTint, rivers, lakes, relief (a style or a list), trees, continents, continentsZoom, regions, regionsZoom, title, autoTitle, pinTitle, townSize, historical, seed, view, sprites, kinds, pinned`, and the legacy `rendering, rose, monster, town` (any one set turns on legacy mode: `rank` town sizing, no seed, unshuffled order, scene.mjs:2556-2557).
  Scenario: a mix of relief styles
    Given `createScene(env, { relief: ['marina', 'engraved'] })`
    When the Alps are placed
    Then each range takes one style by its seed (scene.mjs:2525; test/golden.test.mjs:179)
    # the page passes one style at a time, so this mix is unreachable from the drawer
  Scenario: unpinned
    Given `{ pinned: false }`
    When placed
    Then the cartouche is dropped from `kinds` and the scale bar is off the sheet (scene.mjs:2559-2562)

Feature: `scripts/render.mjs`  (`npm run render`) [verified scripts/render.mjs:1-85]
  Scenario: no options
    Given `npm run render`
    When it runs
    Then it calls `createScene(env)` with defaults and writes `out/mockup.png` (full sheet) and `out/mockup-detail.png` (the Genoa window at scale 2, `DETAIL`); nothing is configurable from the command line

Feature: Dev server and goldens  [verified package.json scripts; scripts/dev.mjs:95-113; test/golden.test.mjs:1-60]
  Scenario: dev server port
    Given `npm run dev -- --port 9000` (or a bare number as an argument)
    When it starts
    Then it serves `public/` on port 9000 (default 8080); `--build` and `--data <url>` are the other flags (dev.mjs:8, 97-100)
  Scenario: goldens
    Given `npm run golden` (`UPDATE_GOLDEN=1 node --test test/golden.test.mjs`)
    When it runs
    Then the six golden views (`world-z2`, `region-z5`, `close-z9`, `world-z2-plate-carree`, `world-z2-orthographic`, `world-z2-voyage` with `voyage: 'magellan'`) are redrawn at 400 x 250
  Scenario: touch test environment
    Given `TOUCH_REQUIRED=1`, `TOUCH_SHOTS=<dir>` or `PLAYWRIGHT=<module>`
    When `test/touch.test.mjs` runs
    Then it fails on a missing browser, writes a screenshot per width, or imports the named module (touch.test.mjs header)
