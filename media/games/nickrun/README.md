# games/nickrun/  —  Nick Run sprites

Only Nick is art. The city, rooftops, jars, pigeons and effects are drawn in code. Missing sprites use a stick-figure stand-in.

| File | Size | Notes |
|---|---|---|
| `nick-run.png` | **128 × 128** for one pose, **or a strip** of frames side by side, e.g. **512 × 128** for 4 frames | The game counts frames by itself (width ÷ height), so frames must be square. Facing **right**, transparent background, **feet touching the bottom edge** |
| `nick-jump.png` | **128 × 128** | Same scale and framing as the run frames |

- Only one run pose? It bobs while running, so it still looks alive.
- Strips play at running speed: faster running = faster cycle. 4–8 frames is the sweet spot.
- Nick is drawn 40 units tall on a 320-wide screen. Leave a little room around him inside each frame, but not much.
- `.jpg` works too, but PNG keeps the background see-through.

## Optional sounds (MP3)
`jump.mp3` · `land.mp3` · `smash.mp3` (hit a jar) · `fall.mp3` (game over) · `start.mp3` · `flap.mp3` (pigeons)

## Tuning
Speed, acceleration, how much jars slow him and how often they show up are in `js/content.js → games.nickrun`.
