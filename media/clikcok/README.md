# clikcok/  —  ClikCok videos ("cloks")

Drop your videos in this folder named:

```
clok0000.mp4
clok0001.mp4
clok0002.mp4
...
clok0100.mp4
```

- **4-digit numbers, starting at 0000.** The app finds them by itself and plays them in random order (it goes through all of them before repeating).
- It looks for `clok0000` to `clok0100`. If you add more past 0100, it keeps finding them as long as the numbers keep going. To start looking further from the beginning, raise `count` in `js/content.js → clikcok`.
- Gaps are OK (a missing number is skipped), but each missing number costs a quick check, so try not to leave big holes.
- `cloks0000.mp4` spelling works too.

## Video format

- **Portrait 9:16**, around **540 × 960** (or 720 × 1280). They fill the screen and crop from the center.
- **~5 seconds**, they loop until you swipe.
- **MP4 (H.264 video, AAC audio)**. Sound is on by default (there's a mute button).
- Keep each one **under ~2 MB**. People scroll fast and every swipe downloads the next one.

From Blender: FFmpeg Video → MPEG-4 → H.264, Medium quality, Audio Codec AAC.
From a phone/editor: export 720p or smaller and keep it short.

## The timer

There are no likes. The only thing ClikCok tracks is a tiny timer (top right) that runs while you scroll. Close the app and the next time you open it, it congratulates you on how long you spent, plus your all-time total. The menu button shows your stats any time.
