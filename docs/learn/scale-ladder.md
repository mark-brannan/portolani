# The scale ladder

A portolan chart carries a linear scale bar marked in portolan miles. This map's scale bar is a ladder in that spirit: a bar of alternating divisions, its length a round number of nautical miles.

## What it measures

The ladder is true east to west at the latitude of the centre of the view, on any of the map's projections. It steps through round lengths, from 0.01 nautical miles up to 5,000. A nautical mile is 1,852 metres. Below zoom 3 there is no ladder, because on a world view one scale does not hold across the sheet.

## The styles

Four styles follow the scales of real charts: the Genoese chart of about 1320 to 1350, Martines (1584), Prunes (1559) and Beccari (1403). A fifth is a plain red and green chequer. The pages of this site do not yet describe those charts' scales; see [charts and makers](charts-and-makers.md).

## Sources

- [Portolan chart, Wikipedia](https://en.wikipedia.org/wiki/Portolan_chart) for the scale bar in portolan miles.
- [scripts/scene.mjs in this repository](https://github.com/mark-brannan/portolani/blob/main/scripts/scene.mjs) for the ladder: its steps, styles, the zoom limit and the true-scale rule.
