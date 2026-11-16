# games/match3/  —  Match Killer tiles

**The only art this game needs is the matching tiles.** The board, specials, effects, text and background are all drawn in code. Any tile you haven't made yet is drawn as a colored shape, so you can add them one at a time.

## Tiles

| | |
|---|---|
| **Names** | `tile-1.png`, `tile-2.png`, `tile-3.png`, `tile-4.png`, `tile-5.png`, `tile-6.png` |
| **Size** | **128 × 128** square, transparent background |
| **How many** | **6** by default. Set `types` in `js/content.js → games.match3` to match what you make: 5 = easier, 6 = classic, 7 = harder. Don't go below 4 (the board fills itself with matches) |

Tips that make or break a match-3:
- **Make each tile readable at a glance by shape AND color.** On a phone each tile is only about 1 cm wide, so two similar-colored tiles need different silhouettes.
- Fill about 85–90% of the square. The game leaves a small gap around each tile.
- Keep a dark outline. Tiles sit on a dark purple board.
- Specials are drawn **on top of your tile**: white stripes for LINE tiles and a glowing ring for BOMB tiles. Leave the middle of the tile fairly simple so the stripes read.

## Optional

| File | What | Size |
|---|---|---|
| `tile-special.png` | The STAR tile (made by matching 5) | 128 × 128 transparent |
| `background.png` | Replaces the drawn purple background | 720 × 1280 portrait |

## Sounds (all optional, MP3, short)

`swap.mp3` · `bad.mp3` (swap that doesn't match) · `match.mp3` (plays faster up a chain reaction) · `special.mp3` (special tile made) · `blast.mp3` (special tile goes off) · `shuffle.mp3` · `clear.mp3` (board clear) · `over.mp3` · `start.mp3`

## Icon

The home screen icon goes in `media/icons/match3.png` (96 × 96, transparent).
