# Core Verdict Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect a confident test-pass claim, run a caller-provided verifier, and return a structured `truth`, `lie`, or no-verdict result.

**Architecture:** Keep the existing detector, verifier, and orchestration boundaries. The detector remains pure; the verifier alone owns process execution; orchestration composes both and maps evidence to a verdict.

**Tech Stack:** Node.js 22+, TypeScript, Vitest, Node `child_process.exec`

**Spec:** `docs/superpowers/specs/2026-08-26-core-verdict-slice-design.md`

## Global Constraints

- Execute only the verifier command supplied by the caller; never derive commands from assistant text.
- Add no dependency and no new abstraction layer.
- Ignore hedged, future, and question wording in this slice.
- Treat verifier launch failures and timeouts as errors with no verdict.
- Keep configuration files, CLI, Claude Code integration, popup, audio, evidence freshness, evidence scope, and other claim families outside this slice.

---

### Task 1: Detect confident test-pass claims

**Files:**
- Modify: `src/detector/index.ts`
- Create: `tests/unit/detector.test.ts`

**Interfaces:**
- Consumes: assistant message text as `string`
- Produces: `detectTestPassClaim(text: string): Claim | undefined`, where `Claim` has `kind: 'TESTS_PASS'`, `confidence: 'strong_assertion'`, and `sourceText: string`

- [ ] **Step 1: Write failing detector tests**

```ts
import { describe, expect, it } from 'vitest';

import { detectTestPassClaim } from '../../src/detector/index.js';

describe('detectTestPassClaim', () => {
  it.each(['All tests pass.', 'Tests are green!', 'vitest passed'])('detects %s', (text) => {
    expect(detectTestPassClaim(text)).toEqual({
      kind: 'TESTS_PASS',
      confidence: 'strong_assertion',
      sourceText: text,
    });
  });

  it.each(['Maybe the tests pass.', 'The tests should pass.', 'Will the tests pass?'])(
    'ignores %s',
    (text) => expect(detectTestPassClaim(text)).toBeUndefined(),
  );
});
```

- [ ] **Step 2: Run detector tests and confirm failure**

Run: `npm test -- --run tests/unit/detector.test.ts`

Expected: FAIL because `detectTestPassClaim` is not exported.

- [ ] **Step 3: Implement the pure detector**

```ts
export interface Claim {
  kind: 'TESTS_PASS';
  confidence: 'strong_assertion';
  sourceText: string;
}

const TEST_PASS =
  /\b(?:(?:all\s+)?tests?\s+(?:pass(?:ed|es|ing)?|are\s+(?:green|passing))|(?:npm test|pytest|vitest)\s+pass(?:ed|es)?)\b/i;
const NON_ASSERTION = /\b(?:maybe|might|may|could|i think|probably|likely|should|will|going to|plan to)\b/i;

export function detectTestPassClaim(text: string): Claim | undefined {
  if (text.includes('?') || NON_ASSERTION.test(text) || !TEST_PASS.test(text)) return undefined;

  return { kind: 'TESTS_PASS', confidence: 'strong_assertion', sourceText: text };
}
```

- [ ] **Step 4: Run detector tests**

Run: `npm test -- --run tests/unit/detector.test.ts`

Expected: PASS, 6 cases.

- [ ] **Step 5: Commit detector**

```powershell
git add src/detector/index.ts tests/unit/detector.test.ts
git commit -m "feat: detect test pass claims"
```

---

### Task 2: Run a caller-provided verifier

**Files:**
- Modify: `src/verifier/index.ts`
- Create: `tests/unit/verifier.test.ts`

**Interfaces:**
- Consumes: `VerifierOptions { command: string; cwd: string; timeoutMs?: number }`
- Produces: `runVerifier(options: VerifierOptions): Promise<VerificationResult>` with `exitCode?: number`, `stdout`, `stderr`, `durationMs`, and `error?: string`

- [ ] **Step 1: Write failing verifier tests**

```ts
import { describe, expect, it } from 'vitest';

import { runVerifier } from '../../src/verifier/index.js';

const node = JSON.stringify(process.execPath);

describe('runVerifier', () => {
  it('captures a passing command', async () => {
    const result = await runVerifier({
      command: `${node} -e "console.log('green')"`,
      cwd: process.cwd(),
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('green');
    expect(result.error).toBeUndefined();
  });

  it('captures a failing command as evidence, not an execution error', async () => {
    const result = await runVerifier({
      command: `${node} -e "process.exit(2)"`,
      cwd: process.cwd(),
    });

    expect(result.exitCode).toBe(2);
    expect(result.error).toBeUndefined();
  });

  it('returns timeout as an execution error', async () => {
    const result = await runVerifier({
      command: `${node} -e "setTimeout(() => {}, 1_000)"`,
      cwd: process.cwd(),
      timeoutMs: 10,
    });

    expect(result.exitCode).toBeUndefined();
    expect(result.error).toBe('Verifier timed out after 10ms');
  });
});
```

- [ ] **Step 2: Run verifier tests and confirm failure**

Run: `npm test -- --run tests/unit/verifier.test.ts`

Expected: FAIL because `runVerifier` is not exported.

