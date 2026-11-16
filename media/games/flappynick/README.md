# games/flappynick/  —  Flappy Nick sprites + sounds

Only Nick is a drawing. The sky, background clouds, storm clouds and cloud floor are all drawn in code. Missing files fall back to a stand-in Nick and synth sounds.

Every sprite can be `.png` or `.jpg`, but **PNG with a transparent background** is best. JPG shows its background as a square box.

## Sprites

| File | What it is | Draw it at | Notes |
|---|---|---|---|
| `nick-flap.png` | Nick mid-flap (shown for a split second after each tap) | **192 × 96** (2:1) | Facing **right** |
| `nick-noflap.png` | Nick gliding / falling (shown the rest of the time) | **192 × 96** (2:1) | Same framing as the flap frame so he doesn't jump between frames |
| `background.png` *(optional)* | Replaces the drawn sky | 720 × 1280 portrait | The drifting clouds still draw on top |

**Sizing:** Nick is drawn 60 wide on a 320-wide screen. His height follows your image's shape (192 × 96 → 60 × 30), so a different ratio works too. The game tilts him nose-up when he flaps and nose-down as he falls, rotating around the center of the image.

**Hitbox:** a box covering the middle 70% of the sprite, so wing tips and hair at the edges don't count as hits. Adjust `hitbox` in `js/content.js → games.flappynick` (0.7 = 70%) if it feels unfair.

Only made one sprite? Name it either of the two names and it's used for both.

## Sounds (all optional, MP3)

| File | When | Length |
|---|---|---|
| `flap.mp3` | Every tap | < 0.2 s (it plays a LOT) |
| `point.mp3` | Passing a storm cloud | < 0.4 s |
| `hit.mp3` | Crashing | < 0.5 s |
| `die.mp3` | Right after the crash | < 1.5 s |
| `start.mp3` | Game starts | < 1 s |
| `medal.mp3` | Reaching a medal score | < 1 s |

## Icon

The home screen icon goes in `media/icons/flappynick.png` (96 × 96, transparent).
