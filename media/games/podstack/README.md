# games/podstack/  —  Pod Stack sprites + sounds

Drop files here with these **exact names** (lowercase). Anything missing is drawn or synthesized by the game, so add them one at a time and refresh to check each.

## How sizing works

The game screen is **320 units wide**. Each sprite is stretched into a fixed box, so **only the aspect ratio matters**. Draw at 2–4× the box size for crisp phones. The sizes below are 3×.

Every sprite can be `.png` or `.jpg`. PNG **with a transparent background** is best, since JPG can't be see-through and shows its background as a box, and keep the art filling its canvas edge to edge. The box is also the hitbox, so empty margins make catches feel off.

## Sprites (required to replace the placeholders)

| File | What it is | Box in game | Draw it at | Notes |
|---|---|---|---|---|
| `pod.png` | The pod | 50 × 50 | **168 × 168** (square) | Side view, lying flat; these stack on top of each other |
| `pod-gold.png` | Rare bonus pod, +1 life *(optional)* | 50 × 50 | 168 × 168 | Skip it and the game tints your pod gold with a glow |
| `trash.png` | The trash item | 46 × 46 | **138 × 138** (1:1) | Spins as it falls, so any orientation works |
| `holder.png` | What the stack sits on, steered by the player | 84 × 84 | **252 × 252** (square) | Sits on the floor; the bottom pod sinks into its top (see `holderSink`) |
| `background.png` | Backdrop | fills screen | **720 × 1280** portrait | Stays still while the stack scrolls up; keep it darker so pods pop |

**Pod stacking detail:** each pod overlaps the one below by about 38% (pods are 50 tall, stacked every 31 units). Both are adjustable in `js/content.js → games.podstack`:

- `podSpacing` (default 31): lower it if the stack looks gappy, raise it if pods look squished.
- `holderSink` (default 18): raise it if the bottom pod floats above the holder, lower it if it sinks too deep.

*Optional:* you can still add `trash-1.png`, `trash-2.png`, `trash-3.png` for variety later. Any of them that exist replace `trash.png` for that variant.

**Combo:** with one pod, a COMBO is catching 3 in a row without dropping a pod or catching trash.

**Want different colored pods later?** Set `colors` in `js/content.js → games.podstack` to e.g. `["blue","orange"]` and add `pod-blue.png` and `pod-orange.png`. The combo then becomes "3 of the same color in a row". Any color without its own picture falls back to `pod.png`.

## Sounds (all optional, MP3)

| File | When | Length |
|---|---|---|
| `catch.mp3` | Pod lands on the stack | < 0.3 s |
| `combo.mp3` | 3 of a color in a row | < 1 s |
| `trash.mp3` | Caught trash | < 0.8 s |
| `gold.mp3` | Caught the gold pod | < 1 s |
| `level.mp3` | Level up | < 1 s |
| `start.mp3` | Game starts | < 1 s |
| `over.mp3` | Game over | 1–2 s |
| `music.mp3` | Loops during play. **Make the loop seamless** | 30–90 s, keep under ~1.5 MB |

## Icon

The home screen icon goes in `media/icons/podstack.png` (96 × 96, transparent), not here.
