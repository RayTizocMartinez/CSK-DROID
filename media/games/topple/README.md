# games/topple/  —  Mask Stack

Everything in this game is drawn in code: the blocks in their colored ski masks, their faces, the stage and the brick wall. Nothing here is required.

| File | Size | Notes |
|---|---|---|
| `bg.png` | **720 × 1280** (optional) | Replaces the brick wall. It stays still while the tower scrolls, and it's cropped to fit, so keep the important stuff in the middle |

## Optional sounds (MP3)
`land.mp3` (block lands, louder for harder hits) · `drop.mp3` · `spin.mp3` · `lose.mp3` (a block falls off) · `level.mp3` (every 5 blocks tall) · `over.mp3` · `start.mp3`

## How it plays
Drag to move the block, tap to spin it, let go after dragging to drop it. Tilting the phone sways the tower. On a computer: arrow keys tilt, Up/Space spins, Down drops.

iPhones ask once for permission to use tilt (only works when the site is on https, like GitHub Pages). If someone says no, the game still works; there's just no tilting.

## Tuning
Lives, stage width, tilt strength and bounciness are in `js/content.js → games.topple`.

Physics by Matter.js (MIT license, `js/lib/matter-LICENSE.txt`).
