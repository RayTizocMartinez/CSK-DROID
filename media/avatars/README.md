# avatars/

Contact photos for the call log, contacts list, text threads and the in-call screen.

**File names: `<contact id>.jpg`**, using the `id` from the contacts list in `js/content.js`:

- `mom.jpg`
- `booker.jpg`
- `donotanswer.jpg`
- `landlord.jpg`
- `me.jpg`: optional, shows next to messages the phone's owner sent

No file means the contact shows a blue square with the first letter of their name, which is very 2010 and totally fine.

For a PNG or a different name, add `avatar: "media/avatars/whatever.png"` to that contact in `content.js`.

**Size:** square, 200 × 200 px is plenty. It's shown small. JPG under 40 KB.
