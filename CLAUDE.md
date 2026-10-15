# Portolani

- **A new visual decoration ships on by default**: a sprite kind, a style, a drawn feature. Put it in the page's `DEFAULTS` and in `defaultSprites`, unless the user asks otherwise, for example by raising it as a concern on the PR.
- **Headless scene options** (`relief`, `trees`, `rivers`, `lakes`) stay off by default, so each golden isolates one thing.
- **No dropdowns** in the settings drawer where icons, chips or checkboxes will do.
- **Option lists are chips**, not dropdowns or plain lists, and each chip shows what it does.
- **Every control shows its effect** where it can (a swatch, a line sample or a small example), not only a label.
- **Every PR body carries a way to demo it**: a live URL, or one command the user can run.
- **A scanned sprite is a soft-edged patch of the scan, not its ink alone.** Draw an outline round the figure (a polygon, an ellipse, a wide silhouette), feather it, and keep everything inside: the sea a ship sits in, the swirling waves concealing a leviathan, the grass under a tree, the hatching round a village. Round a monster the water is the big one: take all of it and every scale of the beast rather than trim a little water and lose any of the monster. Divide the paper out and let the renderer's multiply blend sink the patch into the parchment. Never key by darkness levels on a coloured plate: it thins every wash and loses the surroundings, and the user would rather see the raw crop on the map than that. Levels key a pack drawn in ink alone, where nothing but line is wanted.
- **A sprite PR shows the before and the after as the map draws them**: the raw crop beside the sprite at map size, multiplied onto parchment, one row per sprite (a `steps.png` under `docs/<scan>/`). A plain composite on parchment is not the after; the multiply is.
