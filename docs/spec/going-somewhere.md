# Going somewhere

Feature: Places to fly to  (the astrolabe `#sights`, 26 rows of sights and sections; the anchor `#anchor`, 14 anchorages; the chart `#charts`, 7 charts with "Where it was made" and "The sheet"; each a drawer in the `#where` row) [verified page.js:585, 786-830 at main]
  # The audit at ab47ea7 read one anchor button `#places` with a `#flyout` of 24 `ORIGINS`; #206 and #209 split it into these three drawers. Their contents are not yet specified here.
  Scenario: pick a sight
    Given the chart at the default view
    When the user clicks `#sights`, then "Lisbon"
    Then the drawer shuts, and after the 600 ms flight the hash holds `map=7.50/38.720/-9.140`
    And `#title` (automatic) reads the entry's own title in capitals, "LISBON" (`pinTitle?.toUpperCase()`, scene.mjs:1676 at main)
  Scenario: a frame entry
    Given the chart at the default view
    When the user picks "The North"
    Then the view is the frame lon 0..40, lat 54..72, via `viewOfFrame` (unverified: the entry's drawer and bounds at main)
  Scenario: the drawers are click-driven
    Given every drawer shut
    When the user clicks `#sights`, then clicks outside, then reopens and presses Escape
    Then the drawer opens on each click and shuts on each close; opening another instrument shuts it; hovering opens nothing (touch.test.mjs:214)
  Scenario: pin ends on a hand move
    Given a flight to "Lisbon" has landed (automatic title)
    When the user drags the map
    Then the cartouche lettering stops naming Lisbon and follows the scoring again

Feature: Go box  (button `#go`, input `#coordsText`, form `#coords`) [verified page.js:760-806; index.html "goPanel"]
  Scenario: latitude, longitude
    Given the chart at the default view
    When the user opens Go and submits `36.28, -76`
    Then the view flies to lat 36.28, lon -76 at zoom `max(current, 10)`; the hash ends `map=10.00/36.280/-76.000`
  Scenario: with hemisphere letters
    Given the same
    When the user submits `36.28N 76W`
    Then the target is the same; `36.28S 76W` is lat -36.28
    # a sign and a letter that disagree (`-36 N`), a lat over 90, a lon over 180 are not positions, and fall to the name search
  Scenario: a place name
    Given the same
    When the user submits `Lisbon`
    Then the view flies to the Lisbon chart view (zoom 7.5), not the town (zoom 8)
  Scenario: a town name
    Given the same
    When the user submits a Natural Earth town that is not a sight, chart or anchorage (e.g. `Bari`; `Genoa` is a sight, so it flies to the chart view instead)
    Then the view flies to it at zoom 8 with its name on the cartouche
  Scenario: a miss
    Given the same
    When the user submits `zzzz`
    Then `#goMiss` is visible, reads `No place called “zzzz”`; typing in the box hides it
    And submitting an empty box reads `Type a place, or latitude, longitude: 36.28, -76`
  Scenario: the order of search
    Given a name shared by a chart view, a POI and a town
    When submitted
    Then the chart view wins, then the POI, then the bigger town first (`SCALERANK` order) (page.js:768-775)

Feature: My position  (button `#locate`, inside the Go drawer) [verified page.js:933-950 at main; touch.test.mjs:111]
  Scenario: granted
    Given a browser context with geolocation `{ latitude: 43.7, longitude: 7.3 }` and permission granted
    When the user clicks `#locate`
    Then `#coordsText` is filled with `43.7000, 7.3000` and focused; nothing flies and no mark is drawn. Submitting Go then flies to zoom `max(current, 10)` and the hash ends `map=10.00/43.700/7.300`
    # The audit at ab47ea7 read a flight and a red position mark here; at main the position only fills the Go box.
  Scenario: refused
    Given geolocation permission denied
    When the user clicks `#locate`
    Then `#status` reads `My position: not allowed` and `#locate` is enabled again
  Scenario: unavailable
    Given a page with no `navigator.geolocation`
    When the page loads
    Then `#locate` is hidden

Feature: Reduced motion  (OS setting `prefers-reduced-motion`) [verified page.js:796]
  Scenario: a jump, not a flight
    Given `prefers-reduced-motion: reduce`
    When the user picks a Chart view
    Then the hash holds the target immediately (the flight length is 0 ms)

Feature: Phone layout  (viewport 520 px or narrower) [verified page.js:40, 519-528, 551-566; touch.test.mjs header]
  Scenario: cards
    Given a 360 px wide viewport and the default view
    When the page loads
    Then `#cardCartouche` and `#cardScale` are visible and the sheet carries neither; the drawer is a bottom sheet at half height
  Scenario: crossing the breakpoint
    Given a wide viewport
    When it narrows past 520 px
    Then the sheet is placed again without the cartouche and scale bar (the `phone` change handler, page.js:571)
