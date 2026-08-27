# Claude Lie Detector

Because “this should work now” is not a test suite.

Claude Lie Detector will watch for confident success claims, run a verification command configured by the user, and display a dramatic **TRUTH** or **LIE** verdict. It verifies command results; it does not infer intent or deception.

## Project status

The Windows MVP includes deterministic claim detection, evidence-safe verification, Claude Code Stop-hook integration, and native TRUTH/LIE popup and sound presentation.

## Requirements

- Windows (initial development target)
- Node.js 22 or newer
- npm 10 or newer

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

Run a message through the detector:

```powershell
claude-lie-detector --text "All tests pass."
```

Build the project, then test the repository root as a local plugin:

```powershell
npm run build
claude --plugin-dir .
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

Windows is the tested presentation target. Core detection and verification are platform-neutral, but popup/audio use PowerShell, WPF, and WAV playback. Claude Code plugin validation and final popup/audio interaction should be smoke-tested on the release machine.

## Development

```powershell
npm install
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

See [`docs/design/claude-lie-detector-design.md`](docs/design/claude-lie-detector-design.md) for the approved MVP design.
