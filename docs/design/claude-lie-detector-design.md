# Claude Lie Detector — Design Specification

**Date:** 2026-08-26  
**Status:** Approved MVP design  
**Primary target:** Claude Code  

## 1. Summary

Claude Lie Detector is a small local developer tool that reacts when a coding agent confidently claims that work is correct or complete, verifies that claim with a configured command, and displays a comic verdict:

- **TRUTH** when verification passes.
- **LIE** when verification fails.

The product is intentionally comedic, but its core mechanic is deterministic: it does not attempt to infer deception or intent. It detects confidence-style success claims and checks those claims against an executable verification command such as a test suite, build, or lint command.

The MVP targets Claude Code first, is designed for public release on GitHub, and should be packageable as a Claude Code plugin or plugin-adjacent extension using the currently supported hook/plugin mechanism.

## 2. Product Goal

Create a funny, instantly understandable developer tool that turns the phrase “this should work now” into an observable event:

1. Claude makes a confident success claim.
2. Claude Lie Detector triggers verification.
3. Verification passes or fails.
4. A centered image popup appears with a sound effect unless muted.

The project should be small enough to build and polish within one week.

## 3. Non-Goals

The MVP will **not**:

- Attempt semantic truth detection across arbitrary natural-language claims.
- Use a second LLM to judge whether Claude is lying.
- Inspect the screen with OCR or computer vision.
- Automatically modify source code.
- Automatically retry or correct failed work.
- Support every coding agent at launch.
- Upload source code, terminal output, or verification results to an external service.
- Include analytics, accounts, cloud sync, or a hosted backend.

These exclusions keep the first release local, predictable, funny, and easy to understand.

## 4. Core User Story

> As a Claude Code user, when Claude confidently says a change is fixed or should work, I want a local tool to verify that claim and dramatically show me a TRUTH or LIE image so I can laugh at overconfident failures while still getting a useful verification signal.

## 5. Primary Experience

### Truth path

```text
Claude:
“The issue is fixed and the tests should now pass.”

        ↓

Lie Detector recognizes a verification-worthy claim

        ↓

Configured verifier runs

        ↓

exit code 0

        ↓

Centered TRUTH image
+ truth sound if enabled
```

### Lie path

```text
Claude:
“This should work now.”

        ↓

Lie Detector recognizes a verification-worthy claim

        ↓

Configured verifier runs

        ↓

non-zero exit code

        ↓

Centered LIE image
+ lie sound if enabled
```

## 6. Verdict Semantics

The UI uses only two verdicts in V1:

### TRUTH

Displayed when the configured verification command exits successfully.

This means **the configured check passed**, not that every statement Claude made was objectively true.

### LIE

Displayed when the configured verification command exits unsuccessfully.

This means **Claude made a success-style claim and the configured check contradicted it**, not that Claude intentionally deceived the user.

The README should make this distinction explicit while preserving the joke.

Recommended tagline:

> **Claude Lie Detector — because “this should work now” is not a test suite.**

## 7. Claim Detection

The MVP should use local deterministic matching rather than another model.

### Initial trigger phrases

Examples include:

- `this should work`
- `this should now work`
- `the issue is fixed`
- `the bug is fixed`
- `all tests should pass`
- `the tests should now pass`
- `this is resolved`
- `this has been fixed`
- `the implementation is complete`
- `everything should work`

Matching should be:

- case-insensitive;
- tolerant of punctuation;
- configurable by the user;
- conservative enough not to trigger on every response.

### Trigger rule

A verdict is produced only when:

1. a configured confidence/success pattern matches the relevant Claude output; and
2. a verification command is configured and can be executed.

The detector should debounce repeated matching phrases from the same response so one Claude message produces at most one verification event.

## 8. Verification

### Verification command

Users configure one shell command, for example:

```text
npm test
```

or:

```text
pytest
```

or:

```text
npm run build
```

V1 uses a single command to keep verdict semantics obvious.

### Result mapping

```text
exit code 0     → TRUTH
exit code != 0  → LIE
command error   → no verdict; show/log verifier error
```

A command that cannot start should not be treated as a lie, because the tool did not obtain valid verification evidence.

### Process behavior

The verifier should:

- run in the active project directory;
- inherit a safe, minimal environment needed for normal project commands;
- capture stdout/stderr for local diagnostic logging;
- support a configurable timeout;
- avoid shell interpolation when an argv-style execution API can be used;
- never execute commands derived from Claude output.

Only user-configured commands may be executed.

## 9. Popup Experience

### Placement

The verdict should appear as a **large centered modal-style desktop popup**.

This is intentionally more dramatic than a notification toast but less disruptive than taking over the entire screen.

### Behavior

- Popup appears above normal windows where the OS permits.
- It shows only the user-provided verdict image plus minimal chrome.
- Default display duration: **1800 ms**.
- User can dismiss it immediately with **Esc** or click.
- The popup must not steal keyboard focus where avoidable.
- A second verdict replaces the first rather than spawning overlapping windows.

