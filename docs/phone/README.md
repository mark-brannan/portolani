# The page on a phone

An account of what broke on a phone ([#109](https://github.com/mark-brannan/portolani/issues/109)), what shipped and what is still open.

## What broke

| Bug | Cause | Shipped in |
|---|---|---|
| Pinch zoomed the page, not the map | The shut Go flyout's box sat over the map; the map was a third-height band. | [#166](https://github.com/mark-brannan/portolani/pull/166), [#262](https://github.com/mark-brannan/portolani/pull/262) |
| The flyout never closed | It opened on `:hover`, which a tap leaves stuck. | [#166](https://github.com/mark-brannan/portolani/pull/166) |
| Locate behaved oddly | It left the flyout open over the map, and focused the box, raising the keyboard. | [#166](https://github.com/mark-brannan/portolani/pull/166), [#262](https://github.com/mark-brannan/portolani/pull/262) |
| The layout was wrong at phone width | The canvas shrank to a 225 px band at 360 px, with unreadable lettering. | [#167](https://github.com/mark-brannan/portolani/pull/167), [#262](https://github.com/mark-brannan/portolani/pull/262) |

## What shipped

- **#166**: the flyout opens by a places button on touch, by hover only where the device hovers, and shuts after a choice.
- **#167**: under 520 px the settings drawer is a half-height bottom sheet, with the map shrunk above it.
- **#262**: the map fills the window, cropped at its sides; Find my position no longer focuses the box.
- **#292**: a choice or a tap on the map leaves the drawer open; this reverses #262's shut-on-tap.
- **#313**: the voyage fit uses the window's rectangle, so a voyage's track is framed inside what a phone shows.

Where #167 and #262 differ, #262 holds for the map (it fills the window); the screenshots below are #167's, taken before that, so they show the map shrunk above the sheet.

| | closed | open |
|---|---|---|
| 360 | ![360 closed](phone-360-closed.png) | ![360 open](phone-360-open.png) |
| 412 | ![412 closed](phone-412-closed.png) | ![412 open](phone-412-open.png) |

## Not yet verified

- The pinch fix is tested with emulated touches only (headless Chromium, synthetic two-finger events). iOS Safari and Android Chrome may treat real fingers differently. It needs a try on a real phone.
- On a 3x phone the canvas shows at about 2 device pixels per canvas pixel, so lines may look soft. That is a guess, not measured.
- The refusal message for Find my position was not exercised.

## Still proposed

- **Position chips in the Charts drawer on a phone**: they sit in the chart's row as on a wide screen until the user has walked the phone's drawers (`docs/spec/design.md`, "a phone (waiting on a UI walk)").
- **Hover-to-open groups**: whether a group opens as the pointer nears it, and how a phone differs, waits until the user has seen it demoed both ways.
- **A canvas shaped like the phone** instead of cropping the 1600 by 1000 scene: a much bigger change to the scene's fixed size, not started.
