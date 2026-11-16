# games/balloons/  —  Balloon Heist sprites

Only the balloons are art. The ski-mask monkey, knives, sky, strings and pop effects are drawn in code. Missing balloons use plain colored ones (red, blue, green, yellow, purple).

| File | Size | Notes |
|---|---|---|
| `balloon-1.png` … `balloon-5.png` | **96 × 128** (3:4, taller than wide) | Transparent background, balloon filling the frame, **knot at the bottom center** (the string is drawn from there). `ballon-1.png` spelling works too |
| `bg.png` | **720 × 1280** (optional) | Replaces the sky. Cropped to fit, so keep the important stuff in the middle |

- Each level mixes all five at random, so they're just looks. Make them five different colors so the screen pops.
- Balloons are drawn 34 units tall on a 320-wide screen.
- `.jpg` works too, but PNG keeps the background see-through.

## Optional sounds (MP3)
`pop.mp3` · `throw.mp3` · `clear.mp3` (level done) · `fail.mp3` (out of knives) · `start.mp3`

## Tuning
Gravity, throw strength, knives per level and rewards are in `js/content.js → games.balloons`.
