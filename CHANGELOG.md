# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-08-27

### Fixed

- Claim detection missed common phrasings, so real success claims went
  `UNVERIFIED` with no verdict. `TESTS_PASS` now also matches "passes both/all
  tests", "N tests pass", "the (test) suite passes", and "tests are now
  green/passing"; `BUG_FIXED` now matches plural "bugs fixed", "fixed both
  bugs", and "fixed the <name> bug".
- `FILE_CHANGED` / `FILE_CREATED` treated the word after
  changed/modified/updated/created as a filename, so "changed the condition to
  `i <= n`" produced a claim about a file named "to" → "File not found" →
  a false **LIE**. A file claim is now only raised when the target is
  path-shaped (has a separator or an extension).
- "all" / "both" / "every" test-pass claims are now marked `scope: all`, so a
  targeted test command still cannot prove them.

## [1.0.0] - 2026-08-27

First public release. Windows presentation target; core detection and
verification are platform-neutral.

### Added

- Deterministic success-claim detection across test, build, lint, bug-fix,
  generic completion, file, local-commit, push, implementation-complete, and
  service-running claim families, with speculation filtering and compound
  extraction.
- Evidence-safe verification: a passing check becomes `TRUTH` only when its
  evidence is fresh, relevant, and sufficient; contradicting evidence becomes
  `LIE`; missing or partial evidence stays `UNVERIFIED`; verifier failures and
  timeouts become `ERROR`. No second model, no uploads.
- Configured `verify`, `verifyTests`, `verifyBuild`, and `verifyLint` routes
  plus safe built-in filesystem and local Git inspection for file and commit
  claims.
- Claude Code `Stop`-hook integration with a per-project serialized queue that
  collapses duplicate events and never blocks Claude Code.
- Native Windows presentation: one centered, topmost TRUTH/LIE popup with
  configurable duration, manual dismissal, optional image, and optional local
  WAV playback; missing assets degrade to text or silence.
- Bundled default verdict media (`assets/truth.png`, `assets/lie.png`,
  `assets/truth.wav`, `assets/lie.wav`), used automatically when a project does
  not set `truthImage` / `lieImage` / `truthSound` / `lieSound`. Overridable
  via `CLAUDE_LIE_DETECTOR_ASSETS_DIR`.
- `--cwd`, `--config`, `--verify`, `--timeout-ms`, `--mute`, and `--no-popup`
  CLI overrides.
- Concise local diagnostics appended to `.claude-lie-detector.log`.
- Distribution as a Claude Code plugin, including
  `.claude-plugin/marketplace.json` for marketplace installs.

### Notes

- Remote push claims stay `UNVERIFIED` unless a configured verifier can prove
  them.
- On non-Windows platforms the hook runs and logs normally; verdict popup and
  sound are skipped.
