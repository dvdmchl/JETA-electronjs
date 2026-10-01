---
name: jeta-release
description: Prepare, verify, and publish a versioned GitHub source release of JETA when asked to release this project.
---

# JETA Release

Read the repository's [AGENTS.md](../../../AGENTS.md), `package.json`,
`.nvmrc`, `.github/workflows/ci.yml`, and existing release metadata before
starting. Follow the canonical repository rules; this skill does not authorize
publication beyond the user's request.

## Release scope

JETA currently has no installer packaging workflow. Publish a GitHub source
release with the automatic ZIP/tar.gz archives. Do not claim that installers,
auto-updates, or platform builds exist. If packaging is requested, treat it as
separate implementation work rather than inventing release assets.

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

Write English release notes grounded in changes since the preceding release
(or the shipped feature set for the first release). Include installation from
source with Node.js 20, `npm ci`, and `npm start`; mention source-only delivery,
test results, and material limitations. Do not imply incompatible format changes
or security guarantees that were not implemented.

After any uncertain publish/push result, read remote state before retrying.
Verify the published release URL, version, draft/prerelease flags, remote tag's
peeled commit, and exact-commit CI. Close the linked issue only after its
acceptance criteria are satisfied. Report the release and issue links with the
validation result.
