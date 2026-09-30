# Authoring Games for JETA

This guide is the canonical practical reference for people and AI assistants that
create JETA games. It describes the behavior implemented by the current engine.
The JSON schema describes the supported fields. The loader also performs semantic
checks for unique IDs and valid references, but play-testing remains essential.

Use these files together:

- `resources/game_definition_template.yaml` is a small playable starting point.
- `samples/test/Test.yaml` demonstrates conditions, actions, dialogue branches,
  endings, images, and a custom layout.
- `resources/game_definition_schema.json` is the load-time base validator.

## Quick start

1. Run JETA with `npm start`.
2. Choose **Edit > New game definition** (`Ctrl+N`) or copy
   `resources/game_definition_template.yaml` into a new folder.
3. Keep the YAML file and its images or custom layout in the same game folder.
4. Open the definition with **File > Load game definition** (`Ctrl+O`).
5. Saving an opened definition reloads it as a fresh game. Play every affected route.

YAML files are UTF-8. Use spaces, never tabs. Quote text containing `:`, `#`, `{`,
`}`, or leading punctuation when in doubt. A block scalar is convenient for long
text:

```yaml
intro:
  - page: |
      <p>This paragraph may span several source lines.</p>
```

## Smallest useful game

A playable game needs metadata, at least one location, and exactly one character
whose ID is `player`. The player's `location` must reference an existing location
ID. `intro` is optional; when omitted or empty, startup begins with the location.

```yaml
metadata:
  title: "One Room"
  language: "en"

locations:
  - id: "room"
    name: "Room"
    descriptions:
      - default: "<p>You are in a quiet room.</p>"
    connections: []

characters:
  - id: "player"
    name: "Player"
    location: "room"
```

`metadata.title` and `metadata.language` are required by the schema. `author`,
`version`, and `description` are optional metadata strings. The language value is
metadata for the game; it does not currently select the language of the engine's
hard-coded action messages.

## IDs and references

Location, item, character, and variable IDs share one namespace and must be unique.
Ending IDs are also looked up through that namespace in normal play, so make every
ID globally unique. IDs are case-sensitive in conditions and assignments.

Use stable, simple IDs such as `entrance_hall`, `brass_key`, and `door_open`. Display
text belongs in `name`; changing a display name should not require changing game
logic.

Check every reference:

- `player.location` and every character `location` refer to a location ID.
- A connection `target` refers to a location ID.
- An item `owner` is `player`, a location ID, a container-like item ID, or `null`.
- `game_end_id` refers to an ending ID.
- A dialogue response `next` refers to an `onTalk` entry ID on the same character.

Do not use the legacy `location` field as the normal placement field for an item.
The current command lists, take, drop, and inventory behavior use `owner`.

## Narrative text and descriptions

Intro pages are joined in order before the first location description:

```yaml
intro:
  - page: "<p>First page.</p>"
  - page: "<p>Second page.</p>"
```

Locations, items, characters, and endings may use `descriptions`:

```yaml
descriptions:
  - default: "<p>The room is dark.</p>"
  - condition: "lamp_on"
    description: "<p>A desk is visible in the light.</p>"
  - condition: "window_open"
    description: "<p>Cold air enters through the window.</p>"
```

The engine renders the default text and appends the **first** conditional
description whose condition is true. It does not append every matching conditional
description. Put more specific conditions before broader ones. A default entry is
optional; without one, the base text is empty.

Narrative fields use a safe markup whitelist. Paragraphs, headings, emphasis, lists,
blocks, and images are preserved. Scripts, event-handler/style attributes, unknown
tags, and non-local image sources are escaped or removed.

Put local assets beside the game definition and address them with `game:///`:

```yaml
descriptions:
  - default: "<img src='game:///images/map.png' alt='Map'>"
```

Use forward slashes in asset URLs. The path is resolved from the directory that
contains the loaded game file.

## Locations and movement

```yaml
locations:
  - id: "kitchen"
    name: "Kitchen"
    name_accusative: "kitchen"
    descriptions:
      - default: "<p>You are in the kitchen.</p>"
    connections:
      - direction: "Hall"
        target: "hall"
```

`direction` is the clickable label. `target` is the destination ID. Connections
are one-way: add a reverse connection explicitly when the player must be able to
return. Conditional or locked connections are not currently supported. Model a
locked door as an item action, or reveal the destination through another supported
mechanic rather than inventing fields the engine does not read.

