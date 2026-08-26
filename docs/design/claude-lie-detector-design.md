# Claude Lie Detector — Design Specification

**Date:** 2026-08-26  
**Status:** Approved MVP design  
**Primary target:** Claude Code  

## 1. Summary

Claude Lie Detector is a small local developer tool that reacts when a coding agent confidently claims that work is correct or complete, gathers claim-relevant evidence, and displays a comic verdict:

- **TRUTH** when fresh, relevant, sufficient evidence supports the claim.
- **LIE** when fresh, relevant evidence directly contradicts the claim.
- No public verdict when evidence is missing, stale, insufficient, or unavailable.

The product is intentionally comedic, but its core mechanic is deterministic: it does not attempt to infer deception or intent. It detects confidence-style success claims and checks them against user-configured commands or fixed local inspections appropriate to each claim.

The MVP targets Claude Code first, is designed for public release on GitHub, and should be packageable as a Claude Code plugin or plugin-adjacent extension using the currently supported hook/plugin mechanism.

## 2. Product Goal

Create a funny, instantly understandable developer tool that turns the phrase “this should work now” into an observable event:

1. Claude makes a confident success claim.
2. Claude Lie Detector triggers verification.
3. Fresh evidence supports, contradicts, or cannot verify the claim.
4. A centered image popup appears for supported or contradicted claims, with a sound effect unless muted.

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

Claim-relevant verifier runs

        ↓

fresh, relevant, sufficient evidence supports the claim

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

Claim-relevant verifier runs

        ↓

fresh, relevant evidence directly contradicts the claim

        ↓

Centered LIE image
+ lie sound if enabled
```

## 6. Verdict Semantics

The public UI uses two theatrical verdicts in V1:

### TRUTH

Displayed when Claude made a verification-worthy claim and the detector obtained **fresh, claim-relevant evidence that supports it**.

This means **the checked claim is supported by the configured evidence**, not that every statement Claude made was objectively true.

### LIE

Displayed when Claude made a verification-worthy claim and the detector obtained **fresh, claim-relevant evidence that directly contradicts it**.

This means **the evidence contradicted the success-style claim**, not that Claude intentionally deceived the user.

### Internal evidence states

The engine should use four internal states even though the comic UI remains binary:

```text
SUPPORTED      → eligible for TRUTH
CONTRADICTED   → eligible for LIE
UNVERIFIED     → no TRUTH/LIE verdict by default
ERROR          → no TRUTH/LIE verdict; show/log verifier error
```

`UNVERIFIED` is important. Missing evidence is not evidence of failure. For example, a passing test suite does not prove that a claimed Git push occurred, and a partial test run does not prove that **all** tests pass.

A future theme may expose `UNVERIFIED` with a comic label such as `NO RECEIPTS`, but V1 should default to no verdict so the meaning of TRUTH and LIE stays defensible.

The README should make this distinction explicit while preserving the joke.

Recommended tagline:

> **Claude Lie Detector — because “this should work now” is not a test suite.**

Secondary positioning:

> **Claude takes a victory lap. Lie Detector demands receipts.**

## 7. Claim Detection

The MVP should use local deterministic classification rather than another model.

The detector should not depend on a flat list of complete trigger sentences. Instead it should recognize a small number of **claim families**, estimate how strongly the assistant is asserting them, and decide whether the message is taking a verification-worthy “victory lap.”

### Claim families

Initial claim types should include:

```text
TESTS_PASS
BUILD_PASSES
LINT_CLEAN
BUG_FIXED
FILE_CHANGED
FILE_CREATED
COMMITTED
PUSHED
IMPLEMENTATION_COMPLETE
SERVICE_RUNNING
GENERIC_SUCCESS
```

Examples:

| Assistant statement | Normalized claim |
| --- | --- |
| “All 47 tests are green.” | `TESTS_PASS(scope=all)` |
| “pytest passes now.” | `TESTS_PASS(scope=unknown)` |
| “The project builds successfully.” | `BUILD_PASSES` |
| “Lint is clean.” | `LINT_CLEAN` |
| “The login bug is fixed.” | `BUG_FIXED` |
| “I added `foo.test.ts`.” | `FILE_CREATED(path=foo.test.ts)` |
| “I committed the changes.” | `COMMITTED` |
| “The changes are pushed.” | `PUSHED` |
| “That is fully implemented.” | `IMPLEMENTATION_COMPLETE` |
| “The server is running.” | `SERVICE_RUNNING` |
| “This should work now.” | `GENERIC_SUCCESS` |

Detection may use configurable word groups, regular expressions, and narrow parsing rules. It should be:

- case-insensitive;
- tolerant of punctuation and minor wording variation;
- configurable by the user;
- conservative enough not to trigger on ordinary planning or analysis;
- able to extract more than one claim from one assistant message.

### Confidence level

A claim and its confidence should be represented separately.

Suggested confidence levels:

```text
SPECULATION       “this might fix it”
PREDICTION        “this should fix it”
ASSERTION         “this fixes the issue”
STRONG_ASSERTION  “fixed”, “done”, “all tests pass”
```

By default:

- `SPECULATION` does not trigger;
- `PREDICTION` is configurable;
- `ASSERTION` and `STRONG_ASSERTION` trigger when the claim is verifiable.

Hedging terms such as `maybe`, `might`, `I think`, and `likely` should reduce confidence. Completion language such as `fixed`, `resolved`, `done`, `passes`, `working`, and `complete` should increase it.

### Victory-lap score

The detector may implement the trigger decision as a small deterministic score. The exact weights may change during implementation, but the model should resemble:

```text
completion verb                         +2
fixed/resolved/passing/working          +2
unqualified factual assertion           +2
“now” / “done” / “complete”             +1
hedge (“maybe”, “might”, “I think”)     -3
future/planning language                 -2
question                                 -3
```

A configurable threshold determines whether the assistant is confidently declaring success rather than merely discussing a possible outcome.

The internal name `victory_lap_score` is acceptable and matches the product personality.

### Compound claims

One assistant response may contain multiple independent claims:

```text
“The bug is fixed, all tests pass, and I pushed the changes.”
```

should become approximately:

```text
BUG_FIXED
TESTS_PASS(scope=all)
PUSHED
```

Each claim is evaluated independently. One contradicted claim is enough for the response to be eligible for a LIE verdict. The popup/log should identify the contradicted claim when possible.

### Trigger rule

A verdict is considered only when:

1. one or more supported claim patterns are recognized;
2. the confidence/victory-lap threshold is met; and
3. appropriate evidence can be obtained for at least one claim.

Repeated wording in the same assistant response must be debounced so one response produces at most one presentation event, even if it contains several claims.

## 8. Verification

Verification should answer a narrower question than “is the whole project healthy?” It should ask: **does available evidence support the claim Claude actually made?**

### Evidence sources

The detector may obtain evidence from two places:

1. **existing fresh evidence** already produced during the current agent session, when the integration surface exposes enough structured information; and
2. **active verification** performed by Claude Lie Detector.

V1 may ship active verification first if transcript/tool-event evidence is not reliably available through the Claude Code integration, but the core data model should allow both.

### Evidence freshness

Passing evidence becomes stale when relevant project state changes after the check.

Conceptually:

```text
source edit
    ↓
