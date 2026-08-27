# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
