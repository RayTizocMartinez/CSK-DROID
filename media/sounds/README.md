# sounds/

System sound effects. **Every one of these is optional.** If a file is missing, the phone plays a synthesized version.

| File name | When it plays | Length |
|---|---|---|
| `notification.mp3` | A text message arrives | under 2 s |
| `unlock.mp3` | Sliding the lock screen open | under 0.5 s |
| `ringback.mp3` | The ringing you hear while a call connects. **Make it loop cleanly.** One ring cycle (2 s ring + 4 s silence) is perfect | ~6 s |
| `hangup.mp3` | A call ends | under 1.5 s |
| `not-in-service.mp3` | The announcement after dialing a dead number. Record just the voice; the three rising tones are added automatically | 5–10 s |

**Format:** MP3, short and small (under 100 KB each except the announcement).

Dialer key tones (DTMF) are always generated, since they're mathematically exact anyway.

Silent mode (drag the right tab on the lock screen, or Settings > Sound & display) mutes notifications, unlock and key tones, but never call audio.

File names are set in the `sounds` section of `js/content.js` if you want to rename them.
