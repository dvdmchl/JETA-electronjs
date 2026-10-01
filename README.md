# JETA

**Javascript Engine for Text Adventures**

## Overview

JETA (Javascript Engine for Text Adventures) is a powerful and flexible engine for
creating text-based adventure games using JavaScript. It provides a framework for
building interactive fiction with ease.

## Features

- Simple and intuitive API
- Support for complex game logic
- Easily extendable with custom modules
- Cross-platform compatibility

## Installation

To install and run JETA, use npm:

```sh
npm install
npm run start
```

## Development

Use Node.js 20 LTS (see `.nvmrc`). Electron 33's installer is not compatible with
Node.js 24 in this project. Install the locked dependencies and run the source test
suite:

```sh
npm ci
npm test
```

Use `npm run test:ci` for the deterministic test command used by GitHub Actions.

AI-assisted contributions use [`AGENTS.md`](AGENTS.md) as the canonical repository
guidance. Codex reads that file directly; Gemini CLI reads [`GEMINI.md`](GEMINI.md),
which imports the same guidance so both tools follow one source of truth. In Gemini
CLI, use `/memory show` after opening the repository to verify the loaded context.

## Releases

Use the project AI skill [`jeta-release`](.agents/skills/jeta-release/SKILL.md)
by asking Codex to use `$jeta-release` to release a specified version. It covers
version synchronization, tests, CI, tags, and GitHub publication.

Releases currently provide source archives, with no bundled installers. Download
and extract a release archive, install Node.js 20 LTS, then run `npm ci` and
`npm start` from the extracted directory.

## Game Definition Files

Games are described in YAML. Read the complete
[game-authoring guide](docs/GAME_AUTHORING.md) before creating or generating one.
It documents the runtime contract, conditions, assignments, actions, branching
dialogue, endings, assets, custom layouts, validation, and a dedicated AI workflow.

Start from `resources/game_definition_template.yaml`. The most complete working
example is `samples/test/Test.yaml`; its neighboring assets and `test_layout.html`
show how a game can be packaged in one folder. The JSON schema at
`resources/game_definition_schema.json` describes every supported runtime field.
Loading also checks unique IDs and references; validation and play-testing are both
part of authoring.

For a complete Czech/English adventure with a dark fantasy layout, open
`samples/stiny_azerothu/stiny_azerothu.yaml`. It includes a delivery quest, branching
dialogue, an elemental rune puzzle, and three endings. See the
[sample guide](samples/stiny_azerothu/README.md) for scope and a spoiler walkthrough.
Use **File > Game language** to switch game text while keeping your progress.
Game translations are optional and independent of **Edit > Language**, which
selects the application language. See the authoring guide for text-only translations.
