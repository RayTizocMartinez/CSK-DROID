# Eclair Phone

A fake Android 2.1 ("Eclair") phone that runs in any browser and installs as an app. It's a promo for a live stand-up show: visitors poke around a "found" phone full of call logs, texts, voicemails, photos and secrets.

**Barebones build:** lock screen, status bar, notification shade, home screen, app drawer, Phone, Messaging, Gallery, Contacts, Settings. Mini games come next.

---

## Folder map

```
index.html              the phone (don't need to edit)
manifest.json           installed-app name + icon settings
sw.js                   offline support (don't need to edit)
.nojekyll               tells GitHub Pages to serve files as-is (keep it)

js/content.js           ★ ALL the lore: contacts, call log, texts, timed
                          messages, dial codes, show dates, easter eggs
js/gallery-index.js     list of gallery photos (made by the tool below)
js/os.js, js/main.js    the fake operating system
js/apps/*.js            one file per app

media/                  ★ drop your files here; every folder has its own README
tools/gallery-builder.html   makes js/gallery-index.js from your photos folder
```

You'll mostly touch two things: **`js/content.js`** and **`media/`**.

---

## Put it online with GitHub Pages (no terminal)

1. Sign in at github.com → **New repository**. Name it (e.g. `found-phone`), set it to **Public**, create it.
2. On the empty repo page click **uploading an existing file**.
3. Open this project folder on your computer, select **everything inside it** (including `.nojekyll`, which Windows may hide; turn on View → Hidden items), and drag it into the browser. Folders upload with their structure intact in Chrome and Edge.
   - GitHub's web upload takes about 100 files at a time. With lots of photos, upload in batches.
4. Click **Commit changes**.
5. Go to **Settings → Pages**. Under *Build and deployment*, Source = **Deploy from a branch**, Branch = **main**, folder = **/(root)** → **Save**.
6. Wait a minute or two. Your link appears at the top of that page: `https://YOUR-NAME.github.io/found-phone/`

**Updating later:** in the repo, open the folder you want → **Add file → Upload files** → drag in the new or changed files → Commit. Uploading a file with the same name replaces it. Changes show up within a couple of minutes (visitors may need one refresh).

**Free option for a nicer link:** GitHub Pages supports a custom domain under Settings → Pages if you own one.

---

## Testing on your computer

Double-clicking `index.html` mostly works, but audio and offline mode behave best from a real web address. The simplest way is to upload to GitHub and test there. Add `?boot` to the end of the address to skip the "tap to power on" screen while testing.

---

## How visitors use it

- **Tap the black screen** to power on (this also unlocks sound on phones).
- **Drag the green tab right** to unlock. The gray tab toggles silent mode.
- **Tap or drag the status bar down** for notifications.
- **Bottom buttons:** Back, Menu, Home (the Android back gesture also works as Back).
- **Hold an icon** on the home screen to pick it up and drag it to a new spot. Drop it on the trash can (bottom center) to remove it from the home screen. Hold an icon in the app drawer to drag a copy onto the home screen. Layouts are saved per visitor; Menu → *Reset home screen* puts it back.
- **Everywhere** (computer or phone) the phone is drawn with its machined metal body, scaled to fit the screen, so on a real phone it feels like holding an old phone inside your phone; the amber-ringed button top-right is power, and the amber LED blinks when there are unread notifications.
- **Install:** browser menu → *Add to Home screen* / *Install app*. It then opens fullscreen like a real phone.

---

## Editing content.js

Open it in any text editor (Notepad works; VS Code is nicer and highlights typos). The top of the file explains every option. Rules that keep it from breaking:

- Keep the quotes, commas and brackets. Every item in a list except the last needs a comma after it.
- If the phone shows a black screen after an edit, you almost certainly broke a comma or quote. Undo your last change.
- `id`s are short, lowercase, no spaces, and must match media file names (`mom` → `media/voicemail/mom.mp3`).
- Scheduled message `id`s must be unique. The phone remembers which ones it already delivered per visitor.
- To see the phone fresh like a first-time visitor: **Settings → Privacy → Factory data reset.**

---

## Next up

- More mini games (Pod Stack is the first: `js/apps/podstack.js`, art in `media/games/podstack/`, tuning in `content.js → games`)
- Browser app with fake 2010 web pages
- Calendar with the weekly show
- More easter eggs: dying battery, crash/reboot, hidden apps unlocked by dial codes
