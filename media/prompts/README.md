# prompts/  —  the Writer's joke prompts

Your joke prompt files go here. Every few minutes the phone texts the visitor **one random line** from them, from "The Writer", wrapped in a random framing like *"what about... {line}"*.

## Files

- `text-1.txt`, `text-2.txt`, `text-3.txt`: the included ones are placeholders. Replace them with yours (same names).
- **One prompt per line.** Blank lines are skipped, and so are lines starting with `#` (handy for notes).
- Plain text, saved as UTF-8 (Notepad's default). Emoji are fine.
- Want more files or different names? Edit the `files` list in `js/content.js → prompts`.

## How it behaves

- Lines don't repeat until every line in every file has been used, then it starts over.
- Unread texts pile up with a growing count on the notification and a red badge on the Messaging icon, until the visitor opens the thread.
- Texts that would have arrived while the visitor was away show up when they come back (up to 3, with their old times).
- Each prompt has **Like** / **Nah** buttons. The Writer replies with a happy face (like) or sad face (nah).
- **Show-day reset:** at midnight Central on show day (Wednesday), the whole thread wipes clean and the Writer sends `showDayMessage`.

The framings, timing, faces and reset are all set in `js/content.js → prompts`. Put `{prompt}` where the line should go in a framing.

## Testing

- **Need a text right now?** Dial `*#*#9748#*#*` in the Phone app (9748 = W-R-I-T). The Writer sends a prompt immediately.
- The first text comes ~25 seconds after the **first** unlock on a device, then every 1–4 minutes (`minMinutes` / `maxMinutes` in `content.js`). Reloading doesn't restart that clock. Settings → Privacy → Factory data reset does.
- If the files can't be found, the phone pops up a **"No joke prompts"** box saying why.
- On Windows, check the names with **View → File name extensions** turned on. `text-1.txt.txt` is a common accident. The phone tries that name too, but fixing it is cleaner.

## Double-click testing (no Live Server)

Browsers block a page opened by double-clicking from reading these `.txt` files. To make the Writer work that way anyway, open `tools/prompts-builder.html`, choose this folder, and save the downloaded `prompts-data.js` into `js/`, replacing the old one. Redo it after editing the text files. Hosted copies (GitHub Pages, Live Server) always read the `.txt` files directly, so there it doesn't matter.
