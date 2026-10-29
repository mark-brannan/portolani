# Remote islands

Feature: Remote islands  (the anchor `#anchor`, two rows in the anchor's "Seas and islands" group) [verified page.js:1147-1150 at acf745d]
  Scenario: the group and its rows
    Given the anchor drawer open
    When the user reads "Seas and islands"
    Then two buttons are among its rows, "Pukapuka Atoll" and "Pitcairn Islands", each with its date beside the name and its flavour text under it
  Scenario: Pukapuka
    Given the chart at the default view
    When the user clicks "Pukapuka Atoll"
    Then the drawer shuts and, after the flight, the view is centred on lon -138.8, lat -14.82 at zoom 6.5
    And `#title` (automatic) reads "PUKAPUKA", the row's own title, not the button's name
  Scenario: Pitcairn covers all four islands
    Given the same
    When the user clicks "Pitcairn Islands"
    Then the view is the frame lon -131.3..-124.2, lat -26.6..-22.4 via `viewOfFrame`, so Pitcairn, Henderson, Ducie and Oeno are all on the sheet
    And the cartouche reads "PITCAIRN ISLANDS"
    # the latitudes are padded so that the longitudes bind: the frame is about the window's shape (page.js:1149)
  Scenario: Go finds them
    Given the Go box open
    When the user submits `pitcairn`
    Then the view flies to the Pitcairn Islands frame (unverified: Go's matching of sight names, see going-somewhere.md; test/placename.test.mjs covers the misspelling `pitcarn` against a place list)