test run passes
    ↓
source edit
    ↓
claim: “all tests pass”
```

The old result must not support the new claim.

For claims tied to mutable project state, evidence should normally satisfy:

```text
verification time > latest relevant mutation time
```

When freshness cannot be established reliably, the result should be `UNVERIFIED` rather than incorrectly producing TRUTH.

### Evidence scope

Evidence must be broad enough to support the claim.

For example:

```text
pytest tests/test_auth.py   → 6 passed
Claude: “All tests pass.”
```

The evidence supports that selected test target, but not necessarily `TESTS_PASS(scope=all)`. This should become `UNVERIFIED` or a narrower supported claim, not TRUTH for the universal claim.

### Claim-specific verifiers

The tool should support one default project verifier plus narrow built-in or configured verifiers for common claim types.

Conceptual configuration:

```toml
verify = "npm test"
verify_tests = "npm test"
verify_build = "npm run build"
verify_lint = "npm run lint"
```

The exact schema may differ.

Some claim types should use direct local inspection rather than shell commands where practical:

```text
FILE_CREATED / FILE_CHANGED  → filesystem + git diff
COMMITTED                    → local git state/log
PUSHED                       → compare local and upstream refs
SERVICE_RUNNING              → configured process/port/health check
```

`BUG_FIXED`, `IMPLEMENTATION_COMPLETE`, and `GENERIC_SUCCESS` may fall back to the default configured verifier because their semantics are project-specific.

### Result mapping

Active command execution still produces a low-level result:

```text
exit code 0     → passing command evidence
exit code != 0  → failing command evidence
command error   → ERROR
```

The verdict engine then asks whether that result is relevant and sufficient for the normalized claim:

```text
fresh + relevant + sufficient + passing      → SUPPORTED
fresh + relevant + directly failing          → CONTRADICTED
missing / stale / partial / wrong evidence   → UNVERIFIED
command or inspection failure                → ERROR
```

A command that cannot start must never be treated as a lie because no valid verification evidence was obtained.

### Post-MVP verification integrity

A passing verifier can still be suspicious if the agent made the check easier rather than fixing the implementation.

A later release may inspect relevant diffs for obvious verification-degrading changes such as:

- newly skipped or disabled tests;
- deleted tests;
- removed or clearly weakened assertions;
- failure-swallowing patterns such as `|| true` in verification scripts.

### Process behavior

When active commands are required, the verifier should:

- run in the active project directory;
- inherit a safe, minimal environment needed for normal project commands;
- capture stdout/stderr for local diagnostic logging;
- support a configurable timeout;
- avoid shell interpolation when an argv-style execution API can be used;
- never execute commands derived from Claude output.

Only user-configured commands or built-in fixed inspection operations may be executed.

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

Responsibility: extract one or more normalized, verification-worthy claims from an assistant message and estimate assertion strength.

Produces:

```text
ClaimMatch {
  matched: boolean
  claims: Claim[]
  victory_lap_score: number
}

