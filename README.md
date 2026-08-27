# Claude Lie Detector

Because “this should work now” is not a test suite.

Claude Lie Detector will watch for confident success claims, run a verification command configured by the user, and display a dramatic **TRUTH** or **LIE** verdict. It verifies command results; it does not infer intent or deception.

## Project status

The repository contains a runnable CLI core with deterministic claim detection, project-configured verification, claim-specific verifier routing, and structured `truth`/`lie` results. Claude Code integration and presentation remain under development.

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
  "timeoutMs": 120000
}
```

Run a message through the detector:

```powershell
claude-lie-detector --text "All tests pass."
```

Use `--cwd`, `--config`, `--verify`, or `--timeout-ms` for temporary overrides. Claude Code integration is not wired yet.

## Development

```powershell
npm install
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

See [`docs/design/claude-lie-detector-design.md`](docs/design/claude-lie-detector-design.md) for the approved MVP design.