Each location must have a `descriptions` array and a `connections` array, even when
the latter is empty.

## Items

```yaml
items:
  - id: "key"
    name: "Iron key"
    name_accusative: "iron key"
    owner: "kitchen"
    movable: "true"
    descriptions:
      - default: "<p>A heavy iron key.</p>"
```

Item fields used by the runtime are:

- `id`, `name`, and `descriptions` are the normal core fields.
- `name_accusative` is optional and is used in generated action labels. If absent,
  `name` is used.
- `owner` controls placement. Use a location ID or `player`.
- `visible` controls whether the item appears in command lists.
- `movable` controls whether it can be taken and dropped.

When omitted, item `visible` and `movable` default to true. Use native YAML booleans.
Legacy strings `"true"` and `"false"` remain accepted and normalize to booleans.
Character `visible` follows the same rules and also defaults to true.

## Item actions

Each hook runs the first entry whose optional `condition` matches. An unconditional
entry is a fallback. Every hook supports `condition`, `description`, and `set`:

| Hook | Runtime behavior |
| --- | --- |
| `onUse` | Evaluates, shows `description`, then applies `set`. |
| `onTake` | Evaluates before ownership changes, moves the item to `player`, then shows `description` and applies `set`. |
| `onDrop` | Evaluates before ownership changes, moves the item to the current location, then shows `description` and applies `set`. |
| `onSee` | Runs after the object description and after incrementing `<item-id>:onSee:count`, then shows `description` and applies `set`. |

Example:

```yaml
onUse:
  - condition: "key:owner = player && player:location = hall && !door_open"
    description: "<p>You unlock the door.</p>"
    set: "door_open = true"
  - condition: "door_open"
    description: "<p>The door is already open.</p>"
  - description: "<p>You cannot use the key here.</p>"
```

Order cases from most specific to least specific because only the first match runs.
An unconditional fallback has `description` and no `condition`. Legacy action
entries using `default` are accepted and normalized to `description`.

Do not use fields such as `events`, `npcs`, `dialogue`, `combat`, `quests`, or
`onExamine`. The schema rejects these unsupported gameplay fields.

## Variables and conditions

Declare initial game state in `variables`:

```yaml
variables:
  - id: "door_open"
    value: false
  - id: "score"
    value: 0
```

The engine also creates variables when a `set` assignment first writes them, but
declaring all story variables makes a game easier to validate and maintain.

A condition may read a variable or an object property:

```text
door_open
!door_open
score >= 3
key:owner = player
player:location != cellar
key:onSee:count > 2
(key:owner = player && door_open) || knows_code
```

Supported comparisons are `=`, `==`, `!=`, `>`, `<`, `>=`, and `<=`. Logical AND
is `&&`, OR is `||`, negation is `!`, and parentheses control grouping. `&&` has
higher precedence than `||`.

The right side of a comparison is a literal: `true`, `false`, a number, or an
unquoted string such as a location ID. The left side is a declared variable or an
object path. Unknown variables, objects, or attributes can stop the action with an
error, so do not reference state that has never been declared or initialized.

## Assignments (`set`)

Separate multiple assignments with semicolons:

```yaml
set: "door_open = true; score = score + 1; key:visible = false"
```

The left side is a variable ID or an object path. Expressions on the right side
support booleans, numbers, quoted string operands, identifiers/object paths,
parentheses, and `+`, `-`, `*`, `/`, `%`. `+` concatenates when either operand is a
string. A quoted string by itself is not evaluated as an expression and would keep
its quote characters; use simple unquoted text for a plain string assignment.

Simple unquoted text is stored literally:

```yaml
set: "key:owner = hall; game_end_id = victory"
```

Avoid `=` inside a string value because assignments are split at that character.
Keep expressions simple and split unrelated state changes into semicolon-separated
assignments.

## Characters and dialogue

The player is a regular character with the reserved ID `player`. NPCs need a
location and normally `visible: true`:

```yaml
characters:
  - id: "player"
    name: "Player"
    location: "hall"

  - id: "guard"
    name: "Guard"
    name_accusative: "guard"
    location: "hall"
    visible: true
    descriptions:
      - default: "<p>The guard watches the door.</p>"
    onTalk:
      - id: "greeting"
        condition: "!guard_helped"
        description: "<p>The guard asks for the pass.</p>"
        responses:
          - id: "show_pass"
            text: "Show the pass"
            condition: "pass:owner = player"
            set: "guard_helped = true"
            next: "accepted"
          - id: "leave"
            text: "Leave"
      - id: "accepted"
        description: "<p>The guard lets you through.</p>"
```

