# games/jar/  —  Nick's Pee (tilt-to-drink jar)

Everything is drawn in code: the mason jar, label, liquid, foam and bubbles. Colors, the label text and the empty message are set in `js/content.js → games.jar`.

## Optional sounds (MP3)

| File | When |
|---|---|
| `pour.mp3` | Tapping to refill (~1.5 s) |
| `drink.mp3` | Repeats while it pours out of the jar (one short gulp, < 0.4 s) |
| `fizz.mp3` | Shaking the phone |
| `burp.mp3` | Finishing the jar |

Missing sounds are synthesized.

## How it works

- **Tilt the phone:** the liquid stays level and sloshes.
- **Tip it like you're drinking**, mouth of the jar downhill: it pours out and empties.
- **Shake:** foam. **Tap:** refill. **Empty:** burp.
- Tilt and shake only work on an **HTTPS** site (GitHub Pages). iPhones ask "Allow motion & orientation?" on the first tap.
- No sensors (computer, or Live Server over Wi-Fi): **drag sideways** to tip the jar. Arrow keys tip, `S` shakes, Space refills.
