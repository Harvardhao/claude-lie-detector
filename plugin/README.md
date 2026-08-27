# Claude Code plugin

Install from this repository's marketplace:

```
/plugin marketplace add Harvardhao/claude-lie-detector
/plugin install claude-lie-detector@claude-lie-detector
```

Or point Claude Code at a local clone:

```powershell
npm run build
claude --plugin-dir .
```

The plugin's non-blocking `Stop` hook reads `.claude-lie-detector.json` from the active project, evaluates Claude's final response, serializes checks per project, and presents supported or contradicted claims on Windows. Hook output uses the `hookSpecificOutput` shape documented at <https://code.claude.com/docs/en/hooks>.

The compiled `dist/` is committed, so neither install path builds anything. Run `claude plugin validate . --strict` before publishing a new version when the installed Claude Code provides the validator. See the root README for verifier, asset, mute, privacy, and verdict semantics.
