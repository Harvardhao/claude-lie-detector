# Project Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a valid, testable TypeScript/Node.js repository scaffold for Claude Lie Detector without implementing product behavior.

**Architecture:** Use one ESM npm package organized by product responsibility. Empty responsibilities expose documented module entry points, while a smoke test proves the scaffold compiles and imports correctly.

**Tech Stack:** Node.js 22+, TypeScript, npm, Vitest, ESLint

**Spec:** `docs/design/claude-lie-detector-design.md` and `docs/design/implementation-foundation-design.md`

## Global Constraints

- Target Windows first.
- Require Node.js 22 or newer.
- Use one npm package, not a monorepo.
- Keep core modules independent of Claude Code and Windows APIs.
- Do not implement detector, verifier, integration, or presentation behavior in this scaffold.

---

### Task 1: Create the TypeScript repository scaffold

**Files:**
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `README.md`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `vitest.config.ts`
- Create: `src/cli/index.ts`
- Create: `src/config/index.ts`
- Create: `src/detector/index.ts`
- Create: `src/verifier/index.ts`
- Create: `src/orchestration/index.ts`
- Create: `src/integrations/claude-code/index.ts`
- Create: `src/presentation/windows/index.ts`
- Create: `src/shared/index.ts`
- Create: `tests/unit/scaffold.test.ts`
- Create: `tests/integration/.gitkeep`
- Create: `tests/fixtures/.gitkeep`
- Create: `assets/README.md`
- Create: `plugin/README.md`
- Create: `package-lock.json` through `npm install`

**Interfaces:**
- Consumes: Node.js 22+ and npm.
- Produces: importable module entry points, npm scripts named `build`, `typecheck`, `lint`, and `test`.

- [ ] **Step 1: Write the scaffold smoke test**

Create `tests/unit/scaffold.test.ts` importing each module namespace and asserting the eight namespaces exist as objects. This test initially fails because the source entry points and test tooling do not exist.

- [ ] **Step 2: Create minimal package and compiler configuration**

Create an ESM private package with Node.js `>=22`, scripts for TypeScript compilation, no-emit type checking, ESLint, and Vitest. Configure strict TypeScript with `NodeNext` module resolution, source maps, declarations, `src` as the root directory, and `dist` as output.

- [ ] **Step 3: Create responsibility entry points and support directories**

Each `src/**/index.ts` contains only a module-level responsibility comment and `export {};`. Add explanatory README files for user-provided assets and the future Claude Code plugin package. Keep empty test-support directories with `.gitkeep` files.

- [ ] **Step 4: Add repository documentation and metadata**

Create a concise README describing the deterministic joke, scaffold status, requirements, and npm commands. Add a standard MIT license credited to “Claude Lie Detector contributors” and ignore dependencies, build output, coverage, logs, local environment files, and editor/OS noise.

- [ ] **Step 5: Install development dependencies**

Run `npm install --save-dev typescript vitest eslint @eslint/js typescript-eslint @types/node` to generate a reproducible lockfile.

- [ ] **Step 6: Verify the scaffold**

Run `npm run typecheck`, `npm run lint`, `npm test -- --run`, and `npm run build`. All commands must exit successfully and `dist/` must contain compiled module entry points.

- [ ] **Step 7: Commit the scaffold**

Run `git add .` and commit with `chore: scaffold TypeScript project`.
