# Claude Lie Detector

Because “this should work now” is not a test suite.

Claude Lie Detector will watch for confident success claims, run a verification command configured by the user, and display a dramatic **TRUTH** or **LIE** verdict. It verifies command results; it does not infer intent or deception.

## Project status

The repository currently contains the TypeScript project scaffold and design documentation. Product behavior has not been implemented yet.

## Requirements

- Windows (initial development target)
- Node.js 22 or newer
- npm 10 or newer

## Development

```powershell
npm install
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

See [`docs/design/claude-lie-detector-design.md`](docs/design/claude-lie-detector-design.md) for the approved MVP design.
