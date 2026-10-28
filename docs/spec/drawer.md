# The settings drawer

One Feature per control.

Feature: Drawer open and close  (rose button `#open`, one of six instrument buttons in `#where`; shut by `#open` again, Esc, a press outside it or focus leaving it; there is no close button) [verified page.js:593-612 at main]
  Scenario: open, then Esc
    Given the chart with the drawer shut (`#open` has `aria-expanded=false`)
    When the user clicks `#open`, then presses Escape
    Then `#drawer` gains the class `open` and `aria-expanded=true`, then both revert and focus returns to `#open`
  Scenario: one drawer at a time
    Given the settings drawer open
    When the user clicks another instrument (`#charts`, `#sights`, `#go`, `#voyages`, `#anchor`)
    Then the settings drawer shuts and that one opens
  Scenario: a map touch shuts it on a wide screen only
    Given a viewport wider than 520 px and the drawer open
    When the user presses on the map
    Then the drawer shuts; at 520 px or narrower a press on the canvas leaves it open (so a control's effect is seen), though any other outside press or focus-out still shuts it [page.js:607-610 at main]

Feature: Projection  (hash `projection`, default `mercator`, 7 values: `mercator, plate-carree, miller, equal-area, orthographic, azimuthal-equidistant, stereographic`) [verified page.js:68-71, scene.mjs:222, 312]
  Scenario: chip round-trips
    Given the chart at the default view
    When the user clicks the "Globe" chip
    Then the hash gains `projection=orthographic` and the chip has `aria-checked=true`; clicking "Mercator" removes the key
  Scenario: unknown name falls back
    Given the chart at `#projection=bogus`
    When the page loads
    Then the "Mercator" chip is checked and the first hash write omits `projection`
  Scenario: the globe cuts at the horizon
    Given the chart at `#map=2.00/30.000/10.000&projection=orthographic`
    When the page loads
    Then the corners of the canvas are outside the disc, painted as bare sheet (`test/golden/world-z2-orthographic.png` shows it)

Feature: Density  (hash `density`, default `1`, slider 0..2 step 0.25) [verified page.js:77, 363; index.html:266; scene.mjs:2570-2575]
  Tested by: test/hash.test.mjs — 'density: the slider round-trips'
  Tested by: test/hash.test.mjs — 'density: an out-of-range hash falls back to 1'
  Tested by: test/hash.test.mjs — 'density: a value between the steps'
  Scenario: slider round-trips
    Given the chart at the default view
    When the user sets `#density` to 1.5
    Then the hash gains `density=1.5` and `#densityOut` reads `1.5`
  Scenario: boundary
    Given the chart at `#density=0`
    When the page loads
    Then no monsters, ships, hill drawings or roses are placed (budget = 0; scene.mjs:2570-2575; roses take `ROSE_SHARE` 0.4 of the same budget), and at most one plain town stands (the town gap is 48/0 = Infinity; city plans are unaffected)
  Scenario: out-of-range hash falls back
    Given the chart at `#density=3`
    When the page loads
    Then density is 1 and the first write omits `density`
    # Mismatch: the hash accepts any real in [0,2] (`density=1.3`), the slider snaps to 1.25 on display while the style stays 1.3 until any control is touched (`readControls` then reads the slider's 1.25). Also `#density=` (empty) reads as 0, because `Number('')` is 0 [page.js:77].
    # Mismatch: label reads "Density (monsters, ships, towns, hills)"; the same number also sets the ornament budget that roses share (`ROSE_SHARE`, scene.mjs:174 at main).

Feature: Monsters and ships pickers  (hash `sprites`, list of `pack:id`, pack letters `v`=vivid `s`=scanned `p`=plain `d`=debry; omitted when equal to the default selection) [verified page.js:55-60, 107-111, 119-122, 187-197; scene.mjs:775]
  Scenario: one sprite off, by item
    Given the chart at the default view
    When the user clicks the thumb for `s:serpent-a` (scanned Carta Marina monster, in the default set)
    Then its thumb has `aria-pressed=false`, the hash gains `sprites=` listing every default key except `s:serpent-a`, and its family count drops by one ("3 of 4")
  Scenario: one family off, by family
    Given the chart at the default view
    When the user ticks the family checkbox "Carta Marina · scan" in Monsters
    Then every key of that family leaves `sprites=`; ticking it again restores them (all on turns all off, otherwise all on) [page.js:196]
    # partial families show the checkbox `indeterminate`
  Scenario: a non-default sprite on
    Given the chart at the default view
    When the user clicks the vivid `kraken` thumb
    Then the hash gains `sprites=...,v:kraken,...` and the monster list grows (unverified: where the kraken is placed)
  Scenario: unknown keys dropped
    Given the chart at `#sprites=s:serpent-a,s:nonsense`
    When the page loads
    Then only `s:serpent-a` is selected among monsters

Feature: Roses picker  (hash `sprites`; kind `rose`) [verified page.js:187-197; scene.mjs:775 `DEFAULT_RULES`]
  Scenario: choose one rose family
    Given the chart at the default view
    When the user ticks off every rose family but "Aguiar · drawn"
    Then the hash `sprites=` holds only `v:rose-aguiar,v:rose-catalan` among roses
  Scenario: no rose selected draws no rose
    Given `sprites=` with no rose keys
    When the page loads
    Then no rose is drawn: the page drops `rose` from `kinds`, so the scene's `PLAIN` fallback never runs

Feature: Towns picker  (hash `sprites`; kind `town`, including the code-drawn towers `p:tower`, `p:tower-round`, `p:tower-gate`, `p:tower-spire`, `p:tower-dome`) [verified page.js:187-197; scene.mjs:703-745]
  Scenario: tower towns only
    Given the chart at `#map=7.00/43.700/7.300`
    When the user turns off every town family except "Tower · drawn in code"
    Then the hash holds `p:tower*` as its only town keys and towns draw as plain towers (unverified: look)
    # a second code-drawn family, "Carta Marina · drawn in code" (`p:house`, `p:church`, `p:castle`, `p:round-tower`, `p:tent`), is also in the picker and the defaults

Feature: Town size  (checkbox `#townSize` "Size by metro area"; hash `townsize`, default `area`; values `area|population|rank`) [verified page.js:78, 388; scene.mjs:2555, TOWN_SIZES]
  Scenario: checkbox to rank
    Given the chart at the default view
    When the user unticks "Size by metro area"
    Then the hash gains `townsize=rank`; ticking it again removes the key
  Scenario: population is hash-only
    Given the chart at `#townsize=population`
    When the page loads
    Then the box is ticked (anything but `rank` is ticked), and it stays `population` until the box is touched
    # Mismatch: a checkbox cannot show the third value; `population` is reachable only by hash.

Feature: Hills (Catalan drawings)  (chip `#hills`, `off|catalan`; stored as the `mountain`-kind sprites in `sprites`) [verified page.js:355-364, 376-392]
  Scenario: chip toggles all hill sprites
    Given the chart at the default view (hills on)
    When the user clicks "Off" in Hills
    Then every `v:mountains-*` key leaves `sprites=` (the three vivid/catalan mountain sprites; list read from `packs/vivid/pack.json`)
    And the "Catalan drawings" chip reads unchecked
    # the same three sprites also appear as a family checkbox with thumbs (`#pick-relief`, index.html:338 at main); the chip and the family set the same keys
  Scenario: partial selection reads as On
    Given `sprites=` holding only one of the Catalan keys
    When the page loads
    Then the Hills chip is "Catalan drawings" (any one selected)

Feature: Cartouche picker  (hash `sprites`; one of `v:cartouche-frame`, `s:cartouche-dewit`, `p:cartouche`, or None) [verified page.js:201-212]
  Scenario: one at a time
    Given the chart at the default view
    When the user clicks the de Wit cartouche thumb (aria-label "cartouche-dewit, Dewit · scan")
    Then exactly one cartouche key remains in `sprites=`, and the previous thumb is `aria-pressed=false`
  Scenario: None
    Given the chart at the default view
    When the user clicks "None"
    Then no cartouche key is in `sprites=` and the sheet shows no cartouche (the kind is dropped, scene.mjs:2561)

Feature: Placement  (hash `placement`, default empty; values `historic`, `seeded`, `seed:<n>`; chips Default, Historic, Seeded, Re-roll) [verified page.js:101, 611-622; scene.mjs:2546-2552]
  Scenario: Seeded chip
    Given the chart at the default view
    When the user clicks "Seeded"
    Then the hash gains `placement=seeded` and the chip is checked
  Scenario: Re-roll takes a new seed and keeps it
    Given the chart at the default view and `Math.random` stubbed to return 0.5
    When the user clicks "Re-roll"
    Then the hash holds `placement=seed:1073741824` and the Re-roll chip is checked
  Scenario: the same seed gives the same arrangement
    Given the chart at `#placement=seed:12345`
    When the page loads twice
    Then both canvases are pixel-identical (by reading: nothing under `scripts/` calls `Math.random`; only Re-roll does, page.js:639 at main; no pixel test)
  Scenario: bad text reads as default
    Given the chart at `#placement=seed:99999999999` (11 digits) or `#placement=bogus`
    When the page loads
    Then the "Default" chip is checked and the first hash write omits `placement` (measured: `parsePlacement` returns `text: ''`)
    # Mismatch: Default and Historic both parse to `historical: true`; they draw the same, differing only in the hash text (`''` vs `historic`). The chip tooltips describe two behaviours.
    # Re-roll is only reachable through the chip; `seed:<n>` is typed in the hash (negative allowed, `seed:-5` parses).

Feature: Mountains  (chips `#mountains`, hash `mountains`, default `colour`, values `off|ink|colour`; scene `relief` `['marina']`/`['engraved']`/`[]`) [verified page.js:90-93, 126, 381, 524; relief.mjs:295-303]
  Scenario: ink
    Given the chart at `#map=6.00/46.500/8.000`
    When the user clicks "Ink" in Mountains
    Then the hash gains `mountains=ink` and range hatching is ink-only, no ochre wash (`engraved` has `light: land`, `shade: null`, relief.mjs:300 at main)
  Scenario: off
    Given the chart at the same view
    When the user clicks "Off"
    Then the hash gains `mountains=off` and no relief peaks are drawn over the Alps
    # `colour` is never written (it is the default); `#mountains=colour` is accepted and ignored.
    # Mismatch: this chip is the relief look (scene `relief`); "Hills" is a separate sprite choice; both live under "Land" and the hash key `mountains` does not name the hill sprites.

Feature: Trees  (chips `#trees`, hash `trees`, default `marina`, values `off|marina|ink`) [verified page.js:91, 279; trees.mjs:139-149]
  Scenario: round-trip
    Given the chart at `#map=9.00/46.000/8.000`
    When the user clicks "Ink only"
    Then the hash gains `trees=ink`
  Scenario: off removes trees
    Given the same view
    When the user clicks "Off"
    Then the hash gains `trees=off` and the green crowns disappear from the land
    # the palms drawn at points of interest keep `TREES.marina` whatever this chip says (scene.mjs:2011 at main)

Feature: Title  (chips `#titleMode` Automatic/Custom, input `#title` maxlength 40; hash `autotitle`, `title`; defaults automatic, `PORTOLANI`) [verified page.js:82-84, 372-395, 830-833; index.html:314]
  Scenario: automatic names the view
    Given the chart at `#map=7.00/38.720/-9.140`
    When the page loads
    Then `#title` is disabled and its value is the cartouche's lettering, in capitals (`pinTitle?.toUpperCase()`, scene.mjs:1676 at main)
    # after a flight (Go, a chart, a sight, an anchorage) the landing place's name is pinned on the cartouche until the map is moved by hand
  Scenario: custom, typed
    Given the chart at the default view
    When the user clicks "Custom", types `Mare Nostrum` and waits 400 ms
    Then the hash gains `autotitle=0&title=Mare+Nostrum`
  Scenario: switching to custom starts from the stored title, not the name shown
    Given the chart at the default view
    When the user clicks "Custom"
    Then `#title` is enabled and holds `PORTOLANI`, and the hash gains `autotitle=0` only
  Scenario: an older link with a title and no autotitle stays custom
    Given the chart at `#title=Old`
    When the page loads
    Then "Custom" is checked and `#title` holds `Old`
    # Mismatch: the input stops at 40 characters; the hash takes any length.

Feature: Names  (checkbox `#names`, hash `names=0` when off, default on) [verified page.js:79, 361; scene.mjs:2330-2341, 2491]
  Scenario: off hides place names
    Given the chart at `#map=7.00/43.700/7.300`
    When the user unticks Names
    Then the hash gains `names=0` and sea, coast and town names are not drawn
  Scenario: continents and regions stay
    Given the chart at `#map=3.00/40.000/10.000&names=0`
    When the page loads
    Then the continent names (EVROPA ...) are still drawn
    # Mismatch: the label "Names" reads as all lettering, but continents and regions have their own settings and draw regardless (scene.mjs:2330 comment).

Feature: Rhumb lines  (checkbox `#rhumb`, hash `rhumb=0` when off, default on) [verified page.js:80; scene.mjs:2259, 2468]
  Scenario: off hides the network
    Given the chart at the default view
    When the user unticks Rhumb lines
    Then the hash gains `rhumb=0` and the rose-to-rose lines are gone; the roses remain

Feature: Continents  (slider `#continentsZoom` 0..15 step 1; hash `continents`, default `5`; label "zoom N and out") [verified page.js:74, 82-83, 354, 523; scene.mjs:982, 1005, 2626]
  Tested by: test/hash.test.mjs — 'continents: the slider round-trips'
  Tested by: test/hash.test.mjs — 'continents: 0 is off and 15 is always'
  Tested by: test/hash.test.mjs — 'continents: a hash number past the top clamps to 15'
  Tested by: test/hash.test.mjs — 'continents: 1 reads as an older link's checked box'
  Scenario: slider round-trips
    Given the chart at the default view
    When the user sets Continents to 3
    Then `#continentsOut` reads `zoom 3 and out`, the hash gains `continents=3`
  Scenario: the extremes
    Given the chart at `#map=2.00/30.000/10.000`
    When the slider is 0, then 15
    Then 0 reads `off` (no continent names), 15 reads `always` (names at every zoom, end is Infinity)
  Scenario: an out-of-range hash number clamps
    Given the chart at `#continents=99`
    When the page loads
    Then the slider reads 15 (`zoomOf` clamps to MAX_ZOOM and rounds)
    # The layer ends at N + 0.5 (`zoomEnd`, scene.mjs:2626; drawn while zoom < N + 0.5): at default 5, the default view (zoom 5.48) still shows continents. That half zoom is deliberate (continents stay visible through 5.5), so only the label "zoom N and out" lags it; not a code mismatch.
    # Mismatch: setting the slider to 1 writes `continents=1`, which the reader treats as an older link's checked box and maps to the default 5 (page.js:74, `v === '1' ? dflt`). The value 1 does not round-trip.

Feature: Regions language  (chips `#regions`, hash `regions`, default `latin`, values `latin|english`; legacy `off`) [verified page.js:81-83, 280]
  Scenario: English names
    Given the chart at `#map=5.00/42.000/12.000`
    When the user clicks "English"
    Then the hash gains `regions=english` and "Hispania" becomes "Iberia", "Gallia" "Gaul" (scene.mjs:976-978); the continents follow, "EVROPA" becomes "EUROPE" (scene.mjs:971, 2615)
  Scenario: legacy off
    Given the chart at `#regions=off`
    When the page loads
    Then the Regions slider reads `off` (0), language stays Latin
    # Mismatch: with the Regions slider at 0 the page passes `regions: 'off'` to the scene (page.js:524), and the continents' language is taken from the regions setting (scene.mjs:2615), so Regions at "off" plus English chip draws the continents in Latin.

Feature: Regions  (slider `#regionsZoom` 0..15 step 1; hash `regionszoom`, default `7`) [verified page.js:83, 524; scene.mjs:1008, 2626]
  Tested by: test/hash.test.mjs — 'regions: the slider round-trips'
  Tested by: test/hash.test.mjs — 'regions: 1 reads as an older link's checked box'
  Scenario: round-trip
    Given the chart at the default view
    When the user sets Regions to 9
    Then `#regionsOut` reads `zoom 9 and out`, the hash gains `regionszoom=9`
  Scenario: the same pop as the continents slider
    Given `#map=7.40/40.000/12.000`
    When Regions is 7
    Then region names are drawn (zoom < 7.5); no continent name competes, since continents end at 5.5 by default, though a cartouche, rose or beast can still drop a region name
    # Mismatch: as Continents, a slider at 1 does not round-trip (`regionszoom=1` reads as the default 7).

Feature: Land border  (chips `#land`, hash `land`, default `ochre`, values `off|gilt|green|ochre`; legacy `islands`) [verified page.js:86-87, 281; scene.mjs:81, 2566]
  Scenario: green wash
    Given the chart at `#map=7.00/43.700/7.300`
    When the user clicks "Green wash"
    Then the hash gains `land=green` and the coast carries a green wash, without the ochre shoal dots
  Scenario: ochre draws shoal dots
    Given `#land=ochre` (the default)
    When the page loads
    Then a dotted line of shoals runs 4 px seaward of the coast at 6 px intervals (scene.mjs:85 `SHOAL_OFFSET`, `SHOAL_GAP`); only `ochre` draws them (`paintShoals` runs for that mode alone)

Feature: Coloured islands  (chips `#islands`, hash `islands=1`, default off) [verified page.js:86-87, 282; scene.mjs:1991, 2568]
  Scenario: on
    Given the chart at `#map=5.00/39.000/15.000`
    When the user clicks "Coloured islands"
    Then the hash gains `islands=1` and islands under the area cut are filled red, green or gold
  Scenario: legacy
    Given the chart at `#land=islands`
    When the page loads
    Then "Coloured islands" is checked, land is the default `ochre`; the legacy key is not rewritten until a control is touched

Feature: Coloured seas  (chips `#seaTint`, hash `seas=1`, default off; legacy `redsea=1`) [verified page.js:97, 283; scene.mjs:2582]
  Scenario: on
    Given the chart at `#map=5.00/30.000/40.000`
    When the user clicks "Coloured seas"
    Then the hash gains `seas=1` and the Red Sea, Black Sea, Caspian and Persian Gulf are tinted red
  Scenario: legacy key
    Given the chart at `#redsea=1`
    When the page loads
    Then "Coloured seas" is checked

Feature: Rivers  (chips `#rivers`, hash `rivers`, default `plain`, values `off|aguiar|marina|plain`) [verified page.js:88, 284; water.mjs:72-80]
  Scenario: round-trip
    Given the chart at `#map=6.00/45.000/10.000`
    When the user clicks "Wiggled ink"
    Then the hash gains `rivers=aguiar`
  Scenario: off
    Given the same view
    When the user clicks "Off"
    Then the hash gains `rivers=off` and no rivers are drawn

Feature: Lakes  (chips `#lakes`, hash `lakes`, default `marina`, values `off|aguiar|marina|plain`) [verified page.js:89, 285; water.mjs:108-143]
  Scenario: lozenges
    Given the chart at `#map=7.00/45.700/9.300`
    When the user clicks "Lozenges"
    Then the hash gains `lakes=aguiar` and Como draws as a diamond, while Maggiore, about 150 px long at this zoom, keeps its true shape (estimated from `LOZENGE_PX = 120`, water.mjs:14; not rendered)
    # lozenge vs true shape switches at 120 px, not a control

Feature: Scale bar  (chips `#scale`, hash `scale`, default `genoese`, values `off|chequer|chevron|ribbon|beads|ruled|genoese`) [verified page.js:96, 286; scene.mjs:2077-2170]
  Scenario: style
    Given the chart at `#map=6.00/43.000/10.000`
    When the user clicks "Chevron ladder"
    Then the hash gains `scale=chevron`
  Scenario: below zoom 3 there is no bar
    Given the chart at `#map=2.00/30.000/10.000`
    When the page loads
    Then no scale bar is drawn (`SCALE_MIN_ZOOM = 3`, scene.mjs:2068)
    # the "Genoese" chip is a picture sprite from the vivid pack, the others are drawn ladders (scene.mjs:2169 `SCALE_PICTURES`)

Feature: Scale bar border  (chips `#scaleBorder`, hash `scaleborder`, default `bordered`, values `bordered|blank|transparent`) [verified page.js:95, 287; scene.mjs:82, 2567]
  Scenario: transparent
    Given the chart at `#map=6.00/43.000/10.000`
    When the user clicks "Transparent"
    Then the hash gains `scaleborder=transparent` and the bar is drawn straight over the map, without parchment
  Scenario: bordered is the default
    Given the chart at the same view
    When the page loads with no `scaleborder` key
    Then the bar sits on an opaque parchment repaint with a double red rule (`bordered` is the default; `transparent` is not)

Feature: Ink  (colour input `#ink`, hash `ink`, 3 or 6 hex digits without `#`, default `3b2a1a`) [verified page.js:73-77, 148]
  Scenario: round-trip
    Given the chart at the default view
    When the user sets `#ink` to `#5a1a1a`
    Then the hash gains `ink=5a1a1a`
  Scenario: shorthand and bad values
    Given the chart at `#ink=f00`, then at `#ink=zzz`
    When each loads
    Then `#ink` shows `#ff0000`, then the default `#3b2a1a`
    # Mismatch: ink colours the lines and lettering; the wind reds and greens, rose colours, and pigments in the chart's period palette do not follow it.

Feature: Parchment  (colour input `#parchment`, hash `parchment`, default `e9d8b4`) [verified page.js:73-78, 149; scene.mjs:2626-2631]
  Scenario: round-trip
    Given the chart at the default view
    When the user sets `#parchment` to `#eeeeee`
    Then the hash gains `parchment=eeeeee` (six digits: `writeHash` slices the colour input's value, page.js:149)
  Scenario: the sheet repaints
    Given the same
    When the page places
    Then the canvas background pixels read near `#eeeeee`, a little darker and warmer at the centre and much darker at the corners (mottling, grain and a vignette multiply the colour, scene.mjs:1682-1725 at main; the pattern is fixed by seed 1539)

Feature: One mode  (tokens `--panel` #efe3c6, `--fg`, `--margin` #1d1913; no `prefers-color-scheme` in `public/`) [verified at main] (#211)
  Scenario: every drawer is parchment inside, on the dark margin
    Given the page with the browser set to dark, then to light
    When the user opens each drawer (`#open`, `#charts`, `#sights`, `#go`, `#voyages`, `#anchor`) and, for the settings drawer, each layout (default, `question`, `moods`, `sheet`)
    Then the drawer's background is `--panel` and its ink `--fg`, the margin round the map is `--margin` (`#1d1913`), and nothing visible inside a drawer has a dark background
  Scenario: the browser's light/dark setting changes nothing
    Given the same page
    When the browser's colour scheme is switched
    Then no colour on the page changes; no stylesheet or script reads `prefers-color-scheme`
    # Tested by: test/drawers.test.mjs (the last line only, offline)

Feature: Scan overlay  (charts drawer `#chartsDrawer`: under a chart whose scan is in `packs/overlays/overlays.json`, a chip `[data-overlay=<id>] .chip` (role checkbox, the scan as its glyph) "Lay the scan over the map" and, while on, a range input 0..1 step 0.05 with its percentage; hash `overlay=<id>`, default none (`null`, in pencil: a config default, adjustable), and `overlayopacity`, default `0.6` (`OVERLAY_DEFAULTS`, overlays.mjs); scene `overlay: { id, opacity }`) [page.js `showOverlay`; scene.mjs drawScene step 2.1, drawAnchored; overlays.mjs]
  Scenario: the scan laid over the map
    Given the chart at `#map=4.60/61.700/19.700`
    When the user opens the charts drawer and clicks "Lay the scan over the map" under Carta Marina
    Then the chip is `aria-checked=true`, the slider shows 60%, the hash gains `overlay=carta-marina`, and the scan is drawn over the land and under the rhumb lines, its Gotland over today's Gotland
  Scenario: opacity
    Given the chart at `#map=4.60/61.700/19.700&overlay=carta-marina`
    When the user moves the slider to 0.3
    Then the hash gains `overlayopacity=0.3` and the scan is drawn fainter when the slider pauses
  Scenario: off, and a chart without a scan
    Given the same
    When the user clicks the chip again
    Then the chip is `aria-checked=false`, the slider is hidden and `overlay` leaves the hash; the other charts show no chip
  Scenario: an id the site lacks
    Given the chart at `#overlay=nowhere`
    When the page loads
    Then the map draws as without it
  Scenario: the overlay keys round-trip through the hash
    Given the chart at the default
    When the hash is written
    Then neither `overlay` nor `overlayopacity` is in it
    Given the chart at `#overlay=carta-marina&overlayopacity=0.6`
    When the hash is read and written again
    Then the overlay is `carta-marina` at 0.6, and the hash says `overlay=carta-marina` (0.6 is the default, left out)
    Given the chart at `#overlay=nowhere`
    When the hash is read against the site's overlays
    Then the overlay is off
    # Tested by: test/overlays.test.mjs 'the overlay in the hash: ...' (offline, `overlayFromHash` and `overlayToHash`)