### Assets

The user supplies:

- `truth` image;
- `lie` image.

Supported MVP image formats:

- PNG;
- JPEG;
- WebP if the chosen UI runtime supports it reliably on all target platforms.

If an image is missing or invalid, the tool falls back to a simple text verdict rather than failing verification.

## 10. Sound

Each verdict may play a short local sound effect.

### Required controls

- Sound is enabled by default.
- Users can disable all audio in configuration.
- A runtime mute flag should be available for scripting/temporary use.
- Users can replace both verdict sounds with their own local files.

Example conceptual configuration:

```toml
sound = true
popup = true
popup_duration_ms = 1800
verification_timeout_seconds = 120

truth_image = "./assets/truth.png"
lie_image = "./assets/lie.png"
truth_sound = "./assets/truth.wav"
lie_sound = "./assets/lie.wav"

verify = "npm test"
```

The implementation may choose a different exact config schema if the selected runtime strongly favors JSON/YAML, but the behavior above is fixed.

## 11. Claude Code Integration

Claude Code is the first supported agent.

The integration layer should use the current official Claude Code extensibility mechanism available at implementation time, preferably hooks/plugin events that expose assistant lifecycle or output events without screen scraping.

The integration must remain isolated from the detector core so support for Codex or other coding agents can be added later without rewriting verification or UI logic.

Conceptual interface:

```text
Claude Code integration
        ↓
normalized assistant text event
        ↓
claim detector
        ↓
verifier
        ↓
verdict event
        ↓
popup + sound
```

If Claude Code's plugin API does not expose final assistant text directly enough for reliable phrase detection, the implementation should prefer the narrowest supported hook/event path that can observe or receive the relevant text. It should **not** fall back to OCR/screen scraping in V1.

## 12. Architecture

The project should be split into five small responsibilities.

### A. Integration adapter

Responsibility: receive Claude Code events and normalize relevant assistant text.

Produces:

```text
AssistantMessage {
  text: string
  cwd: string
  event_id: string
}
```

### B. Claim detector

Responsibility: determine whether an assistant message contains a configured success/confidence claim.

Produces:

```text
ClaimMatch {
  matched: boolean
  phrase?: string
}
```

### C. Verifier

Responsibility: run the configured local verification command and map its result to a verdict.

Produces:

```text
VerificationResult {
  verdict: "truth" | "lie" | "error"
  exit_code?: number
  stdout: string
  stderr: string
  duration_ms: number
}
```

### D. Presentation service

Responsibility: display the verdict popup and optionally play the associated sound.

Consumes:

```text
PresentationRequest {
  verdict: "truth" | "lie"
  image_path: string
  sound_path?: string
  sound_enabled: boolean
  duration_ms: number
}
```

### E. Configuration

Responsibility: load and validate user settings including trigger phrases, assets, verifier command, timeout, popup duration, and audio state.

## 13. Data Flow

```text
Claude Code event
       │
       ▼
Integration Adapter
       │
       ▼
AssistantMessage
       │
       ▼
Claim Detector ───── no match ───→ stop
       │
      match
       │
       ▼
Verifier
       │
       ├── command error ─────────→ log error; no verdict
       │
       ├── exit 0 ────────────────→ TRUTH
       │
       └── non-zero ──────────────→ LIE
                                      │
                                      ▼
                              Popup + optional sound
```

## 14. Concurrency and Debouncing

V1 should serialize verification runs per project.

If Claude emits another success claim while verification is already running:

- do not start a second verifier process immediately;
- retain at most one pending verification request;
- after the current run finishes, run the pending request only if it came from a different assistant event.

This prevents a burst of agent messages from opening many tests and many popups at once.

Each integration event should have a stable `event_id`, or an equivalent locally generated identifier, to enforce one verdict per assistant message.

## 15. Error Handling

The application should degrade humorously but safely.

### Missing configuration

No verification command:

```text
Lie Detector: verification command is not configured.
```

No verdict popup is shown.

### Verification timeout

Terminate the verifier process and log:

```text
Lie Detector: verification timed out after N seconds.
```

No TRUTH/LIE verdict is produced.

### Missing image

Use a basic centered text fallback for the verdict.

### Missing sound

Show the image silently and log a warning.

### Popup failure

Verification result is still written to the local log/terminal output.

### Claude integration failure

The detector should fail independently and never block Claude Code from continuing its normal work.

## 16. Privacy and Security

The MVP is local-first.

- No account is required.
- No telemetry is required.
- No source code is uploaded by Claude Lie Detector.
- No assistant transcript is sent to another model.
- Verification output stays local.
- The tool executes only the user-configured verifier command.
- Claude output must never be interpreted as shell commands.
- The popup renderer must treat assistant text and file paths as data, not executable content.

## 17. Configuration UX

The first-run path should be simple enough for a GitHub README:

1. Install the plugin/tool.
2. Add TRUTH and LIE images.
3. Configure the verification command.
4. Optionally replace sounds.
5. Run Claude Code normally.

