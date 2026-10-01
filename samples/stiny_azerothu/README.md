# Stíny Azerothu

A compact Czech/English fan adventure set in Warcraft's world after the Third War.
Open `stiny_azerothu.yaml` through **File > Load game definition** in JETA (`npm start`).
Keep `layout.html` beside the YAML file. No external assets or network access are needed.

Choose **File > Game language > English** (or **Soubor > Jazyk hry > angličtina**)
to play **Shadows of Azeroth**. Switching preserves the current location, inventory,
decisions, and active rune/dialogue branch. Current text, choices, layout labels and
engine action messages update; old journal entries keep their original language.
The application language setting under **Edit** remains separate. Reloading the
definition starts a new Czech game. Both versions share the same gameplay logic;
the English text is in the YAML's optional `translations.en` map.

## Playable scope

Four connected locations form a complete story: Tirisfal Grove, Booty Bay,
Stranglethorn Vale, and the Nathrezim temple. A delivery earns a map, a peace
amulet, and 50 coins. The patrol recognizes the amulet; an elemental rune puzzle
opens the temple. The final dialogue offers three irreversible endings, plus an
option to postpone the decision and return to Thrall.

The immovable travel journal in the player's inventory gives contextual hints
through **Použít**. Examine the rune gate for the puzzle clue. Dialogue choices
appear in the event journal. Items can be dropped and recovered; collecting the
reward again never restores dropped items or awards more coins. Wrong rune
answers reset only the puzzle and allow another attempt. Patrol permission and
the unlocked gate remain valid on revisits. Carry the map when entering the temple.

The sample uses only the current JETA contract: `owner`, `descriptions`,
`onTalk` responses, explicit variables, conditional connections, and endings.
It adds no combat, quest subsystem, character statistics, weather, or timers.
The dark layout retains all engine targets, stacks its columns on narrow windows,
and keeps ending text visible while hiding action cards.

## Original concept

`design.txt` is the unchanged historical proposal for a much larger campaign,
not a list of implemented mechanics. This playable adaptation preserves its
delivery, patrol, elemental clue, demonic temptation, and moral decision.
Existing entity IDs (`tirisfal_grove`, `map_to_temple`, `thrall`, and
`forsaken_patrol`) are retained. The old YAML was an invalid prototype, so it did
not provide a playable save-game baseline. Technical restoration is tracked in
[issue #21](https://github.com/dvdmchl/JETA-electronjs/issues/21).

## Spoiler walkthrough

1. Talk to Thrall in Tirisfal Grove, then travel to Booty Bay.
2. Talk to Rix and accept the package.
3. Travel to Stranglethorn, talk to Nala, and hand over the medicine.
4. Return to Booty Bay and collect Rix's reward.
5. Return to the grove and show the amulet to the Forsaken patrol.
6. Examine the rune gate. Talk to the scribe's ghost and choose **Voda → Oheň →
   Vítr → Země**. Wrong answers permit retries.
7. Enter the temple with the map and talk to Zar'thalis's voice.
8. Destroy the artifact, entrust it to Thrall, or accept the demon's power.
   Reload the definition as a fresh game to try another ending.

## Verification

`src/test/stiny-azerothu.test.js` exercises production parsing and validation,
delivery ownership and reward replay, dropped-item recovery, locked routes,
wrong rune choices and retries, all three endings, and layout target IDs.
The shared contract corpus also validates this sample. Run `npm run test:ci`.
`src/test/game-translations.test.js` verifies complete English coverage, menu
switching, active dialogue without repeated effects, save restoration, partial
translation fallback, presentation-only targets, and narrative sanitization.
