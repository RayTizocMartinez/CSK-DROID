# boot/

What shows after someone taps "power on". The boot screen lasts about 3 seconds, then the lock screen appears.

**Files (both optional):**

- `boot.png`: covers the whole screen during boot. Portrait, 720 × 1280 px, black background works best. Without it, the shimmering `bootText` from `js/content.js` is shown (currently "KILLDROID").
- `boot.mp3`: plays once at boot. Under 3 seconds. Without it, a short synth chime plays.

Want an animated boot (GIF or video)? That's a small add later; ask for it.
