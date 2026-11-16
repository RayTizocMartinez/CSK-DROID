# media/

Everything you drop in here is optional. If a file is missing, the phone falls back to something built in (a synth sound, a gradient, a letter avatar, text-to-speech), so you can fill these in as you go.

| Folder | What goes in it | Required? |
|---|---|---|
| `app-icon/` | The icon people see when they install the phone to their home screen | Placeholder included, replace it |
| `wallpaper/` | Home screen and lock screen backgrounds | Placeholder included |
| `photos/` | Gallery pictures, one subfolder per album | Samples included, delete them |
| `voicemail/` | The audio that plays when someone calls a contact | No, TTS reads `voicemailText` until you add one |
| `avatars/` | Contact photos | No, shows the first letter of the name |
| `sounds/` | Notification ding, unlock click, ringing, hang-up beeps | No, all synthesized |
| `boot/` | Boot splash image and boot sound | No |
| `icons/` | Replacement app icons for the home screen | No, built-in icons are used |
| `games/` | Sprites, sounds and music for each mini game, one subfolder per game | No, games draw stand-in art |
| `fonts/` | Droid Sans, the real Android 2.1 font | No, falls back to Roboto/Arial |

## File name rules (these save headaches on GitHub Pages)

- **Case matters.** `Mom.jpg` and `mom.jpg` are different files online even if Windows treats them the same. Match the names in `js/content.js` exactly.
- Stick to letters, numbers, dashes and underscores where you can. Spaces work (the gallery handles them) but are easy to typo.
- Keep files small: people are loading this on their phones at a show. Aim for photos under 300 KB and audio under 1 MB.
