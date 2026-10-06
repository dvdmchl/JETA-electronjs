# Dependency review — 2026-10-06

The dependency refresh accompanying issue #25 retains the existing `package.json`
constraints and Node.js 20 environment. npm regenerated `package-lock.json`,
including the previously pending removal of the optional `jiti` peer entry.

| Direct dependency | Previous lock | Updated lock |
| --- | --- | --- |
| ajv | 8.17.1 | 8.20.0 |
| bootstrap | 5.3.3 | 5.3.8 |
| electron | 33.3.2 | 33.4.11 |
| electron-store | 10.0.0 | 10.1.0 |
| eslint | 9.18.0 | 9.39.5 |
| i18next | 24.2.1 | 24.2.3 |
| i18next-fs-backend | 2.6.0 | 2.6.8 |
| js-yaml | 4.1.0 | 4.3.2 |

ajv-formats 3.0.1, Jest 29.7.0, and the pinned electron-builder 26.0.12 remain
unchanged. Transitive packages were also updated within their declared ranges.

## Remaining modernization work

Registry versions available during this review include Electron 41.7.1,
electron-store 11.0.2, ESLint 10.12.0, i18next 26.4.2, Jest 30.5.2, and js-yaml
5.4.3. These require major-version migrations rather than a lockfile refresh.
Electron 33 is outside the project's upstream support window; updating to its
latest patch does not make it a supported runtime. See the
[Electron support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines).

electron-builder 26.15.3 is available, but its `@electron/rebuild` dependency
requires Node.js >=22.12.0. Builder 26.1.0 already depends on rebuild 4.0.1;
the packaging toolchain should be upgraded together with the repository's Node.js
requirement and CI, followed by installer verification.

## Security audit

The full npm audit changed from 63 findings (3 low, 9 moderate, 49 high,
2 critical) to 50 (8 moderate, 41 high, 1 critical). Counts include affected
dependency chains and are not counts of independent vulnerabilities.

The remaining critical finding is in `tar` under the packaging toolchain.
Remaining direct affected packages reported by npm are Electron, electron-builder,
and Jest. `npm audit --omit=dev` reports 33 findings (5 moderate, 28 high,
no critical). Jest is currently declared under production dependencies, so that
report also includes testing packages. This refresh does not resolve all security
findings; no forced upgrades or dependency overrides were applied.

## Verification

- `npm update --engine-strict --no-fund --no-audit` on Node.js 20.20.2.
- `npm ci --engine-strict --no-fund --no-audit` succeeds from the regenerated lock.
- `npm run test:ci -- --silent`: 14 suites, 84 tests pass.
- Actual Electron startup in English and Czech; examination and button use through
  renderer IPC; 1280, 768, and 390-pixel layouts have no horizontal overflow.
- `npm run dist:win` builds the Windows x64 NSIS installer with Electron 33.4.11.
  Installer execution and installation/uninstallation were not repeated for this
  lockfile refresh.
