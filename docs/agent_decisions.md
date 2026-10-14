# Agent decisions

Append-only. Each entry is a call an agent made in pencil: a default it took
under the one-way-door test, with its undo. Written by `agent-decision`; the
heading is the UTC stamp, so `agent_decisions.md#<stamp>` links one entry.

### 20261013t231307z
- Clip rhumb rays to the tile rect; tiles differ from main by subpixel AA on the 0.3-alpha rays (7,420 px >8/255 over 532 tiles, max 73) Undo: draw rays unclipped (restores main's pixels, ~0.6 ms/tile slower on the Pi) ([#26](https://github.com/mark-brannan/portolani/issues/26)) (no PR, branch claude/portolani-tile-rendering-85b1dd)

### 20261014t011838z
- Preview places ship whole-world with only NAME, SCALERANK, POP_MAX Undo: drop KEEP in build-preview.mjs ([#42](https://github.com/mark-brannan/portolani/pull/42))
