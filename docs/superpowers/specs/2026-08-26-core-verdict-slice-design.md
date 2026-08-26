# Core Verdict Slice Design

**Date:** 2026-08-26  
**Status:** Approved for planning

## Goal

Build the smallest end-to-end core flow: recognize a confident `TESTS_PASS` claim, run a caller-provided verification command, and return `TRUTH` or `LIE` from its exit code.

## Scope

- `src/detector/index.ts` recognizes confident test-pass claims and ignores hedged, speculative, future, and question wording.
- `src/verifier/index.ts` runs a caller-provided command in a caller-provided working directory with a timeout and captures exit code, output, duration, and launch/timeout errors.
- `src/orchestration/index.ts` joins detection and verification. No claim returns no verdict; exit code `0` returns `TRUTH`; nonzero returns `LIE`; verifier errors return no verdict with error details.
- One focused Vitest file proves truth, lie, ignored wording, and verifier-error behavior.

## Interface

The orchestration entry point accepts assistant text, verification command, working directory, and optional timeout. It returns a structured result containing detected claim, verification result, and verdict (`truth`, `lie`, or absent).

Claude output is data only. The implementation never derives or executes a command from assistant text; only the caller-provided verifier command may run.

## Deliberate Deferrals

Configuration files, claim families beyond `TESTS_PASS`, evidence freshness and scope, CLI wiring, Claude Code integration, popup, and audio remain outside this slice. Existing module boundaries stay intact; no new abstraction layer is added.

## Acceptance

1. A confident test-pass claim plus verifier exit `0` produces `TRUTH`.
2. A confident test-pass claim plus nonzero exit produces `LIE`.
3. Hedged, future, or question wording does not run verification.
4. Launch failure or timeout produces no verdict and exposes the error.
5. Typecheck, lint, tests, and build pass.
