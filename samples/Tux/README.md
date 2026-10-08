# Tux presentation

Open `Tux.yaml` in JETA. Keep `layout.html`, `TUX.jpg`, and the `images/`
directory beside the definition when copying the game.

## Newest-first variant

Open `Tux-top.yaml` for an alternative presentation, compatible with JETA 1.1.0.
Keep the entire Tux folder together, including `layout-top.html`.
The location stays above the journal and actions stay in their original column.
The newest complete journal message appears at the top and
older messages below. Paragraphs within each message retain their reading order.
The journal scrolls independently, with the same height limit as the original.
The action column uses a compact panel with smaller gaps and inline travel
buttons. On desktop it stays in view while scrolling the story. Long action
lists scroll inside the panel; no action is removed or collapsed behind a tab.

New messages remain visible when playing from the top of the journal, without
scrolling to its bottom. If you scroll into the history, scroll back to the top
to resume reading new messages. The story, object IDs and rules are identical to
`Tux.yaml`; only the layout path and journal hint differ. Keep both definitions
in sync when editing the adventure.

Presentation work is tracked in [issue #24](https://github.com/dvdmchl/JETA-electronjs/issues/24).

The custom layout uses a moonlit zoo palette, amber action links, a wide reading
panel, and a separate journal. Each of the eleven locations includes one
decorative image in its default description. The layout positions this image
behind the interface with a dark overlay and opaque reading panels. The image
travels with the normal location description, so startup, movement, revisits,
and restoration use the same rendering path. The ending uses the office image.
Images have empty alternative text because all meaningful scene information is
already present in the story. No scripts or engine changes are required.

## Generated backgrounds

The images were generated with the built-in ImageGen tool and encoded as WebP
at quality 84. Each filename matches its existing location ID.

Shared prompt: painterly storybook environment art for a humorous Czech text
adventure about Tux searching a zoo at night for his missing sister. Soft gouache
textures, slightly whimsical proportions, gentle mystery, muted midnight navy,
dusty teal foliage, and small amber lights. Landscape 1536 × 1024, detailed edges
and a calm darker middle for text overlays. No text, logos, watermarks, interface,
protagonist, people, or puzzle outcomes.

| File | Scene prompt |
| --- | --- |
| `images/UPapoucha.webp` | Director's office: oak desk, steel safe, hanging bird cage, peanut shells, lamplight. |
| `images/ZimniKralovstvi.webp` | Polar pavilion: pool, artificial icy rocks, penguin habitat, red armchair; no animals. |
| `images/Hriste.webp` | Empty playground: steep metal slide, old roundabout, colorful wooden blocks; intact equipment. |
| `images/Automat.webp` | Four zoo paths meeting around an oversized vintage coffee machine, trees, streetlamp. |
| `images/Zirafy.webp` | Spacious giraffe enclosure, wooden fence, tall trees, distant giraffe silhouettes. |
| `images/Opice.webp` | Monkey enclosures with leafy branches and ropes behind mesh; no close-up animals. |
| `images/Obcerstveni.webp` | Closed snack kiosk, shutters, metal vat of brown cooking oil, quiet path, streetlamp. |
| `images/Klokan.webp` | Bird aviaries, benches, old motorized bicycle resting against a bench; no characters. |
| `images/PredKancelari.webp` | Closed wooden office door, ornate brass plaque without readable text, doormat, ficus on the left. |
| `images/PredKralovstvim.webp` | Blue-lit polar pavilion entrance, path toward an administration building, trees, streetlamp. |
| `images/Strom.webp` | Old sprawling plane tree beside an antelope enclosure, distant silhouettes; no crash or kangaroo. |
