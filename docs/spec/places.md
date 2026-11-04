# Remote islands

Feature: Remote islands  (the anchor `#anchor`, two of the seven rows in the anchor's "Seas and islands" group, which is folded until its heading is clicked: only the first group marked open, "Regions", is open at first) [verified against main, 2026-11-02]
  Scenario: the group and its rows
    Given the anchor drawer open
    When the user opens the group "Seas and islands"
    Then two buttons are among its seven rows, "Pukapuka Atoll" and "Pitcairn Islands", each with its date beside the name and its flavour text under it
  Scenario: Pukapuka
    Given the chart at the default view
    When the user clicks "Pukapuka Atoll"
    Then the drawer stays open and, after the flight, the view is centred on lon -138.8, lat -14.82 at zoom 6.5
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
    Then the view flies to the Pitcairn Islands frame
  Tested by: test/placename.test.mjs — 'Go flies "pitcairn" to the Pitcairn Islands frame, not the Adamstown point'