- [ ] **Step 3: Implement verifier execution with Node standard library**

```ts
import { exec } from 'node:child_process';

export interface VerifierOptions {
  command: string;
  cwd: string;
  timeoutMs?: number;
}

export interface VerificationResult {
  exitCode?: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
}

export function runVerifier({
  command,
  cwd,
  timeoutMs = 30_000,
}: VerifierOptions): Promise<VerificationResult> {
  const startedAt = performance.now();

  return new Promise((resolve) => {
    exec(command, { cwd, timeout: timeoutMs }, (error, stdout, stderr) => {
      const durationMs = performance.now() - startedAt;

      if (!error) {
        resolve({ exitCode: 0, stdout, stderr, durationMs });
      } else if (error.killed) {
        resolve({ stdout, stderr, durationMs, error: `Verifier timed out after ${timeoutMs}ms` });
      } else if (typeof error.code === 'number') {
        resolve({ exitCode: error.code, stdout, stderr, durationMs });
      } else {
        resolve({ stdout, stderr, durationMs, error: error.message });
      }
    });
  });
}
```

- [ ] **Step 4: Run verifier tests**

Run: `npm test -- --run tests/unit/verifier.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit verifier**

```powershell
git add src/verifier/index.ts tests/unit/verifier.test.ts
git commit -m "feat: run configured verifier"
```

---

### Task 3: Produce the core verdict

**Files:**
- Modify: `src/orchestration/index.ts`
- Create: `tests/unit/orchestration.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: `EvaluationOptions { text: string; command: string; cwd: string; timeoutMs?: number }`, `detectTestPassClaim`, and `runVerifier`
- Produces: `evaluateMessage(options: EvaluationOptions): Promise<EvaluationResult>`, where `verdict?: 'truth' | 'lie'`, `claim?: Claim`, and `verification?: VerificationResult`

- [ ] **Step 1: Write failing orchestration tests**

```ts
import { describe, expect, it } from 'vitest';

import { evaluateMessage } from '../../src/orchestration/index.js';

const node = JSON.stringify(process.execPath);

describe('evaluateMessage', () => {
  it('returns truth for a supported claim', async () => {
    const result = await evaluateMessage({
      text: 'All tests pass.',
      command: `${node} -e "process.exit(0)"`,
      cwd: process.cwd(),
    });

    expect(result.verdict).toBe('truth');
  });

  it('returns lie for a contradicted claim', async () => {
    const result = await evaluateMessage({
      text: 'All tests pass.',
      command: `${node} -e "process.exit(1)"`,
      cwd: process.cwd(),
    });

    expect(result.verdict).toBe('lie');
  });

  it('does not run verification without a claim', async () => {
    const result = await evaluateMessage({
      text: 'The tests might pass.',
      command: `${node} -e "process.exit(1)"`,
      cwd: process.cwd(),
    });

    expect(result).toEqual({});
  });

  it('returns no verdict for a verifier error', async () => {
    const result = await evaluateMessage({
      text: 'Tests pass.',
      command: `${node} -e "setTimeout(() => {}, 1_000)"`,
      cwd: process.cwd(),
      timeoutMs: 10,
    });

    expect(result.verdict).toBeUndefined();
    expect(result.verification?.error).toBe('Verifier timed out after 10ms');
  });
});
```

- [ ] **Step 2: Run orchestration tests and confirm failure**

Run: `npm test -- --run tests/unit/orchestration.test.ts`

Expected: FAIL because `evaluateMessage` is not exported.

- [ ] **Step 3: Implement orchestration**

```ts
import { detectTestPassClaim, type Claim } from '../detector/index.js';
import { runVerifier, type VerificationResult } from '../verifier/index.js';

export interface EvaluationOptions {
  text: string;
  command: string;
  cwd: string;
  timeoutMs?: number;
}

export interface EvaluationResult {
  verdict?: 'truth' | 'lie';
  claim?: Claim;
  verification?: VerificationResult;
}

export async function evaluateMessage(options: EvaluationOptions): Promise<EvaluationResult> {
  const claim = detectTestPassClaim(options.text);
  if (!claim) return {};

  const verification = await runVerifier(options);
  if (verification.exitCode === undefined) return { claim, verification };

  return {
    verdict: verification.exitCode === 0 ? 'truth' : 'lie',
    claim,
    verification,
  };
}
```

- [ ] **Step 4: Run orchestration tests**

Run: `npm test -- --run tests/unit/orchestration.test.ts`

Expected: PASS, 4 tests.

- [ ] **Step 5: Update project status in README**

Replace the current project-status paragraph with:

```markdown
The repository contains the first core verdict slice: deterministic test-pass claim detection, caller-configured command verification, and structured `truth`/`lie` results. Claude Code integration and presentation remain under development.
```

- [ ] **Step 6: Run all verification gates**

Run:

```powershell
npm run typecheck
npm run lint
npm test -- --run
npm run build
git diff --check
```

Expected: every command exits `0`; all tests pass; `git diff --check` prints nothing.

- [ ] **Step 7: Commit core verdict flow**

```powershell
git add src/orchestration/index.ts tests/unit/orchestration.test.ts README.md
git commit -m "feat: produce core verification verdict"
```
