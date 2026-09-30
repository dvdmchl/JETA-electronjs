# JETA Repository Instructions

These instructions are the canonical development guidance for every coding agent
working in this repository. Keep `GEMINI.md` as a thin import of this file so Codex
and Gemini follow the same rules.

## Project Overview

JETA is an Electron desktop engine for text adventures. The application uses
CommonJS JavaScript, Jest, YAML/JSON game definitions, and a small renderer UI.
Preserve compatibility with existing game definitions and saved games unless a
tracked issue explicitly defines a migration.

Key areas:

- `main.js`: Electron lifecycle and main-process IPC registration.
- `src/jeta_ui.js` and `src/menu.js`: windows, menus, and desktop workflows.
- `src/preload.js` and `src/renderer.js`: the context-isolated main/renderer bridge
  and browser-side rendering.
- `src/game_definition_loader.js`: file parsing, schema validation, decryption, and
  game initialization.
- `src/game_data.js`: game state, conditions, assignments, and data normalization.
- `src/game_engine.js`: player actions and presentation sent to the renderer.
- `src/game_layout.js` and `src/layout_sections.js`: layouts and visibility controls.
- `resources/game_definition_schema.json`: canonical external game-definition
  contract.
- `resources/game_definition_template.yaml`, `samples/`, and `README.md`: authoring
  examples that must stay aligned with the contract.
- `locales/`: Czech and English UI translations.
- `src/test/`: Jest unit and regression tests. Never edit generated copies in
  `out/`.

## Setup and Commands

- Use Node.js 20 LTS, matching `.nvmrc` and CI. Do not install dependencies with
  Node.js 24; Electron 33's installer does not complete correctly in that runtime.
- Install exactly from the lockfile with `npm ci`.
- Start the Electron application with `npm start`.
- Run the source test suite with `npm test`.
- Run the deterministic CI suite with `npm run test:ci`.
- Do not manually edit `package-lock.json`. Regenerate it with npm only when a
  dependency change is part of the task.

## Required Workflow

1. Read the issue or task, `AGENTS.md`, and every source or contract document it
   references.
2. Check `git status --short --branch` and preserve unrelated work.
3. Inspect the relevant implementation, callers, tests, and equivalent entry points
   before proposing or writing code. Prefer `rg` and focused file reads.
4. Write a short plan for non-trivial work. State assumptions, risks, affected
   modules, and verification.
5. Make the smallest cohesive change that satisfies the task. Do not mix drive-by
   cleanup, dependency upgrades, or unrelated formatting into the diff.
6. Add or update focused tests for changed behavior and regressions.
7. Run focused checks first, then `npm run test:ci` for shared or final changes.
8. Review the complete diff and status before committing. Look specifically for
   duplicated behavior, stale documentation, generated files, debug output, and
   accidental contract changes.

If requirements conflict or a change needs a product, security, data-format, or
architecture decision not covered by the task, stop and request direction rather
than silently choosing a broader design.

## Design and Code Quality

- Follow the existing CommonJS style and nearby naming, indentation, and error
  handling. Use four spaces and semicolons in JavaScript. Avoid unrelated reformatting.
- Prefer simple functions and explicit data flow. Add an abstraction only when it
  owns a real shared responsibility; superficial textual similarity is not enough.
- Treat identical domain behavior as one implementation even when it has several
  triggers. Menu items, keyboard shortcuts, IPC handlers, renderer actions, reloads,
  and startup paths should call one canonical operation or thin adapters around it.
- Before adding a helper, service, handler, state variable, or code path, search for
  an existing implementation that can be reused, extended, or consolidated.
- Keep state transitions in the owning domain module. UI code should request actions
  and render results rather than reimplement `GameData` or `GameEngine` rules.
- Keep functions focused, name intent clearly, validate boundary inputs, and fail
  with actionable errors. Do not catch errors only to hide them.
- Do not introduce a production dependency unless the issue requires it and the
  existing platform or dependencies cannot solve the problem clearly.
- Comments should explain non-obvious intent, invariants, or compatibility reasons;
  do not narrate self-explanatory code.

## Game-Definition and State Contracts

