# Rhumb lines and wind roses

A rhumb line crosses every meridian at the same angle. Hold that bearing and you follow it. It is usually not the shortest route; that is the great circle.

## On a portolan chart

The network that spreads across a portolan chart comes from wind roses placed at points on the sheet. The lines stand for the 16 directions of the mariner's compass, which became 32 from about 1450. The Catalan Atlas of 1375 was the first to put compass roses at the centres of these networks.

Historians call these "windrose lines" rather than rhumbs. The art historian Leo Bagrow wrote that "loxodromic" is wrongly applied to the charts of this period, since a true course comes from a line only on a suitable projection. Later measurement showed that his claim that the charts use no projection at all does not hold; most analyses linked their geometry to the Mercator projection, and more recent work to projections known in antiquity.

## Where the rose comes from

The word rose names a diagram of directions. The Greeks kept winds and cardinal points apart at first, then merged them. Timosthenes of Rhodes added two winds to Aristotle's ten, giving the classical 12-wind rose. Arab navigators of the Red Sea and Indian Ocean used a 32-point rose of stars before the end of the 10th century.

## Straight on one projection, bent on another

On a Mercator projection every rhumb line is straight. That is the projection's defining property. Pedro Nunes first discussed the path of a rhumb line on a globe in 1537. On a stereographic projection a rhumb line is a spiral about the pole. The map's other projections do not keep it straight, and the chart draws it bowed. See [projections](projections.md).

## Sources

- [Portolan chart, Wikipedia](https://en.wikipedia.org/wiki/Portolan_chart) for the roses, the line count, Bagrow and the projection research.
- [Rhumb line, Wikipedia](https://en.wikipedia.org/wiki/Rhumb_line) for the definition, Nunes and the Mercator and stereographic cases.
- [Compass rose, Wikipedia](https://en.wikipedia.org/wiki/Compass_rose) for the Greek, Timosthenes and Arab sidereal roses.
- [scripts/scene.mjs in this repository](https://github.com/mark-brannan/portolani/blob/main/scripts/scene.mjs) for how the chart draws the lines on each projection.
