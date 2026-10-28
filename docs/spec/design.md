# Design rules

The behaviour specs beside this file say what the page does. These say what the user asked the page to be, on style and on design, so the rules outlive the threads they were given in. Each Feature carries a `Source:` line (where the rule was given) and a `Test:` line (a fast, offline test that checks it, or `none`). A quote is the user's words; anything marked *paraphrase* is the recorder's wording of a rule given without a verbatim sentence. Every rule here is current thinking until the user marks it firm.

Feature: One mode only
  Source: [#211](https://github.com/mark-brannan/portolani/pull/211) (paraphrase: one mode, dark margins round the map, parchment inside every drawer, "allowing for a stub" for a low-light mode); the stub: docs/decisions.md 2026-10-21, "Don't delete this.  I want stubs for things much of the time and this one I asked for on purpose" ([#211](https://github.com/mark-brannan/portolani/pull/211#discussion_r4332694498))
  Test: test/drawers.test.mjs — 'no prefers-color-scheme rule anywhere in public/'
  Scenario: the browser's light/dark setting is not followed
    Given a browser set to dark mode, and another set to light
    When each opens the chart and opens a drawer
    Then both show the same page: the dark `#1d1913` margin round the map, parchment inside the drawer
    And the low-light mode's empty rule and its comment stay in the stylesheet as a stub

Feature: The cartouche and the scale bar keep to the window
  Source: docs/decisions.md 2026-10-14, "pinned to the screen." ([#107](https://github.com/mark-brannan/portolani/issues/107)); the corner and the drag: [#219](https://github.com/mark-brannan/portolani/pull/219) (paraphrase)
  Test: none
  Scenario: pan leaves them in place; a drag moves them to a corner
    Given the chart with the cartouche and the scale bar drawn
    When the user pans the map
    Then each stays in its corner of the window while the map slides under it
    When the user drags either one toward another corner and lets go
    Then it takes the nearest corner, and the link keeps that corner

Feature: Drawer controls are chips that show their effect
  Source: repo CLAUDE.md, "No dropdowns in the settings drawer where icons, chips or checkboxes will do."; "Option lists are chips, not dropdowns or plain lists, and each chip shows what it does."; "Every control shows its effect where it can (a swatch, a line sample or a small example), not only a label."
  Test: none
  Scenario: an option list in a drawer
    Given any drawer opened
    When the user looks at a control with a set of options
    Then the options are chips, icons or checkboxes, not a dropdown or a plain list
    And each chip or control shows its effect (a swatch, a line sample or a small example) where it can, not only a label

Feature: A point of interest opens a tile, never lettering
  Source: docs/decisions.md 2026-10-21, "my preference is as a 'click' or 'tap' on mobile, then a little educational popover tile appears nearby the point of interest"; "a major landing, a death/confrontation, a location where maps were made, whatever we decide is a point of interest should get a tile with flavor text." ([#212](https://github.com/mark-brannan/portolani/pull/212#discussion_r4332019539))
  Test: none
  Scenario: click or tap a point of interest
    Given the chart with a point of interest drawn (a voyage's skull, a landing, a place where maps were made)
    When the user looks at it without touching it
    Then no text is drawn beside the mark, as cities and regions have
    When the user clicks it, or taps it on a phone
    Then a small tile of flavour text opens near it

Feature: New decorations ship on; headless scene options stay off
  Source: repo CLAUDE.md, "A new visual decoration ships on by default: a sprite kind, a style, a drawn feature. Put it in the page's `DEFAULTS` and in `defaultSprites`, unless the user asks otherwise, for example by raising it as a concern on the PR."; "Headless scene options (`relief`, `trees`, `rivers`, `lakes`) stay off by default, so each golden isolates one thing."
  Test: test/styles.test.mjs — 'defaultSprites follows its rule, so a sprite added to a pack joins or stays out by family' (the sprite half only; the headless half has none)
  Scenario: the page and the headless renderer start differently
    Given a decoration added in a PR, with no concern raised on it
    When the page opens at its defaults
    Then the decoration is drawn
    When `scripts/render.mjs` renders a scene with no options
    Then `relief`, `trees`, `rivers` and `lakes` are off

Feature: A scanned sprite is the whole crop, feathered
  Source: repo CLAUDE.md, "A scanned sprite is a soft-edged patch of the scan, not its ink alone." and "The raw crop is the bar."; docs/decisions.md 2026-10-14, "in all cases (or nearly all) I would rather see the raw image on the portolani map than the one we scanned and filtered"; "I would rather have all of the water and keep all of the monster detail, than trim a little water and loose any monster details." ([#104](https://github.com/mark-brannan/portolani/pull/104), [#111](https://github.com/mark-brannan/portolani/issues/111), [#112](https://github.com/mark-brannan/portolani/pull/112#discussion_r4277791146))
  Test: none
  Scenario: a ship or a monster cut from a coloured plate
    Given a crop of a ship or a monster from a coloured scan
    When it is drawn on the map, multiplied onto the parchment
    Then the sea round it, the swell and the ripples come with it, the most water below the figure
    And its feathered edge sits outside the ink, never across a tail tip or a yard
    And nothing is keyed out by darkness levels
    And the sprite PR shows the raw crop beside the sprite at map size, naming with a reason anything the raw has that the sprite lacks

Feature: No icon removed, no section gone, until the reorg
  Source: docs/decisions.md 2026-10-20, "No icons may be removed right now. No section may "go". I intend to do a larger reorg of the sections and drawers at some point because the rose drawer has too much random stuff and the others are not well defined or divided." ([#225](https://github.com/mark-brannan/portolani/issues/225))
  Test: none
  Scenario: a PR that touches the drawers
    Given the instrument buttons and drawer sections on main
    When a PR changes a drawer, before the larger reorg
    Then every instrument button and every drawer section on main is still there after it