Rules for dialogue:

- A dialogue entry with `responses` must have an `id`.
- Response IDs must be unique within that entry.
- `next` must name an entry on the same character.
- Response `text` is escaped and displayed as a clickable choice.
- A response may have `condition`, `set`, and `next`.
- An entry may have `condition`, `description`, `set`, and `responses`.
- When conversation starts, the engine processes matching entries in YAML order
  until it displays a response list. Use mutually exclusive conditions when only
  one non-branching line should be spoken.
- A response without `next` ends the active branch. Talking again starts selection
  from the character's `onTalk` list.

Use `onTalk`, not the unsupported legacy keys `dialogue` or `options`.

## Endings

Define endings at the top level and activate one from an `onUse`, dialogue entry,
or response:

```yaml
endings:
  - id: "victory"
    descriptions:
      - default: "<p>You escaped. The end.</p>"

# In an action or dialogue:
set: "game_end = true; game_end_id = victory; game-commands-show = false"
```

Both variables are required: `game_end` stops the normal command list and
`game_end_id` selects the text. A `set` on the selected ending description is
applied exactly once when the ending is presented and may hide layout sections.

## Layout visibility and custom layouts

JETA creates these system variables automatically:

```text
game-title-show          game-location-show
game-commands-show       game-characters-show
game-items-show          game-use-show
game-take-show           game-drop-show
game-go-show             game-output-show
game-log-title-show
```

All default to true except `game-log-title-show`, which defaults to false. Declare
one in `variables` only when its initial value should differ, or change it with
`set` while the game runs.

A custom HTML layout is optional:

```yaml
layout:
  path: "layout.html"
```

The path is relative to the game file. Start by copying
`resources/layout_default.html`. Keep every engine target ID that the game uses:
`game-title`, `game-location`, `game-commands`, `game-characters`, `game-items`,
`game-use`, `game-take`, `game-drop`, `game-go`, `game-output`, and
`game-log-title`. A missing target prevents that section from rendering.

## Validation and play-test checklist

Before considering a game complete:

1. Parse the YAML and validate it with
   `resources/game_definition_schema.json`.
2. Confirm that all IDs are globally unique and every reference resolves.
3. Confirm there is exactly one `player` and a valid starting location.
4. Confirm every location has `descriptions` and `connections` arrays.
5. Confirm every playable item uses `owner`, not only `location`.
6. Confirm visibility and movement values are native YAML booleans (legacy boolean
   strings are compatibility-only).
7. Confirm all variables read by conditions are initialized before the read.
8. Review action ordering, especially the first-match behavior of `onUse` and
   conditional descriptions.
9. Follow every dialogue `next` link and ensure each branch can terminate.
10. Play the happy path, every ending, failure/fallback actions, inventory changes,
    revisits to changed locations, and dialogue branches.
11. Check that every image and custom layout loads from the game folder.

Schema and semantic validation establish the supported contract and references;
runtime play-testing is still required to verify story behavior.

## Instructions for AI game generation

When an AI creates or edits a JETA game, it should follow this sequence:

1. Read this guide, the current template, the JSON schema, and the relevant sample.
2. Ask for or infer only story-level choices: language, premise, tone, player name,
   desired length, puzzle structure, and endings.
3. Draft a compact state model before YAML: globally unique IDs, starting location,
   location graph, item ownership, variables, dialogue nodes, and endings.
4. Reuse the supported structures in this guide. Never invent a field because it
   resembles a feature from another adventure engine.
5. Prefer explicit story variables and mutually exclusive conditions. Put specific
   conditions before fallback cases.
6. Keep visible prose in the requested game language, but keep IDs short, stable,
   and consistent. Do not translate an existing ID during a content-only edit.
7. Preserve existing IDs and state semantics when extending a game so saved states
   and references do not break.
8. Make the smallest coherent edit, then run the validation and play-test checklist.
9. Report unsupported requested mechanics instead of silently encoding inert YAML.

For a new medium-sized game, build and test one vertical slice first: two connected
locations, one item, one state-changing action, one NPC branch, and one ending.
Expand only after that slice loads and plays correctly.
