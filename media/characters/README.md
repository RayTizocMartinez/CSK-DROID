# characters/  —  3D models for the Killmiibos app

## Adding a character (2 steps)

1. Put the model here, e.g. `media/characters/nick.glb`.
2. Add a line to `characters.list` in `js/content.js`:

```js
{ name: "Nick", model: "nick.glb", bio: "Fell into a jar once." },
```

That's it. Order in the list = order on the shelf. `sample.glb` is a stand-in figure, so delete it and its line when you add real ones.

## Prices (Drink Tickets)

Killmiibos are unlocked with Drink Tickets, the currency every app on the phone pays out (games, ClikCok, BARKPOD, PROMPT MACHINE, the card game). Ones you don't own spin on the shelf as black silhouettes with a price tag.

- `price: 200` under `characters` in `js/content.js` sets the price for all of them.
- Give one its own price: `{ name: "Nick", model: "nick.glb", bio: "...", price: 500 }`
- `price: 0` makes it free.
- To give one away from a dial code or reward: `{ type: "killmiibo", model: "nick.glb" }`

## File names

Anything works as long as the line matches exactly. Lowercase with dashes is safest (`nick-martin.glb`), because capitals matter on GitHub.

## Exporting from Blender

- **Ctrl+A → All Transforms** first, and stand the character on the ground at the center.
- Plain Principled BSDF materials. Procedural textures don't come through, so use colors or image textures.
- **File → Export → glTF 2.0**, Format **glTF Binary (.glb)**, ☑ **Selected Objects**, ☑ **Apply Modifiers**, compression **off**.
- Keep each file under ~1–2 MB.

## Seeing it

Like the rest of the phone's media, 3D models only load through **Live Server** or **GitHub Pages**. If you double-click `index.html`, they show as gray silhouettes instead.
