# Projections, and what each keeps true

A map projection cannot keep everything. It cannot be both equal-area and conformal. Pick what to keep; the rest is distorted.

- **Mercator** keeps angles (it is conformal), and so keeps rhumb lines straight. Gerardus Mercator presented it in 1569, and in the 18th century it became the standard for navigation. It inflates lands far from the equator: Greenland looks as large as Africa, which is 14 times its area.
- **Plate carrée** (equirectangular) is the simple one, with meridians and parallels evenly spaced and straight. It is neither equal-area nor conformal. The account of it that Ptolemy gives attributes it to Marinus of Tyre, about AD 100.
- **Miller** is a modified Mercator, proposed by Osborn Miller in 1942: latitude is scaled by 4/5, projected as Mercator, then multiplied by 5/4 to keep the scale along the equator.
- **Equal-area** here is the Gall-Peters, a cylindrical equal-area projection with no distortion at 45 degrees north and south. It distorts most shapes.
- **Orthographic** shows a hemisphere as seen from space. Shapes and areas distort, most near the edge.
- **Azimuthal equidistant** keeps distance and direction true from the centre.
- **Stereographic** is azimuthal and conformal.

The first four are cylindrical; the last three are azimuthal about the centre of the view. The scale at the centre is the same in all seven. Rhumb lines are straight only on Mercator; see [rhumb lines](rhumb-lines.md).

## Sources

- [Map projection, Wikipedia](https://en.wikipedia.org/wiki/Map_projection) for the choice of properties and the impossibility of equal-area and conformal together.
- [Mercator projection, Wikipedia](https://en.wikipedia.org/wiki/Mercator_projection) for 1569, navigation use and the Greenland comparison.
- [Equirectangular projection, Wikipedia](https://en.wikipedia.org/wiki/Equirectangular_projection) for the plate carrée.
- [Miller cylindrical projection, Wikipedia](https://en.wikipedia.org/wiki/Miller_cylindrical_projection) for the Miller.
- [Gall-Peters projection, Wikipedia](https://en.wikipedia.org/wiki/Gall%E2%80%93Peters_projection) for the equal-area.
- [Orthographic map projection, Wikipedia](https://en.wikipedia.org/wiki/Orthographic_map_projection) for the orthographic.
- [Azimuthal equidistant projection, Wikipedia](https://en.wikipedia.org/wiki/Azimuthal_equidistant_projection) for the azimuthal equidistant.
- [Stereographic map projection, Wikipedia](https://en.wikipedia.org/wiki/Stereographic_map_projection) for the stereographic.
- [scripts/scene.mjs in this repository](https://github.com/mark-brannan/portolani/blob/main/scripts/scene.mjs) for the seven projections and the shared central scale.
