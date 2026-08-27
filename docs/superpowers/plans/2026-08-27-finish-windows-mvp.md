# Finish Windows MVP Implementation Plan

**Goal:** Complete the approved Windows MVP with defensible evidence states, safe local inspection, native popup/audio presentation, serialization, logging, and release documentation.

**Architecture:** Keep detector, evidence, orchestration, presentation, config, and Claude Code integration as the existing ownership boundaries. Use Node standard library for evidence and coordination, and a bundled PowerShell/WPF script for Windows presentation; add no runtime dependency.

**Spec:** `docs/design/claude-lie-detector-design.md`

## Constraints

- Claude output remains data and never becomes a command.
- Only configured commands and fixed local filesystem/Git inspection may execute.
- `UNVERIFIED` and `ERROR` never produce TRUTH/LIE presentation.
- Serialize verification per project and retain at most one pending distinct event.
- Windows is the only presentation target for this release.
- No remote push verification, transcript evidence reuse, other agents, dashboards, themes, or integrity heuristics.
- Use focused tests for non-trivial evidence/verdict/concurrency behavior; verify straightforward wiring after implementation.

## Task 1: Evidence-safe verdict engine

**Files:**
- Modify: `src/detector/index.ts`
- Implement: `src/evidence/index.ts`
- Modify: `src/orchestration/index.ts`
- Modify: `src/config/index.ts`
- Modify: `src/cli/index.ts`
- Modify/add focused detector, evidence, orchestration, config, and CLI tests

**Outcome:**

- Add claim kinds `FILE_CHANGED`, `FILE_CREATED`, `COMMITTED`, `PUSHED`, `IMPLEMENTATION_COMPLETE`, and `SERVICE_RUNNING`.
- Preserve compound extraction and conservative hedge/question rejection.
- Represent each claim evaluation with `supported`, `contradicted`, `unverified`, or `error` plus a reason and evidence.
- Configured command results are fresh because they run after the triggering event; command errors map to `error`.
- A universal “all tests pass” claim is `unverified` unless the selected tests command is the configured full-suite route. An explicit `verifyTests` route is treated as full-suite user intent; otherwise only the default verifier may support it.
- Inspect file-created/file-changed claims through `fs.stat` and `git status --porcelain -- <path>` without a shell-derived path.
- Inspect `COMMITTED` using fixed Git argv calls. Represent `PUSHED` but return `unverified` unless a configured default verifier handles it.
- Final message verdict: any contradiction → lie; otherwise any supported claim and no errors → truth; all unverified → no verdict; any error → no verdict/error.
- Keep current CLI exit codes: truth/no verdict `0`, lie `1`, any error `2`.

**Proof:** focused tests for four evidence states, partial all-tests protection, stale/missing file behavior, local commit inspection, compound contradiction, and error precedence; then full suite/typecheck/lint/build.

**Commit:** `feat: add evidence-safe verdicts`

## Task 2: Native Windows presentation and runtime controls

**Files:**
- Implement: `src/presentation/windows/index.ts`
- Create: `src/presentation/windows/show-verdict.ps1`
- Modify: `src/config/index.ts`
- Modify: `src/cli/index.ts`
- Modify: `src/integrations/claude-code/index.ts`
- Add focused presentation/config/integration tests

**Outcome:**

- Extend project JSON config with optional `popup`, `popupDurationMs`, `sound`, `truthImage`, `lieImage`, `truthSound`, and `lieSound`.
- Add temporary `--mute` and `--no-popup` flags.
- On Windows, spawn `powershell.exe -NoProfile -ExecutionPolicy Bypass -File ...` with verdict/assets/duration passed as argv.
- WPF shows one centered topmost window, uses an existing valid image or text fallback, closes after the configured duration, and dismisses on click or Esc.
- Play an existing local WAV asynchronously when sound is enabled; missing/invalid assets degrade silently to text/no sound.
- Presentation errors remain non-blocking and are returned for logging.
- Claude Stop integration invokes presentation only for truth/lie; no claim, unverified, and error remain notification-only/no-popup.

**Proof:** config and argv construction tests plus one process-boundary adapter test; manual script smoke check where Windows GUI execution is available; then full gates.

**Commit:** `feat: present Windows verdicts`

## Task 3: Serialize, log, and release

**Files:**
- Modify: `src/integrations/claude-code/index.ts`
- Implement: `src/shared/index.ts`
- Modify: `README.md`
- Modify: `plugin/README.md`
- Modify: `.gitignore` if the local log needs exclusion
- Add focused queue/debounce and logging tests

**Outcome:**

- Generate a stable event identity from Stop `session_id` plus the message text when no explicit message ID exists.
- Maintain one in-process queue per project: one active evaluation and at most one pending distinct event; duplicate events collapse.
- Append concise local lines to `.claude-lie-detector.log` for claim, verifier/evidence state, verdict, errors, and presentation warnings; logging failure never blocks Claude.
- Strengthen the mixed-route verifier-error test so it proves a simultaneous lie plus error deterministically.
- Document installation, `claude --plugin-dir .`, configuration, images/sounds, mute/no-popup, verdict semantics, Windows scope, privacy/security, and known validator/manual-test limitations.
- Reconcile all 25 MVP acceptance criteria against tests or documented manual checks.

**Proof:** queue/debounce/log tests, deterministic mixed-route regression, full typecheck/lint/tests/build/diff check, npm package contents check, Claude plugin validation when available, and explicit manual Windows checklist.

**Commit:** `feat: finish Windows MVP`

## Stop Condition

Stop when the 25 approved MVP criteria are either proven automatically or listed as manual Windows checks with no known runtime blocker. Do not add post-MVP features.
