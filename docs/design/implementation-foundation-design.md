# Claude Lie Detector — Implementation Foundation

**Date:** 2026-08-26  
**Status:** Approved  
**Companion specification:** `claude-lie-detector-design.md`

## Runtime and packaging

The MVP targets Windows first and uses Node.js 22 or newer with TypeScript. It is distributed as a single npm package rather than a monorepo. This keeps installation and development lightweight while preserving explicit internal boundaries.

## Repository structure

```text
ClaudeLieDetector/
├── docs/design/
├── src/
│   ├── cli/
│   ├── config/
│   ├── detector/
│   ├── evidence/
│   ├── verifier/
│   ├── orchestration/
│   ├── integrations/claude-code/
│   ├── presentation/windows/
│   └── shared/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── assets/
├── plugin/
├── README.md
├── LICENSE
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Boundaries

The core detector, evidence evaluator, verifier, configuration, and orchestration code remain independent of Claude Code and Windows-specific APIs. Integration and presentation adapters may depend on their respective platforms.

The detector extracts normalized claims and assertion strength. The evidence module evaluates freshness, relevance, sufficiency, and contradiction without knowing how commands are launched. The verifier module produces low-level command or inspection evidence; it does not choose the public verdict directly.

Initial placeholder modules contain no speculative behavior. Functionality will be added test-first during implementation.

The first usable release follows the phased boundary in the primary design specification. Remote push verification, session-derived tool evidence, and verification-integrity heuristics remain outside the MVP implementation plan.

## Toolchain

The development toolchain uses npm, TypeScript, Vitest, and ESLint. The exact Claude Code hook packaging will be verified against current official documentation before that adapter is implemented.

## Testing

The scaffold itself is verified by TypeScript compilation, linting, and a minimal test command. Later unit and integration tests follow the responsibilities and acceptance criteria in the primary design specification.
