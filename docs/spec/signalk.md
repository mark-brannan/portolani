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
on the map, unlike the page's tap-only tiles; the monsters are a choice of Paré or heraldic. The peak icon (nit 5) is the lone ink peak, `PEAK_INK` in
`scripts/peaks.mjs`. The triangle was rejected as gross, and the main page's peaks change to the same
drawing.

## Nits on the nits, as given (the user, 2026-11-04)

1. The layers drawer in the top right must not start out displayed. It starts out CLOSED!
2. I want the drawers autoclose after moving the mouse away from them (make sure there is a good mobile version of this too).
3. The roses should be the full set from aguiar and the other drawn variants. When you select one from the list, it does all the drawn roses from the aguiar set, and varying them. The rose density should not be too high and the rules for drawing roses and rhumb lines should follow the same logic as #393.
4. Towns off by default now. This is temporary. However, I do want us to import the other drawn town shapes which included the tower, the church, etc.
5. I expect a separate compass and a separate rotate button and a separate follow vessel course.

Answers to the questions (the user, 2026-11-04): auto-close is the webapp's alone; roses are one style
at a time, every drawn rose of that style used; the rose meant is the drawn Catalan one, which the packs
file under the Aguiar style; the towns are every drawn town sprite, Aguiar, Martines, the Carta Marina's
buildings and the towers drawn in code.

## Features

Feature: The drawer is closed at start, and closes itself
  Scenario: first load
    Given no saved settings
    When the webapp opens
    Then `#drawer` is hidden and `#layers` has `aria-pressed=false`
    And Depth, Mountains and Peaks are on
  Scenario: the pointer leaves
    Given the drawer open, with a mouse or pen
    When the pointer leaves the drawer and the Layers button
    Then the drawer closes half a second later, unless the pointer comes back first
  Scenario: a finger
    Given the drawer open, on a touch screen
    When the user taps the chart
    Then the drawer closes, and that tap does nothing else
  Scenario: the keyboard
    When the user presses Escape
    Then the drawer closes

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
    Then the scale bar sits in the bottom-left corner, and its gap to the canvas's bottom edge equals its gap to the left edge

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
    Then a Roses group offers None and each drawn (vivid) rose style, Catalan, Aguiar, Martines, Oliva, Brouscon, Fleurs and Dieppe, each chip showing its rose, one chosen at a time
    And Catalan is chosen at first, and no scanned rose is offered
  Scenario: a style chosen
    When the user picks a style
    Then every drawn rose of that style stands, large and small, varied from sheet to sheet
    And the roses and rhumb lines stand on the atlas's sheets and window rings as on the page (docs/atlas/README.md), the monsters on the cells' own water

Feature: Towns are a choice of the drawn styles
  Scenario: the chips
    Given the drawer open
    Then a Towns group offers each drawn town style, Aguiar, Martines, Carta Marina (its house, church, castle, round tower and tent) and the towers drawn in code, as on/off chips showing a town; all off is none
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

Feature: Follow, course up and the compass are three buttons
  Scenario: the gutter
    Given the gutter
    Then under Layers stand a follow button (a vessel arrow), a course up button (the rotate icon) and a compass, each its own
  Scenario: follow
    When the user presses follow
    Then the arrow fills, the chart centres on the vessel and keeps it centred as it moves, and a zoom keeps it at the centre
    And a pan by hand stops following, and the arrow empties
  Scenario: course up
    Given the vessel's course over ground from the stream
    When the user presses course up
    Then the button shows pressed, and the chart turns so the course points to the top of the window, and turns again as the course changes
  Scenario: back to north up
    When the user presses course up again, or the compass
    Then north is at the top
  Scenario: the compass
    Given any bearing
    Then the compass needle points to north on the chart as drawn
