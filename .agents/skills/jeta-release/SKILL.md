---
name: jeta-release
description: Prepare, verify, and publish a versioned JETA GitHub release with source archives and a Windows installer when asked to release this project.
---

# JETA Release

Read the repository's [AGENTS.md](../../../AGENTS.md), `package.json`,
`.nvmrc`, `electron-builder.yml`, `.github/workflows/ci.yml`,
`.github/workflows/release.yml`, and existing release metadata before
starting. Follow the canonical repository rules; this skill does not authorize
publication beyond the user's request.

## Release scope

Publish source archives and a Windows x64 NSIS installer. `npm run dist:win`
uses electron-builder on Windows; output goes to `out/release/`. Electron and
runtime dependencies are bundled; users do not need Node.js. Samples are copied
beside the executable. Builds are unsigned unless signing is explicitly configured;
explain possible Windows publisher prompts. No automatic updates or Linux/macOS
installers are currently configured.

## Prepare and verify

- Confirm the requested semantic version, repository remote, release branch,
  working-tree status, and remote head. Preserve unrelated changes; use a clean
  checkout if they would enter the release. Do not publish uncommitted content.
- Check both local/remote `v<version>` tags and GitHub releases before mutation.
  Never move an existing version tag. If the release already exists, inspect it
  and report or resume only the missing authorized steps.
- Use Node.js 20 LTS for npm commands, including dependency installation. An
  explicit installed runtime path is suitable when the global runtime differs.
- Use `npm ci` when dependencies need installing. Set the version using
  `npm version <version> --no-git-tag-version`; let npm update the lockfile.
  Confirm the package, lockfile root, and lockfile root package versions match,
  with no dependency drift.
- Run `npm run test:ci`. Perform relevant Electron smoke tests if runtime/UI
  changes are included; report anything untested. Fix failures before releasing.
- Build the installer and run `src/test/windows-installer-smoke.ps1` with its
  `-InstallerPath`. The test verifies silent installation, startup with the bundled
  index game, and uninstallation. Run it in an isolated test account or CI runner
  if an existing JETA installation could be affected by installer registration.
- Review the complete diff and commit only release-related files with the linked
  issue number. Push through the repository's normal integration path; respect
  branch protection and use a PR when required. Wait for the exact release
  commit's CI to succeed before tagging it.

## Publish and confirm

Prefer GitHub MCP for supported operations. Local git handles commits and
annotated tags; use git/gh as fallback when MCP lacks the needed operation.

Create an annotated `v<version>` tag on the verified commit and push that tag.
Create the GitHub release using the existing tag, never an implicit new tag.
With gh, use `gh release create v<version> --verify-tag --title "JETA <version>"
--notes-file <file>`; specify the verified repository explicitly. Mark preview
versions as prereleases and stable versions as stable.

Publishing triggers the **Windows installer** workflow. Wait for successful tests,
installation smoke verification, and attachment of the `.exe`, `.exe.sha256`, and
`-build.json` assets before calling the release complete. Releases created using
the repository's `GITHUB_TOKEN` may not trigger another workflow; dispatch the
installer workflow explicitly in that case.

To supplement an existing release with an authorized packaging-only change,
dispatch `release.yml` on the verified build commit with `release_tag` matching
the package version. Preserve the original tag and source archives. Check the
diff from the tag for runtime changes before supplementing it; runtime changes
require a new version. State the supplemental build commit in release notes;
the workflow also records it in the provenance asset. Existing assets cause the
workflow to stop rather than overwrite them. Inspect partial uploads before
retrying and resume only missing uploads from the same verified build artifacts.

Write English release notes grounded in changes since the preceding release
(or the shipped feature set for the first release). Include installation from
source with Node.js 20, `npm ci`, and `npm start`, plus Windows installer usage;
mention test results and material limitations. Do not imply incompatible format changes
or security guarantees that were not implemented.

After any uncertain publish/push result, read remote state before retrying.
Verify the published release URL, version, draft/prerelease flags, remote tag's
peeled commit, exact-commit CI, installer workflow, and asset checksums/provenance.
Close the linked issue only after its
acceptance criteria are satisfied. Report the release and issue links with the
validation result.
