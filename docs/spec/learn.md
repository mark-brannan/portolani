# Learn links

Feature: Learn links in the drawer  (a `p.lead[data-lead-for]` above a control group, ending "Learn more" with a relative link to `learn/<page>.html`; pages built from `docs/learn/*.md` by `scripts/learn.mjs`) [verified index.html:366-489, page.js:807-810, scripts/learn.mjs:55 at acf745d]
  Scenario: which group links where
    Given the settings drawer open in the Default layout
    Then the seven lead paragraphs link as follows
      | lead for  | page                          |
      | monsters  | learn/sea-monsters-and-ships  |
      | roses     | learn/rhumb-lines             |
      | rhumb     | learn/rhumb-lines             |
      | towns     | learn/portolan-charts         |
      | mountains | learn/portolan-charts         |
      | colours   | learn/portolan-charts         |
      | cartouche | learn/charts-and-makers       |
  Scenario: each link has a page
    Given the built site
    Then every `learn/*.html` a lead names exists in `_site/learn/` (one per `docs/learn/*.md`; the index page also exists, and `projections` and `scale-ladder` are not linked from the drawer)
  Scenario: the link leaves the map
    Given the drawer open
    When the user follows "Learn more"
    Then the browser opens the Learn page, whose nav has "Back to the map" (`../`, which opens the default view without the hash); the browser's Back returns to the map as it was
  Scenario: the lead moves with its control
    Given the layout chip "By the sheet" or "Moods"
    When the layout changes
    Then each lead travels with the control group it is `data-lead-for`, and returns to its place under Default

Feature: Source captions under chip groups  (`p.caption` after the chip row; text from `CAPTIONS`) [verified page.js:380-420 at acf745d]
  Scenario: caption with source links
    Given the drawer open
    Then Hills reads "After the Catalan Atlas, conventionally dated 1375, by Cresques Abraham of Mallorca." with each chart or maker a link to Wikipedia or Wikimedia Commons
    And each such link opens in a new tab (`target=_blank`, `rel="noopener noreferrer"`)
  Scenario: where the caption sits
    Given the Coloured seas chips, which share a row with Coloured islands
    Then the caption follows that whole row, not the Coloured seas chips alone
  Scenario: groups that carry a caption
    Then captions follow: Mountains, Hills, Regions, Trees, Land border, Coloured seas, Rivers, Lakes and Scale bar border
  Scenario: the 1375 names name their sources
    Given the drawer open at Regions
    Then the caption reads "1375: the realms the Catalan Atlas names, in its own spelling or read in English, from its legends as the Cresques Project translates them." with the Catalan Atlas linking to Wikipedia and the Cresques Project to its translations of the legends
    And the Learn page "The charts and makers behind the ornaments" says, under the Catalan Atlas, that the region names of 1375 come from it, and lists the Cresques Project and BnF Gallica among its sources