Claim {
  kind: string
  confidence: "speculation" | "prediction" | "assertion" | "strong_assertion"
  scope?: string
  subject?: string
  source_text: string
}
```

### C. Evidence + verifier engine

Responsibility: collect fresh claim-relevant evidence, run an active verifier when needed, and evaluate whether the evidence supports or contradicts each normalized claim.

Produces:

```text
ClaimEvaluation {
  claim: Claim
  state: "supported" | "contradicted" | "unverified" | "error"
  evidence?: Evidence[]
  reason?: string
}

Evidence {
  kind: string
  observed_at: number
  scope?: string
  passing?: boolean
  details?: string
}

VerificationResult {
  exit_code?: number
  stdout: string
  stderr: string
  duration_ms: number
  error?: string
}
```

The engine should keep claim evaluation separate from low-level command exit codes so a successful but irrelevant or stale command cannot automatically become TRUTH.

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

Responsibility: load and validate user settings including claim rules, confidence threshold, claim-specific/default verifiers, assets, timeout, popup duration, and audio state.

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
Claim Detector ───── no verification-worthy claim ───→ stop
       │
       ▼
Normalized claim(s) + victory-lap score
       │
       ▼
Evidence Engine
       │
       ├── collect fresh existing evidence if available
       │
       ├── run claim-specific/default verifier when needed
       │
       └── inspect evidence scope + freshness + integrity
       │
       ▼
Claim Evaluation
       │
       ├── all relevant claims unsupported/unverified ──→ no verdict
       ├── evaluation error ────────────────────────────→ log error; no verdict
       ├── any contradicted claim ──────────────────────→ LIE
       └── supported claim(s), none contradicted ───────→ TRUTH
                                                        │
                                                        ▼
                                                Popup + optional sound
```