A sensible default project configuration should be supported, while users may override settings globally if the implementation platform makes that straightforward.

## 18. CLI / User Controls

The exact CLI syntax will be finalized in implementation planning, but V1 must expose behavior equivalent to:

```text
claude-lie-detector --mute
claude-lie-detector --no-popup
claude-lie-detector --verify "npm test"
```

Persistent config should remain the normal path; flags are temporary overrides.

## 19. Observability

A minimal local text log is sufficient.

Example:

```text
[10:14:03] claim detected: "this should now work"
[10:14:03] running: npm test
[10:14:11] exit=1 duration=8124ms
[10:14:11] verdict=LIE
```

Do not build dashboards, databases, or analytics for V1.

## 20. Testing Strategy

### Unit tests

Test:

- trigger phrase matching;
- punctuation/case handling;
- false-positive cases;
- message debouncing;
- exit-code-to-verdict mapping;
- timeout mapping;
- missing asset fallback;
- config validation;
- mute behavior.

### Integration tests

Use a fake Claude adapter and small fixture commands that intentionally:

- exit 0;
- exit non-zero;
- time out.

Verify that the expected presentation request is emitted.

### Manual platform tests

Before release, manually verify:

- popup centering;
- popup dismissal;
- audio playback;
- mute behavior;
- image replacement;
- Claude Code integration;
- failed verifier does not block Claude Code.

## 21. Platform Scope

The implementation plan should choose one primary development platform first rather than attempting perfect cross-platform behavior immediately.

The core logic must remain platform-neutral, while popup/audio implementations may require adapters.

Preferred release strategy:

1. Make the developer's primary OS excellent.
2. Keep interfaces clean enough to add macOS/Linux/Windows presentation adapters.
3. Document tested platforms honestly in the README.

## 22. Repository Shape

Recommended responsibility-oriented structure:

```text
claude-lie-detector/
├── README.md
├── LICENSE
├── assets/
│   ├── truth.*
│   ├── lie.*
│   ├── truth-sound.*
│   └── lie-sound.*
├── src/
│   ├── config/
│   ├── detector/
│   ├── verifier/
│   ├── presentation/
│   └── integrations/
│       └── claude-code/
├── tests/
└── plugin/                 # if required by Claude Code packaging
```

The exact filenames and language-specific layout belong in the implementation plan after selecting the runtime.

## 23. README Positioning

The GitHub page should lead with the joke, then immediately explain the deterministic mechanism.

Suggested opening:

> # Claude Lie Detector
>
> Because “this should work now” is not a test suite.
>
> Claude says it fixed the bug. We run your verification command. If reality disagrees, you get a giant **LIE** popup.

The README should include:

- a short GIF/video demo;
- installation;
- Claude Code setup;
- configuration;
- custom image/sound instructions;
- mute instructions;
- supported platforms;
- explanation of what “LIE” means technically;
- privacy/security notes.

## 24. Future Ideas — Explicitly Out of V1

Potential later additions:

- Codex integration;
- Gemini CLI integration;
- user-defined multiple verification stages;
- streaks / trust score;
- “UNDER OATH” after repeated failures;
- confidence-vs-reality history;
- custom verdict themes;
- model leaderboard;
- community asset packs;
- auto-selection of test/build commands;
- optional semantic classification of success claims.

These should not delay the first usable GitHub release.

## 25. MVP Acceptance Criteria

The MVP is complete when all of the following are true:

1. Claude Code output can trigger the detector through a supported integration path.
2. A configurable success phrase can trigger verification.
3. The tool runs one user-configured verification command in the active project.
4. Exit code `0` produces TRUTH.
5. Non-zero exit code produces LIE.
6. A user-provided TRUTH image can appear in a centered popup.
7. A user-provided LIE image can appear in a centered popup.
8. Each verdict can play a configurable local sound.
9. Sound can be globally muted.
10. Popup duration is configurable and the popup can be dismissed manually.
11. Missing images/sounds do not crash the tool.
12. A verifier error or timeout does not incorrectly become TRUTH or LIE.
13. Claude output is never executed as a shell command.
14. One assistant message cannot accidentally trigger multiple simultaneous verdicts.
15. Core detector/verifier logic has automated tests.
16. The repository contains public-facing installation and configuration documentation.

## 26. Current Integration Note

Claude Code and Claude's broader tooling continue to evolve. Anthropic's current documentation supports extensibility and tool/hook-style workflows, but the exact Claude Code plugin event surface should be re-verified immediately before implementation and pinned/documented in the repository. The design deliberately isolates the Claude adapter so this external interface can change without affecting the detector, verifier, or presentation components.

Relevant Anthropic documentation consulted during design:

- https://docs.anthropic.com/
- https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations

## 27. Design Principle

The project should always preserve this ratio:

> **One stupid joke + one real engineering mechanism.**

If a proposed feature makes the project significantly harder without making the joke clearer or the verification more useful, it does not belong in V1.
