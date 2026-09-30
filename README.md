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

## Game Definition Files

Games are described in YAML. Read the complete
[game-authoring guide](docs/GAME_AUTHORING.md) before creating or generating one.
It documents the runtime contract, conditions, assignments, actions, branching
dialogue, endings, assets, custom layouts, validation, and a dedicated AI workflow.

Start from `resources/game_definition_template.yaml`. The most complete working
example is `samples/test/Test.yaml`; its neighboring assets and `test_layout.html`
show how a game can be packaged in one folder. The JSON schema at
`resources/game_definition_schema.json` validates the base structure but does not
describe every runtime field, so schema validation must be followed by play-testing.
