## C. Going somewhere

Feature: Chart views menu  (anchor button `#places`, panel `#flyout`; 24 entries in `ORIGINS`) [verified page.js:700-754, 739-758]
  Scenario: pick a view
    Given the chart at the default view
    When the user clicks `#places`, then "Lisbon"
    Then the panel shuts, and after the 600 ms flight the hash holds `map=7.50/38.720/-9.140`
    And `#title` (automatic) reads the entry's own title in capitals, "LISBON" (`pinTitle`, scene.mjs:2536) (unverified: caps)
  Scenario: a frame entry
    Given the chart at the default view
    When the user picks "The North"
    Then the view is the frame lon 0..40, lat 54..72, via `viewOfFrame` (page.js:703)
  Scenario: the menu is click-driven
    Given the menu shut
    When the user clicks `#places`, then clicks outside, then reopens and presses Escape
    Then `#flyout` gains `open` on each opening and loses it on each close; opening Go shuts it (page.js:739-756)
    # Mismatch: README page.md says the flyout "opens on hover/focus"; the code opens on click only (since #202).
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
    When the user submits a Natural Earth town not in the chart views or POIs (e.g. `Genoa`) (unverified: that Genoa is not a POI)
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

Feature: My position  (button `#locate`) [verified page.js:810-824; index.html "locate"]
  Scenario: granted
    Given a browser context with geolocation `{ latitude: 43.7, longitude: 7.3 }` and permission granted
    When the user clicks `#locate`
    Then the view flies to zoom `max(current, 10)`; the hash ends `map=10.00/43.700/7.300` and a red position mark is drawn there
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
