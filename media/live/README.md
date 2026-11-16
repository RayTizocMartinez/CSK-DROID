# live/  —  live wallpapers

A live wallpaper is a short looping video that plays behind the home and lock screens. Visitors pick one from: long-press home → Wallpapers → **Live wallpapers**.

## Adding them

Drop your videos in this folder with these names:

```
live-wallpaper-1.mp4
live-wallpaper-2.mp4
live-wallpaper-3.mp4
live-wallpaper-4.mp4
live-wallpaper-5.mp4
```

That's it. The phone finds them by itself (up to 9). `.webm` works too.

They show in the list as "Live wallpaper 1", "Live wallpaper 2"… To give them real names, add a line to `home.liveWallpapers` in `js/content.js`:

```js
{ id: "live-wallpaper-1", name: "Neon Alley", description: "Rain that never stops" },
```

## Playback speed

Videos play at **half speed** by default, so you can export them sped up (smaller files) and they slow back down on the phone. Change it in `js/content.js`:

- `home.liveSpeed: 0.5` sets it for every video (1 = normal speed).
- Or give one video its own speed: `{ id: "live-wallpaper-2", speed: 1 }`.

## Exporting from Blender

Output Properties:
- **Resolution:** 540 × 960 (or set 1080 × 1920 at **50%**). Portrait. It fills the screen and crops from the center.
- **Frame Rate:** 24 or 30 fps
- **File Format:** FFmpeg Video → Container **MPEG-4** → Video Codec **H.264**
- **Output Quality:** Medium quality (or Constant Bitrate around 1500–2500 kb/s)
- **Audio Codec:** No Audio

Then Render → Render Animation.

## Keep it light (people load this on their phones at the show)

- **Aim for under 5 MB per video.** 5–15 seconds is plenty since it loops.
- Make the last frame flow into the first so the loop doesn't jump.
- No sound needed. Videos always play muted (phones only allow silent autoplay).
- The video pauses automatically while an app is open, to save battery.

## Old way: image sequences (still works)

A folder of numbered frames (`0001.jpg`, `0002.jpg`, …) plus a line in `home.liveWallpapers`:

```js
{ id: "static", name: "TV Static", folder: "media/live/static/", pattern: "####.jpg", fps: 12, pingpong: false },
```

`pattern`: `####` = the frame number padded to 4 digits. `pingpong: true` plays forward then backward. Frames don't skip numbers.
