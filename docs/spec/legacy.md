# Other drawers and older links

Feature: Presets drawer  (query `?ui=presets`, not hash) [verified page.js:408-482]
  Scenario: choosing a preset
    Given the chart at `?ui=presets#map=...`
    When the user clicks "Bare chart"
    Then the selection becomes a vivid rose and cartouche, `sprites=` lists them, and no monsters, ships or towns are drawn
  Scenario: a preset reads as checked
    Given the chart at `?ui=presets` with the default selection
    When the page loads
    Then the "Everything" chip has `aria-checked=true`; the other four (Scans, Drawn, Plain, Bare chart) do not
  Scenario: switches
    Given the same
    When the user clicks the "Monsters" switch
    Then every monster key leaves `sprites=`; clicking again restores the default monster keys
  Scenario: style switches share the drawer's controls
    Given the same
    When the user clicks the "Rivers" switch
    Then `rivers=off` is in the hash; clicking again restores the default `plain` (page.js:475-480)
  Scenario: the query survives
    Given `?ui=presets`
    When any control changes, Reset runs, or Copy link is pressed
    Then `location.search` is unchanged (hash writes use `#...` only)

Feature: Grid drawer  (query `?ui=grid`) [verified page.js:483-510]
  Scenario: whole kind
    Given the chart at `?ui=grid`
    When the user presses "All" under Monsters
    Then every monster key leaves `sprites=` if all were on, else every one joins
  Scenario: a family chip
    Given the same
    When the user presses a family chip
    Then it reads `aria-checked` true, mixed or false and shows `on/total` counts

Feature: Unknown ui flag  (`?ui=other`) [verified page.js:408]
  Scenario: ignored
    Given the chart at `?ui=other`
    When the page loads
    Then the default drawer shows and `#ui` stays hidden

Feature: Legacy hash keys, rewritten on load  (`rendering`, `pack`, `rose`, `monster`, `town`, `kinds`) [verified page.js:62-65, 107-117, 513]
  Scenario: an older `pack` link becomes a sprites list
    Given the chart at `#pack=plain`
    When the page loads
    Then the first rewrite drops `pack` and gains `sprites=p:rose,p:cartouche` (no towers; `LEGACY_PACK`: `all, vivid` -> vivid; `catalan, carta-marina` -> scanned; `plain` -> plain; measured with `chooseSprites`)
  Scenario: `sprites` wins
    Given the chart at `#sprites=s:serpent-a&pack=plain`
    When the page loads
    Then the selection is `s:serpent-a` and the rewritten hash carries no `pack`
  Scenario: kinds default
    Given the chart at `#rendering=vivid`
    When the page loads
    Then the mountain kind is not in the selection (older links never drew mountains, page.js:112)

Feature: Legacy hash keys, read but not rewritten at load  (`relief`, `redsea`, `land=islands`, `regions=off`, `continents=1`, `regionszoom=1`) [verified page.js:82-93, 97]
  Tested by: test/hash.test.mjs — 'continents: 1 reads as an older link's checked box'
  Tested by: test/hash.test.mjs — 'regions: 1 reads as an older link's checked box'
  Scenario: relief maps to mountains
    Given the chart at `#relief=marina`, then `#relief=engraved`, then `#relief=xyz`
    When each loads
    Then Mountains reads Colour, then Ink, then Off, in each case only when `mountains` is not `off` or `ink`
  Scenario: stays until touched
    Given the chart at `#relief=engraved`
    When the page loads
    Then `location.hash` still holds `relief=engraved` (not in `LEGACY_KEYS`); touching any control writes the new form (`mountains=ink`) and drops `relief`
    # The page.js header names only the six `LEGACY_KEYS` as rewritten; `relief`, `redsea` and `land=islands` are read but left in place, which the header does not claim otherwise.
