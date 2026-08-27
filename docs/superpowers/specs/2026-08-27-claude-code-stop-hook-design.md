# Claude Code Stop Hook Design

**Date:** 2026-08-27  
**Status:** Approved for planning

## Goal

Run the existing Claude Lie Detector evaluation automatically when the main Claude Code agent finishes a response, without blocking or altering Claude Code.

## Integration Surface

Use Claude Code's `Stop` command hook. Current Claude Code documentation states that `Stop` fires once when the main agent finishes responding and supplies `last_assistant_message` directly. The adapter must use that field rather than parse `transcript_path`.

The supported input is a JSON object containing:

- `hook_event_name: "Stop"`
- `cwd`: non-empty project directory
- `last_assistant_message`: string to evaluate

Other hook fields are accepted and ignored. Invalid JSON or missing required fields is an integration error, not a Claude Code error.

## Plugin Layout

Treat the repository root as the Claude Code plugin root so the hook can execute the compiled runtime without copying it:

```text
.claude-plugin/plugin.json
hooks/hooks.json
dist/integrations/claude-code/bin.js
```

The manifest names the plugin `claude-lie-detector`. `hooks/hooks.json` registers one `Stop` command hook that runs:

```text
node "${CLAUDE_PLUGIN_ROOT}/dist/integrations/claude-code/bin.js"
```

The npm package includes `.claude-plugin`, `hooks`, and `dist` so the same published artifact is both the CLI package and Claude Code plugin directory.

## Adapter and Runner

`src/integrations/claude-code/index.ts` owns pure input validation and normalization. It converts a valid Stop payload into the existing CLI arguments:

```text
--text <last_assistant_message> --cwd <cwd>
```

It then calls `runCli`; detector, config, verifier routing, verdict mapping, and timeout behavior remain owned by their existing modules.

`src/integrations/claude-code/bin.ts` is a thin executable wrapper. It reads all stdin, calls the adapter, and writes one valid Claude Code JSON response.

## Output and Failure Isolation

The hook emits no blocking decision and always exits `0`.

- `truth`: return a concise `systemMessage` containing `Lie Detector: TRUTH`.
- `lie`: return a concise `systemMessage` containing `Lie Detector: LIE`.
- no claim: return `{}`.
- invalid hook input, missing config, timeout, or verifier execution error: return a concise `systemMessage` beginning `Lie Detector error:`.

The adapter must never include assistant text in a command string. It remains data passed directly to `runCli`.

Popup, audio, persistent logging, transcript evidence reuse, subagent events, and blocking Claude for contradicted claims remain outside this slice.

## Testing

- Unit-test Stop payload normalization and rejection of malformed or incomplete input.
- Integration-test truth, lie, no-claim, and config/verifier errors through the hook runner with temporary project configuration.
- Test package metadata and hook JSON paths.
- Build and validate the root plugin with Claude Code's plugin validator when the local CLI supports it.
- Run typecheck, lint, all tests, build, and `git diff --check`.

## Acceptance

1. A valid Stop event routes `last_assistant_message` and `cwd` through the existing CLI core.
2. Truth and lie evaluations produce matching non-blocking system messages.
3. A message without a supported claim produces no notification and runs no verifier.
4. Malformed input and runtime errors produce an error notification while the process exits `0`.
5. The plugin manifest and hook configuration resolve the compiled hook executable from `${CLAUDE_PLUGIN_ROOT}`.
6. No dependency or duplicate verification path is added.
