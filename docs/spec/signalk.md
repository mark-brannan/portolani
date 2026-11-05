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

## The gutter's buttons, as given (the user, 2026-11-04)

The navigation buttons still do not function as expected. I expect the arrow to toggle follow vessel and when
enabling it, to center on the vessel. I expect the compass to toggle north up, but to allow free rotation of the
map. I expect if there are rotation buttons for there to be two, and to allow any cardinal direction to be 'up'.

Answers to the questions (the user, 2026-11-04): "the follow button controls follow. The rotate buttons should
never have had anything to do with follow"; free rotation is by gesture, to any angle; the compass locks and
unlocks north up; "I want TWO rotate buttons, not one. Rotate clockwise and counter clockwise".

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

Feature: Follow, the compass and two rotate buttons
  Scenario: the gutter
    Given the gutter
    Then under Layers stand follow (a vessel arrow), rotate counter-clockwise, the compass and rotate clockwise, each its own button
    And none of the three turning controls reads the vessel or its course
  Scenario: follow on
    Given follow off
    When the user presses follow
    Then the arrow fills and the chart centres on the vessel at once, and keeps it centred as it moves
    And a zoom or a turn keeps the vessel at the centre
    And with no position yet the arrow fills and the chart centres on the first fix
  Scenario: follow off
    Given follow on
    When the user presses follow, or pans by hand
    Then the arrow empties and the chart stays where it is
  Scenario: rotate
    When the user presses rotate clockwise
    Then the chart turns clockwise to the next cardinal direction up: north up, then west, south, east
    And rotate counter-clockwise turns it the other way: north, east, south, west
    And from a bearing between two cardinals it turns to the nearer one in that direction
    And the compass unlocks
  Scenario: free rotation
    Given a touch screen, or a mouse
    When the user twists two fingers, or drags with the right button or with Ctrl held
    Then the chart turns with them to any angle, and the compass needle follows
    And a twist under 10 degrees while north up is locked is a pinch alone, and does not turn the chart
  Scenario: the compass locks north up
    Given the chart turned to any bearing
    When the user presses the compass
    Then it shows pressed and north is at the top
    When the user presses it again
    Then it shows unpressed and the chart turns back to the bearing it had
  Scenario: the compass needle
    Given any bearing
    Then the compass needle points to north on the chart as drawn
