# Interaction

Feature: Pan  (pointer drag on `#map`) [verified page.js:665-684, 625-651; scene.mjs:325]
  Scenario: dragging east-to-west moves the centre east
    Given the chart at `#map=6.00/43.000/10.000` in a 1600 px wide viewport
    When the user drags 160 px to the left and releases
    Then lon grows and lat/zoom are unchanged; the hash updates on release, not while dragging
  Scenario: while moving, a lighter draw
    Given the same, mid-drag
    When a frame draws
    Then `#status` reads `z6.0: moving, frame N ms` (and the full placement runs on release)
  Scenario: no inertia, no threshold
    Given the same
    When the user clicks without moving
    Then the view and the hash are unchanged
  Scenario: pan stops at the poles, wraps in longitude
    Given the chart at `#map=3.00/80.000/0.000`
    When the user drags downward by 400 px
    Then lat stays within the projection's limit (`clampView`) (unverified: the exact bound)

Feature: Wheel zoom  (wheel on `#map`) [verified page.js:685-694; scene.mjs:342]
  Scenario: 300 px of delta is one zoom level
    Given the chart at `#map=6.00/43.000/10.000`
    When a wheel event with `deltaY = -300` fires at the canvas centre
    Then 300 ms later the hash holds `map=7.00/43.000/10.000`
  Scenario: line mode
    Given the same
    When a wheel event with `deltaMode = 1` and `deltaY = -1` fires
    Then the zoom changes by 16 / 300 of a level (1 line = 16 px)
  Scenario: the point under the cursor stays
    Given the same
    When the wheel fires at a point off-centre
    Then the lon/lat under that point is unchanged (zoom about the pointer)
  Scenario: bounds do nothing
    Given the chart at `#map=15.00/43.000/10.000`
    When a zoom-in wheel event fires
    Then the hash is unchanged (`moved` returns early at the bound)

Feature: Pinch zoom  (two pointers on `#map`) [verified page.js:665-679; touch.test.mjs header]
  Scenario: spread
    Given two touch pointers 100 px apart at the canvas centre
    When they move to 200 px apart
    Then the zoom grows by one level (ratio 2 = log2(2) = 1) about their midpoint, and the page itself does not zoom
    # pinch has no minimum finger distance (page.js:665)

Feature: Flight  (a Chart view, Go or Locate) [verified page.js:794-806]
  Scenario: a touch takes over
    Given a flight in progress
    When the user presses the map or turns the wheel
    Then the flight stops where it is (`cancelAnimationFrame(flight)`)
  Scenario: longitude takes the short way
    Given the chart at `#map=5/40/170`
    When the user submits Go `40, -170`
    Then the view crosses the antimeridian the short way (+20 degrees of longitude, `dlon`, page.js:797), landing at `-170.000`
