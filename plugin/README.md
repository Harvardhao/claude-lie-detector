# Claude Code plugin

Build the project, then test the repository root as a local plugin:

```powershell
npm run build
claude --plugin-dir .
```

The plugin's non-blocking `Stop` hook reads `.claude-lie-detector.json` from the active project and evaluates Claude's final response.