- Before creating or editing a game definition, read `docs/GAME_AUTHORING.md`,
  `resources/game_definition_template.yaml`, the JSON schema, and the relevant
  sample. Follow the guide's AI workflow and validation checklist; do not infer
  support for a field merely because the permissive schema accepts it.
- Treat game files, custom layouts, dialogue text, state files, and file paths as
  untrusted input.
- Validate game definitions before constructing `GameData`. Keep parsing,
  normalization, and runtime behavior compatible across YAML, JSON, and encrypted
  wrappers.
- When the public game-definition shape changes, update the JSON schema, loader/data
  behavior, template, relevant samples, README documentation, and tests in the same
  change.
- Preserve existing IDs, variable semantics, condition and assignment grammar, save
  shape, and encryption wrapper format unless migration behavior is explicitly
  specified and tested.
- `src/encryption.js` provides format compatibility and obfuscation with a bundled
  key; do not represent it as secure secret storage or add sensitive values to the
  repository, logs, fixtures, or issue text.

## Electron and Web Security

- Keep the main process, preload bridge, and renderer responsibilities separated.
- Keep `contextIsolation` enabled and `nodeIntegration` disabled for the main window.
  Expose the smallest possible preload API instead of passing unrestricted Electron
  objects into the renderer.
- For every IPC change, validate channel data in the receiving process, confirm the
  sender/target assumptions, and avoid duplicate handlers for the same operation.
- Escape game-controlled text before interpolating it into HTML. Do not add new
  `innerHTML`, inline script, shell-command, path traversal, or external navigation
  surfaces without explicit validation and a security review.
- Do not weaken the Content Security Policy, `webSecurity`, or window preferences as
  a shortcut. If legacy behavior already uses a weaker setting, keep new work from
  expanding that boundary and track hardening separately.
- Never log secrets, full saved-game contents, authentication material, or private
  filesystem data.

## Tests and Verification

- Put tests under `src/test/`; `out/` is generated and ignored.
- Every bug fix needs a regression test that fails before the fix and passes after it.
- Cover normal behavior, invalid input, and relevant boundary cases. Prefer observable
  outcomes over tests coupled to implementation details.
- Changes to conditions, assignments, dialogue, normalization, layout visibility,
  or serialization require focused `GameData`/`GameEngine` coverage as applicable.
- Changes to file formats require representative YAML/JSON fixtures and validation
  checks. Keep fixtures minimal and free of real user data.
- For Electron UI changes, run unit tests and perform the smallest relevant manual
  smoke test with `npm start`; report manual steps and anything not exercised.
- Do not update snapshots or expected values merely to make a failing check green.
  Establish whether the behavior change is intended first.

## Documentation and Localization

- Keep persistent project artifacts and technical documentation in English unless a
  user-facing locale file requires translated text.
- When adding or changing UI text, update both `locales/en.json` and
  `locales/cs.json`, preserve matching keys, and verify fallback behavior.
- Update `README.md`, templates, samples, and schema documentation when user-visible
  setup or game-authoring behavior changes.
- Do not copy the canonical rules into `GEMINI.md`; import this file to prevent drift.

## GitHub and Commits

- Link substantive work to a GitHub issue and keep the change within its acceptance
  criteria.
- Prefer available GitHub MCP tools for issue and pull-request operations. Use local
  git for status, diff, staging, commits, and pushes.
- If a commit implements an issue, start its English message with `#<number> - `.
- Commit only files belonging to the issue. Never discard, overwrite, or include
  unrelated working-tree changes.
- Do not commit generated `out/`, dependencies, editor settings, credentials, or
  temporary diagnostics.

## Code Review Rules

### External game compatibility

- Flag changes that alter accepted game definitions, condition/assignment semantics,
  saved state, or encrypted wrappers without coordinated schema, examples, migration
  handling, and regression tests. Safe path: preserve the existing contract or ship
  and document an explicit backward-compatible migration.

### Renderer trust boundary

- Flag game-controlled content that reaches HTML, IPC, filesystem, shell, or window
  APIs without validation or escaping. Safe path: validate at the process boundary,
  escape for the output context, and expose only a narrow preload operation.

### Behavioral consistency

- Flag parallel implementations of the same action or state transition across menu,
  shortcut, renderer, IPC, startup, and reload paths. Safe path: route equivalent
  entry points through one canonical implementation and test the shared behavior.
