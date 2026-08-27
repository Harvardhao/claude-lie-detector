# Claude Lie Detector

Because “this should work now” is not a test suite.

Claude Lie Detector will watch for confident success claims, run a verification command configured by the user, and display a dramatic **TRUTH** or **LIE** verdict. It verifies command results; it does not infer intent or deception.

## Project status

Version 1.0.0. Deterministic claim detection, evidence-safe verification, Claude Code Stop-hook integration, and native TRUTH/LIE popup and sound presentation. See [`CHANGELOG.md`](CHANGELOG.md).

## Requirements

- Windows for the verdict popup and sound; the hook itself runs on any platform and simply skips presentation elsewhere
- Node.js 22 or newer
- npm 10 or newer

## Install

As a Claude Code plugin from this repository's marketplace:

```
/plugin marketplace add Harvardhao/claude-lie-detector
/plugin install claude-lie-detector@claude-lie-detector
```

Or from a local clone (useful for development):

```powershell
git clone https://github.com/Harvardhao/claude-lie-detector
cd claude-lie-detector
npm install
npm run build
claude --plugin-dir .
```

The compiled `dist/` is committed, so a marketplace or `git clone` install needs no build step; `npm run build` is only required after changing `src/`.

## Configuration

Create `.claude-lie-detector.json` in the project to verify:

```json
{
  "verify": "npm test",
  "verifyTests": "npm test",
  "verifyBuild": "npm run build",
  "verifyLint": "npm run lint",
  "timeoutMs": 120000,
  "popup": true,
  "popupDurationMs": 1800,
  "sound": true,
  "truthImage": "assets/truth.png",
  "lieImage": "assets/lie.png",
  "truthSound": "assets/truth.wav",
  "lieSound": "assets/lie.wav"
}
```

Run a message through the detector directly:

```powershell
claude-lie-detector --text "All tests pass."
```

Paths are relative to the active project. Missing images fall back to centered text; missing sounds are ignored. Use `--cwd`, `--config`, `--verify`, `--timeout-ms`, `--mute`, or `--no-popup` for temporary overrides.

## Verdicts

- **TRUTH** means fresh, relevant configured or local evidence supports at least one detected claim and none is contradicted or errored.
- **LIE** means fresh evidence directly contradicts at least one claim.
- `UNVERIFIED` means the available evidence is missing or insufficient; no popup appears.
- `ERROR` means verification or inspection failed; no TRUTH/LIE popup appears.

The detector recognizes test, build, lint, bug-fix, generic completion, file, local commit, push, implementation-complete, and service-running claims. Remote push claims remain unverified unless a configured verifier can prove them. A targeted test command cannot prove an “all tests pass” claim.

## Local data and security

Claude Lie Detector runs locally. It uploads no source, transcript, or verification output and uses no second model. Claude's text is passed as data only; executable commands come exclusively from `.claude-lie-detector.json`. Fixed local inspection uses filesystem APIs and Git argument arrays.

The tool appends concise diagnostics to `.claude-lie-detector.log` in the active project. That file is ignored by this repository and logging failures never block Claude Code.

## Platform status

Windows is the tested presentation target. Core detection and verification are platform-neutral, but popup and audio use PowerShell, WPF, and WAV playback. On macOS and Linux the `Stop` hook runs, verifies, and logs as usual; only the verdict popup and sound are skipped.

## Development

```powershell
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

After changing `src/`, run `npm run build` and commit the regenerated `dist/`; CI fails if the committed output is stale.

Windows presentation and the live Claude Code hook are covered by a manual checklist in [`docs/RELEASE-SMOKE-TEST.md`](docs/RELEASE-SMOKE-TEST.md), run before tagging a release.

See [`docs/design/claude-lie-detector-design.md`](docs/design/claude-lie-detector-design.md) for the approved MVP design.
