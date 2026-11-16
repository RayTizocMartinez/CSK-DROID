# wallpaper/

**Files:**

- `wallpaper.jpg`: home screen background (a placeholder is included, replace it)
- `lockscreen.jpg`: lock screen background *(optional; if missing, the lock screen uses a darkened `wallpaper.jpg`)*

**Size:** portrait, about 720 × 1280 px. It's cropped to fill the screen, so keep the important stuff near the center.

**Format:** JPG, ideally under 250 KB.

**Era tip:** stock Eclair wallpapers were soft, blurry abstract color blobs or low-res space photos. A slightly crunchy JPEG sells the 2010 look.

## Letting visitors change the wallpaper

Long-press an empty spot on the home screen (or Menu → Wallpaper), then **Wallpapers**. It works just like Android 2.1:

- **Wallpapers** shows a big preview with a strip of choices. The phone finds these automatically:
  - `wallpaper-1.jpg`, `wallpaper-2.jpg`, … and `background-1.jpg`, `background-2.jpg`, … in this folder. Number them with no gaps; `.png` works too.
  - `lockscreen.jpg` / `background.jpg` in this folder
  - each game's `background.png`
  - any gallery photo with "wallpaper" or "background" in its file name
  - anything listed in `home.wallpapers` in `js/content.js`
  - "Default" is `wallpaper.jpg` (or the built-in gradient)
- **Gallery** lets visitors pick any photo and crop it with the orange box.

Each visitor's choice is saved on their device. Settings → Privacy → Factory data reset puts it back.
