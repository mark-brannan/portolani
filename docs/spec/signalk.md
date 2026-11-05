# The Signal K webapp

The plugin's webapp (`signalk/app/`): a vessel's ENC cells drawn by portolani's scene, with the
vessel from the Signal K stream.

## Nits, as given (the user, 2026-11-04)

Recorded verbatim before the spec was written; the Features below are their spec.

1. The cartouche defaults to off.
2. Layers tab is not showing when starting up, but all layers (depth, mountains, peaks) default on.
3. The distance scale needs to be lower, all the way to the bottom left corner.
4. The catalan peaks and clusters of mounts are bad. Don't use them here at all.
5. Do import the other icon for peaks that is more angular and use it.
6. Peaks/mountains need to be labelled.
7. Bodies of water that we know about in the data should be labelled.
8. Give a choice of roses that are drawn and default to aguiar (no scans).
9. Give a choice of course up in addition to north up, use the rotate/compass icons.
10. Give a choice of the drawn town icons also.
11. Also include options for the pare and heraldic monsters.

Answers to the questions (the user, 2026-11-04): the inked 1937 ranges stay; the plugin letters names
on the map, unlike the page's tap-only tiles; every drawn town style is on at first; the peak icon is a
the monsters are a choice of Paré or heraldic. The peak icon (nit 5) is the lone ink peak, `PEAK_INK` in
`scripts/peaks.mjs`. The triangle was rejected as gross, and the main page's peaks change to the same
drawing.

## Features

Feature: The drawer is open at start
  Scenario: first load
    Given no saved settings
    When the webapp opens
    Then `#drawer` is shown and `#layers` has `aria-pressed=true`
    And Depth, Mountains and Peaks are on

Feature: The cartouche is a chip, off at first
  Scenario: first load
    Given no saved settings
    When the webapp opens
    Then no cartouche is drawn, and a Cartouche chip shows it off
  Scenario: on
    When the user turns the Cartouche chip on
    Then the de Wit cartouche is drawn

Feature: The scale bar sits in the bottom-left corner
  Scenario: any view
    When the chart is drawn
    Then the scale bar's left and bottom edges sit at the canvas's left and bottom margins, with no gap above them larger than the cartouche's corner margin

Feature: No Catalan mountain sprites
  Scenario: mountains and peaks on
    When the chart is drawn
    Then no sprite of style `catalan` (vivid `mountains-a`, `-b`, `-c`) stands anywhere, alone or in a cluster
    And the 1937 inked ranges are drawn along the mountain ranges

Feature: The landmark peak is the lone ink peak
  Scenario: plugin and page
    Given Peaks on, in the plugin or on the main page
    When the chart is drawn
    Then every landmark peak is the lone ink peak (`PEAK_INK`): a parchment-filled pointed mountain outlined and hatched in ink
    And no Catalan peak sprite stands, and a tap still opens the peak's tile

Feature: Peaks and water are lettered
  Scenario: a peak
    Given a landmark peak drawn in the view
    Then its name is lettered beside it in the chart's italic, clear of the icon
  Scenario: named water
    Given the view's cells carry named sea areas (S-57 `SEAARE` with `OBJNAM`, e.g. Elliott Bay)
    When the chart is drawn
    Then each name is lettered once inside its area, in the water style, and none overlaps another name or the cartouche or scale bar

Feature: Roses are a choice of the drawn ones
  Scenario: the chips
    Given the drawer open
    Then a Roses group offers None and each drawn (vivid) rose style, Aguiar, Martines, Oliva, Brouscon, Fleurs and Dieppe, each chip showing its rose
    And Aguiar is chosen at first, and no scanned rose is offered

Feature: Towns are a choice of the drawn styles
  Scenario: the chips
    Given the drawer open
    Then a Towns group offers each drawn (vivid) town style, Aguiar and Martines, as on/off chips showing a town, and all are on at first; all off is none
  Scenario: towns drawn
    Given the view's cells carry built-up areas (S-57 `BUAARE`)
    Then the chosen town drawings stand on them

Feature: Monsters are a choice of Paré or heraldic
  Scenario: the chips
    Given the drawer open
    Then a Monsters group offers None, Paré (scanned) and Heraldic (drawn), each chip showing a monster, one chosen at a time
    And Heraldic is chosen at first
  Scenario: chosen
    When the user picks Heraldic
    Then heraldic monsters are drawn in the cells' open water only

Feature: North up or course up
  Scenario: the gutter button
    Given the gutter
    Then a compass button shows the mode: north up shows the compass needle, course up the rotate icon
  Scenario: course up
    Given the vessel's course over ground from the stream
    When the user switches to course up
    Then the chart turns so the course points to the top of the window, and turns again as the course changes
  Scenario: back to north up
    When the user switches again
    Then north is at the top
