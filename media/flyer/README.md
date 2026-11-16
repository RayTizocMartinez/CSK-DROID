# flyer/  —  Flyer Maker art

All PNGs. **The names are case-sensitive online**, so match them exactly (`BK` uppercase, `rod` / `club` lowercase).

| Files | What | Recommended size | Notes |
|---|---|---|---|
| `BK-1.png` … `BK-5.png` | Backgrounds | **720 × 1280** (9:16 portrait) | The flyer is 720 × 1280, so these fit exactly. Other sizes get cropped to fill, keeping the center |
| `rod-1.png` … `rod-5.png` | Poses | **512 × 256**, transparent | Any shape works. The app keeps your proportions when resizing |
| `club-1.png` … `club-5.png` | Logos | **512 × 512**, transparent | Any shape works |

- Trim the empty space around poses and logos. The edge of the image is the edge of the grab box.
- Missing files show as labeled placeholders (`BK-3`, `rod-2`…), so you can add them one at a time.
- Want a different flyer size? Change `width` / `height` in `js/content.js → flyer` and make the backgrounds to match.
- Want more than 5 of each? Set `count` in `js/content.js → flyer` (e.g. `count: 8` for BK-1…8, rod-1…8, club-1…8).

## How visitors use it

- **Background / Pose / Logo tabs:** tap a thumbnail. Pose and Logo have "None" to remove them.
- **Move:** drag it. **Resize:** drag the orange corner dot, or pinch with two fingers.
- **Text tab:** `+ Text` (type anything), `+ Date` (next show date and time, filled in for you), `+ Venue`, `+ Show`, plus a button for each name in `comics` in `content.js`. Tap text to select it, double-tap to edit, and use the bar for **Color**, **Font** (Bold / Narrow / Type) and **Outline**.
- **Save tab:** **Save to Gallery** keeps it on the phone in Gallery → *My flyers* (the last 6). **Download PNG** saves a real 720 × 1280 file to their device.
- The flyer in progress is kept if they leave the app.

Saving needs the phone opened through GitHub Pages or Live Server. Browsers block it when `index.html` is double-clicked, and the app says so.
