# voicemail/

What plays when someone dials a contact. The phone rings for a few seconds, then "connects" and plays the file. When the audio ends, the call hangs up on its own.

**File names: `<contact id>.mp3`**, using the `id` from the contacts list in `js/content.js`:

| Contact id in content.js | File to drop here |
|---|---|
| `mom` | `mom.mp3` |
| `booker` | `booker.mp3` |
| `donotanswer` | `donotanswer.mp3` |
| `landlord` | `landlord.mp3` |
| *(the dialer's voicemail button, or dialing 123)* | `voicemail-box.mp3` |

Want a different name? Add `voicemail: "media/voicemail/whatever.mp3"` to that contact in `content.js`.

**Until a file exists,** the phone reads that contact's `voicemailText` aloud with text-to-speech, so you can test the whole flow before you record anything.

**Format:** MP3 (works everywhere). Mono, 64–128 kbps is plenty and keeps files small.

**Length:** 10–40 seconds feels like a real voicemail. People will hang up on anything over a minute.

**Recording tips**

- Start with the greeting ("Hi, you've reached…") or start mid-sentence like they picked up by accident. Both are funny.
- The ringing and the hang-up beeps are added automatically, so don't record those.
- A little phone EQ sells it: cut everything below ~300 Hz and above ~3,400 Hz.

**Calling a number nobody owns** plays the classic three-tone "not in service" sound (generated), then `../sounds/not-in-service.mp3` if you add one, otherwise text-to-speech.
