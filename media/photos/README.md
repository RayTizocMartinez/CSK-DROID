# photos/

The Gallery app. **Every subfolder is an album.** Albums and the photos inside them are shown A–Z.

```
photos/
  camera roll/     <- photos placed directly in photos/ also land here
    IMG_0001.jpg
  download/
    meme_final.jpg
  PRIVATE/
    DO NOT OPEN.jpg
```

The folder name is exactly what the album is called on the phone (capitals included), so renaming a folder renames the album.

The pictures inside are placeholders. Swap in your own and keep (or rename) the folders.

**Formats:** JPG, PNG, GIF (animated GIFs work), WEBP.

**Size:** around 1080 px on the long side, under 300 KB each. Old phone camera photos were 640 × 480 or 1280 × 960, which looks perfect here.

**Sorting tip:** the sort is "natural", so `2.jpg` comes before `10.jpg`. To force an order, start names with numbers: `01 first.jpg`, `02 second.jpg`.

## After adding or removing photos (important)

Websites can't list a folder's contents on their own, so the phone reads a list from `js/gallery-index.js`.

1. Open `tools/gallery-builder.html` in your browser (double-click it).
2. Choose this `photos` folder.
3. Download the new `gallery-index.js` and put it in the `js` folder, replacing the old one.
4. Upload both the photos and `js/gallery-index.js` to GitHub.

If a photo exists but doesn't show up, you skipped this step.