When a message contains multiple claims, the presentation service should prefer the most important contradicted claim for a LIE receipt. For TRUTH, it may show the strongest supported claim or remain image-only.

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
[10:14:03] claim detected: kind=GENERIC_SUCCESS confidence=prediction score=5
[10:14:03] running: npm test
[10:14:11] exit=1 duration=8124ms
[10:14:11] evaluation=CONTRADICTED reason="configured verifier failed"
[10:14:11] verdict=LIE claim=GENERIC_SUCCESS
```

Do not build dashboards, databases, or analytics for V1.

## 20. Testing Strategy

### Unit tests

Test:

- claim-family detection;
- wording variation and punctuation/case handling;
- confidence/hedging classification;
- victory-lap scoring and threshold behavior;
- false-positive cases from planning, questions, and speculation;
- compound-claim extraction;
- message debouncing;
- claim-to-verifier routing;
- exit-code-to-evidence mapping;
- `SUPPORTED` / `CONTRADICTED` / `UNVERIFIED` / `ERROR` mapping;
- stale evidence after a relevant source edit;
- partial test evidence versus an “all tests pass” claim;
- file-created/file-changed inspection;
- git commit/push inspection where supported;
- verification-integrity warnings for obvious skipped/deleted/weakened tests;
- timeout mapping;
- missing asset fallback;
- config validation;
- mute behavior.

### Integration tests

Use a fake Claude adapter plus fixture projects/events that intentionally exercise:

- a fresh passing verifier;
- a fresh failing verifier;
- a verifier timeout;
- a passing test run followed by a source edit and then a passing claim;
- a subset test run followed by an “all tests pass” claim;
- a compound response with both supported and contradicted claims;
- a file/Git claim that can be checked without the default test command.

Verify that the expected internal claim evaluations and final presentation request are emitted.

### Manual platform tests

Before release, manually verify:

- popup centering;
- popup dismissal;
- audio playback;
- mute behavior;
- image replacement;
- Claude Code integration;
- claim receipts/logging are understandable;
- failed or unverifiable checks do not block Claude Code;
- no `UNVERIFIED` or `ERROR` state is incorrectly presented as TRUTH/LIE.

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
> Claude takes a victory lap. We demand receipts. If fresh, relevant evidence disagrees, you get a giant **LIE** popup.

The README should include:

- a short GIF/video demo;
- installation;
- Claude Code setup;
- configuration;
- custom image/sound instructions;
- mute instructions;
- supported platforms;
- explanation of what “TRUTH”, “LIE”, and internal `UNVERIFIED` mean technically;
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
- optional LLM-assisted claim classification for ambiguous statements;
- visible `NO RECEIPTS` / `TECHNICALLY TRUE` / `SUSPICIOUSLY TRUE` verdict themes;
- deeper verification-integrity analysis beyond deterministic heuristics.

These should not delay the first usable GitHub release.

### Phased MVP boundary

The architecture supports the complete evidence model, but the first usable release should implement it in this order:

1. normalized claim families, confidence classification, victory-lap scoring, and compound extraction;
2. a default verifier plus configured test, build, and lint routes;
3. `SUPPORTED`, `CONTRADICTED`, `UNVERIFIED`, and `ERROR` evaluation;
4. basic evidence freshness using locally observable project mutations;
5. filesystem and local Git inspection for file and commit claims;
6. popup, sound, configuration, logging, and Claude Code integration.

Remote push verification, session-derived evidence from tool events, visible third-state themes, and verification-integrity heuristics are post-MVP work. The claim model may represent `PUSHED` in V1, but it remains `UNVERIFIED` unless the user explicitly configures a reliable verifier.

## 25. MVP Acceptance Criteria

The MVP is complete when all of the following are true:

1. Claude Code output can trigger the detector through a supported integration path.
2. The detector can recognize configurable verification-worthy success claims without requiring exact full-sentence matches.
3. The detector distinguishes speculation/prediction from stronger assertions well enough to avoid obvious planning-language triggers.
4. One assistant response may contain multiple normalized claims while still producing at most one presentation event.
5. At least `TESTS_PASS`, `BUILD_PASSES`, `LINT_CLEAN`, `BUG_FIXED`/generic success, and basic file/Git claim categories can be represented by the claim model, even if some use the default verifier in V1.
6. The tool can run one user-configured default verification command in the active project.
7. Claim-specific verification can use the default command, configured commands, or safe built-in local inspection as appropriate.
8. A passing command becomes TRUTH only when its evidence is fresh, relevant, and sufficient for the claim being evaluated.
9. Fresh evidence that directly contradicts a claim produces LIE.
10. Missing, stale, partial, or unrelated evidence becomes `UNVERIFIED` and does not incorrectly produce TRUTH or LIE.
11. A verifier error or timeout becomes `ERROR` and does not incorrectly produce TRUTH or LIE.
12. A passing subset of tests cannot by itself prove an “all tests pass” claim.
13. Evidence generated before a later relevant source mutation cannot prove a post-mutation success claim.
14. A contradicted claim inside a compound response is enough to produce a LIE presentation, with the contradicted claim recorded when possible.
15. A user-provided TRUTH image can appear in a centered popup.
16. A user-provided LIE image can appear in a centered popup.
17. Each verdict can play a configurable local sound.
18. Sound can be globally muted.
19. Popup duration is configurable and the popup can be dismissed manually.
20. Missing images/sounds do not crash the tool.
21. Claude output is never executed as a shell command.
22. Only user-configured verifier commands or fixed built-in inspection operations may execute.
23. One assistant message cannot accidentally trigger multiple simultaneous verdicts.
24. Core claim-detection, evidence, freshness, scope, and verifier logic has automated tests.
25. The repository contains public-facing installation, configuration, verdict-semantics, and privacy/security documentation.

## 26. Current Integration Note

Claude Code and Claude's broader tooling continue to evolve. Anthropic's current documentation supports extensibility and tool/hook-style workflows, but the exact Claude Code plugin event surface should be re-verified immediately before implementation and pinned/documented in the repository. The design deliberately isolates the Claude adapter so this external interface can change without affecting the detector, verifier, or presentation components.

Relevant Anthropic documentation consulted during design:

- https://docs.anthropic.com/
- https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/reduce-hallucinations

## 27. Design Principle

The project should always preserve this ratio:

> **One stupid joke + one real engineering mechanism.**

If a proposed feature makes the project significantly harder without making the joke clearer or the verification more useful, it does not belong in V1.
