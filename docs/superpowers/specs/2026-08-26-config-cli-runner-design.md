# Config and CLI Runner Design

**Date:** 2026-08-26  
**Status:** Approved for planning

## Goal

Make the existing claim detector and verifier usable end to end from a packaged command-line entry point with persistent project configuration and temporary flag overrides.

## Configuration

The default project configuration file is `.claude-lie-detector.json` in the active working directory:

```json
{
  "verify": "npm test",
  "verifyTests": "npm test",
  "verifyBuild": "npm run build",
  "verifyLint": "npm run lint",
  "timeoutMs": 120000
}
```

`verify` is required. Claim-specific verifier fields and `timeoutMs` are optional. The default timeout remains 30 seconds when omitted. Commands must be non-empty strings and `timeoutMs` must be a positive integer.

This slice supports project configuration only. Global configuration, claim-rule customization, assets, popup settings, and audio settings remain deferred.

## CLI

The npm package exposes `claude-lie-detector` through its `bin` field. The command accepts:

```text
--text <assistant text>     required
--cwd <directory>          default: current directory
--config <file>            default: <cwd>/.claude-lie-detector.json
--verify <command>         override default verifier
--timeout-ms <integer>     override timeout
```

Arguments are parsed with a small local parser; no dependency is added. Unknown flags, missing values, missing `--text`, and invalid numeric values are usage errors.

## Data Flow

```text
arguments
  -> resolve cwd and config path
  -> read and parse JSON configuration
  -> apply CLI overrides
  -> validate effective configuration
  -> call evaluateMessage
  -> print structured JSON result
```

The CLI maps configuration into the existing verifier-routing interface. `verifyTests`, `verifyBuild`, and `verifyLint` route matching claims; missing claim-specific commands fall back to `verify`.

Assistant text is always data. Only commands from the configuration file or explicit `--verify` flag may execute.

## Output and Exit Codes

The evaluation result is serialized as JSON to standard output.

- Exit `0`: `TRUTH` or no verification-worthy claim.
- Exit `1`: `LIE`.
- Exit `2`: usage error, missing or invalid configuration, verifier timeout, or verifier execution error.

Concise human-readable errors go to standard error. A no-claim result prints `{}` and does not run a verifier.

## Files

- `src/config/index.ts`: read, parse, validate, and normalize JSON configuration.
- `src/cli/index.ts`: parse arguments, apply overrides, invoke orchestration, print output, and select exit code.
- `package.json`: expose the compiled CLI through `bin`.
- Focused unit and integration tests: use temporary configuration files and real Node verifier commands.

## Acceptance

1. A valid project config can produce `TRUTH` and exit `0`.
2. A failing configured verifier produces `LIE` and exit `1`.
3. A message without a supported claim prints `{}` and exits `0` without verification.
4. Claim-specific commands route through existing orchestration behavior.
5. `--verify` and `--timeout-ms` override persistent values for one invocation.
6. Missing, malformed, or invalid configuration exits `2` without running a verifier.
7. Timeout or verifier execution error exits `2` without a false verdict.
8. Unknown flags, missing values, and missing `--text` exit `2`.
9. Typecheck, lint, tests, and build pass without adding a dependency.
