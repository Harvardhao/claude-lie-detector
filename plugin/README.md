# Claude Code plugin

Build the project, then test the repository root as a local plugin:

```powershell
npm run build
claude --plugin-dir .
```

The plugin's non-blocking `Stop` hook reads `.claude-lie-detector.json` from the active project, evaluates Claude's final response, serializes checks per project, and presents supported or contradicted claims on Windows.

Run `claude plugin validate . --strict` before publishing when the installed Claude Code version provides the validator. See the root README for verifier, asset, mute, privacy, and verdict semantics.
