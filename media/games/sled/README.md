# games/sled/  —  Line Ryder

The whole rider is a floppy stick figure made of physics points. The only art is the head.

| File | Size | Notes |
|---|---|---|
| `head.png` | **128 × 128** square, transparent | Facing **right**, the face filling most of the square. It sits on the neck and turns with the body. The **bottom-center** of the image meets the neck |

Missing head = a yellow cartoon head stand-in. `head.jpg` also works.

## How to play

- **✎ Pencil:** draw freehand. **╱ Line:** drag a straight line. **⌫ Eraser:** rub lines out. **⚑ Flag:** tap where the rider starts. **✋ Hand:** drag to move around. **↶** undo. **🗑** clear all.
- **Two fingers** move and zoom anywhere (mouse wheel zooms on a computer).
- **Colors:** 🔵 normal track · 🔴 speed boost (arrows show which way it pushes) · 🟢 scenery, no collision.
- **▶ Play** / **■ Stop** (or Back). The camera follows him; drag to look around while he rides.
- Lines are **one-sided, like the original**: you ride on top of anything. Strokes drawn right-to-left get flipped so their top is the riding side. Loops work if you draw them in the direction he'll travel.
- Land too hard and the bindings snap: he flies off and tumbles while the sled keeps going.
- **Menu:** Save / Load (3 slots on the device), Clear all, Demo track, Find rider.

## Tuning (js/content.js → games.sled)
`gravity`, `endurance` (lower = falls off easier), `boost` (red line strength), `headSize`.
