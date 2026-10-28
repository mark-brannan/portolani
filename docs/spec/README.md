# Specs

These are specs of what the page does today, written as Gherkin so that they can become tests over time. They come from a read-only audit of the code at commit `ab47ea7` (#202): `[verified file:line]` says where the auditor read it, `(unverified)` marks a `Then` not confirmed from code, and `# Mismatch:` marks where a label and the code disagree. Paths: `page.js` = `public/page.js`, `scene.mjs` = `scripts/scene.mjs`, `index.html` = `public/index.html`; line numbers are those of `ab47ea7`, with `at main` on the few corrected since. The page has gained the charts, sights, voyages and anchorages drawers (#205, #206, #209), the `voyage` key and the corner drag of the cartouche and scale bar (#219) since; these files do not yet cover them. A `Tested by:` line marks a Feature that `test/hash.test.mjs` already covers.

- `link.md`: the URL after `#`: the view, editing it, Reset and Copy link.
- `drawer.md`: the settings drawer, one Feature per control.
- `going-somewhere.md`: Chart views, the Go box, My position, reduced motion and the phone layout.
- `interaction.md`: pan, wheel zoom, pinch zoom and flight.
- `legacy.md`: the other drawers (`?ui=`) and older hash keys.
- `developer.md`: headless options, `scripts/render.mjs`, the dev server and goldens.
- `design.md`: the design rules the user gave, each with its source and a fast test or none (#234).
