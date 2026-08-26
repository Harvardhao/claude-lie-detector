# Config and CLI Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the existing detector and verifier as a usable CLI driven by validated project JSON configuration and temporary flag overrides.

**Architecture:** `src/config/index.ts` owns JSON loading and validation. `src/cli/index.ts` parses arguments and returns buffered CLI output for direct tests, while `src/cli/bin.ts` is the thin executable wrapper. Existing orchestration remains the only verdict path.

**Tech Stack:** Node.js 22+, TypeScript, Vitest, Node standard library

**Spec:** `docs/superpowers/specs/2026-08-26-config-cli-runner-design.md`

## Global Constraints

- Add no dependency.
- Default config path is `<cwd>/.claude-lie-detector.json`.
- `verify` is required; claim-specific verifier commands and `timeoutMs` are optional.
- Assistant text is data; only config or explicit `--verify` commands may execute.
- Exit `0` for TRUTH or no claim, `1` for LIE, and `2` for usage/config/verifier errors.
- Global config, claim customization, assets, popup, audio, and Claude Code integration remain out of scope.

---

### Task 1: Load and validate project configuration

**Files:**
- Modify: `src/config/index.ts`
- Create: `tests/unit/config.test.ts`

**Interfaces:**
- Consumes: JSON file path as `string`
- Produces: `loadConfig(path: string): Promise<ProjectConfig>`
- Produces: `ProjectConfig { verify: string; verifyTests?: string; verifyBuild?: string; verifyLint?: string; timeoutMs?: number }`

- [ ] **Step 1: Write failing configuration tests**

```ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/index.js';

const directories: string[] = [];

async function configFile(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lie-detector-config-'));
  directories.push(directory);
  const path = join(directory, '.claude-lie-detector.json');
  await writeFile(path, contents, 'utf8');
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('loadConfig', () => {
  it('loads verifier routes and timeout', async () => {
    const path = await configFile(JSON.stringify({
      verify: 'npm test',
      verifyTests: 'npm test -- --run',
      verifyBuild: 'npm run build',
      verifyLint: 'npm run lint',
      timeoutMs: 120_000,
    }));

    await expect(loadConfig(path)).resolves.toEqual({
      verify: 'npm test',
      verifyTests: 'npm test -- --run',
      verifyBuild: 'npm run build',
      verifyLint: 'npm run lint',
      timeoutMs: 120_000,
    });
  });

  it('rejects malformed JSON', async () => {
    const path = await configFile('{');
    await expect(loadConfig(path)).rejects.toThrow(`Invalid JSON configuration: ${path}`);
  });

  it.each([
    [{}, 'Configuration "verify" must be a non-empty string.'],
    [{ verify: 'npm test', verifyBuild: '' }, 'Configuration "verifyBuild" must be a non-empty string.'],
    [{ verify: 'npm test', timeoutMs: 0 }, 'Configuration "timeoutMs" must be a positive integer.'],
  ])('rejects invalid values in %j', async (value, message) => {
    const path = await configFile(JSON.stringify(value));
    await expect(loadConfig(path)).rejects.toThrow(message);
  });

  it('reports a missing file', async () => {
    const path = join(tmpdir(), `missing-lie-detector-${Date.now()}.json`);
    await expect(loadConfig(path)).rejects.toThrow(`Configuration file not found: ${path}`);
  });
});
```

- [ ] **Step 2: Run config tests and confirm RED**

Run: `npm test -- --run tests/unit/config.test.ts`

Expected: FAIL because `loadConfig` is not exported.

- [ ] **Step 3: Implement JSON loading and validation**

```ts
import { readFile } from 'node:fs/promises';

export interface ProjectConfig {
  verify: string;
  verifyTests?: string;
  verifyBuild?: string;
  verifyLint?: string;
  timeoutMs?: number;
}

export async function loadConfig(path: string): Promise<ProjectConfig> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${path}`);
    }
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(`Invalid JSON configuration: ${path}`);
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Configuration must be a JSON object.');
  }

  const raw = value as Record<string, unknown>;
  const verify = command(raw.verify, 'verify');
  const verifyTests = optionalCommand(raw.verifyTests, 'verifyTests');
  const verifyBuild = optionalCommand(raw.verifyBuild, 'verifyBuild');
  const verifyLint = optionalCommand(raw.verifyLint, 'verifyLint');
  const timeoutMs = optionalTimeout(raw.timeoutMs);

  return {
    verify,
    ...(verifyTests === undefined ? {} : { verifyTests }),
    ...(verifyBuild === undefined ? {} : { verifyBuild }),
    ...(verifyLint === undefined ? {} : { verifyLint }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

function command(value: unknown, key: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Configuration "${key}" must be a non-empty string.`);
  }
  return value;
}

function optionalCommand(value: unknown, key: string): string | undefined {
  return value === undefined ? undefined : command(value, key);
}

function optionalTimeout(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error('Configuration "timeoutMs" must be a positive integer.');
  }
  return value as number;
}
```

- [ ] **Step 4: Run config tests and all existing tests**

Run: `npm test -- --run tests/unit/config.test.ts`

Expected: PASS, 6 tests.

Run: `npm test -- --run`

Expected: all tests pass.

- [ ] **Step 5: Commit config loader**

```powershell
git add src/config/index.ts tests/unit/config.test.ts
git commit -m "feat: load project configuration"
```

---

### Task 2: Run the detector through a testable CLI core

**Files:**
- Modify: `src/cli/index.ts`
- Create: `tests/integration/cli.test.ts`

**Interfaces:**
- Consumes: `runCli(args: string[], defaultCwd?: string): Promise<CliResult>`
- Produces: `CliResult { exitCode: 0 | 1 | 2; stdout: string; stderr: string }`
- Uses: `loadConfig(path)` and `evaluateMessage(options)`

- [ ] **Step 1: Write failing end-to-end CLI tests**

```ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../../src/cli/index.js';

const node = JSON.stringify(process.execPath);
const directories: string[] = [];

async function project(config: object | string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lie-detector-cli-'));
  directories.push(directory);
  await writeFile(
    join(directory, '.claude-lie-detector.json'),
    typeof config === 'string' ? config : JSON.stringify(config),
    'utf8',
  );
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('runCli', () => {
  it('uses a claim-specific project verifier', async () => {
    const cwd = await project({
      verify: `${node} -e "process.exit(1)"`,
      verifyTests: `${node} -e "process.exit(0)"`,
    });

    const result = await runCli(['--text', 'All tests pass.'], cwd);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ verdict: 'truth' });
    expect(result.stderr).toBe('');
  });

  it('returns exit 1 for lie', async () => {
    const cwd = await project({ verify: `${node} -e "process.exit(1)"` });
    const result = await runCli(['--text', 'The bug is fixed.'], cwd);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({ verdict: 'lie' });
  });

  it('returns empty evaluation without running a verifier', async () => {
    const cwd = await project({ verify: 'command-that-must-not-run' });
    const result = await runCli(['--text', 'I am still investigating.'], cwd);
    expect(result).toEqual({ exitCode: 0, stdout: '{}\n', stderr: '' });
  });

  it('applies a temporary verifier override', async () => {
    const cwd = await project({ verify: `${node} -e "process.exit(1)"` });
    const result = await runCli([
      '--text',
      'The bug is fixed.',
      '--verify',
      `${node} -e "process.exit(0)"`,
    ], cwd);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ verdict: 'truth' });
  });

  it('uses explicit cwd and config paths', async () => {
    const cwd = await project({ verify: `${node} -e "process.exit(1)"` });
    await writeFile(
      join(cwd, 'custom.json'),
      JSON.stringify({ verify: `${node} -e "process.exit(0)"` }),
      'utf8',
    );
    const result = await runCli([
      '--text',
      'The bug is fixed.',
      '--cwd',
      cwd,
      '--config',
      'custom.json',
    ]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ verdict: 'truth' });
  });

  it('returns exit 2 for malformed config', async () => {
    const cwd = await project('{');
    const result = await runCli(['--text', 'Tests pass.'], cwd);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Lie Detector: Invalid JSON configuration:');
  });

  it('returns exit 2 for timeout', async () => {
    const cwd = await project({
      verify: `${node} -e "setTimeout(() => {}, 1_000)"`,
      timeoutMs: 10,
    });
    const result = await runCli(['--text', 'The bug is fixed.'], cwd);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('Verifier timed out after 10ms');
  });

  it('returns exit 2 when the verifier cannot start', async () => {
    const cwd = await project({ verify: `${node} -e "process.exit(0)"` });
    const result = await runCli([
      '--text',
      'The bug is fixed.',
      '--cwd',
      join(cwd, 'missing'),
      '--config',
      join(cwd, '.claude-lie-detector.json'),
    ]);
    expect(result.exitCode).toBe(2);
    expect(JSON.parse(result.stdout).verifications[0].result.error).toBeTypeOf('string');
  });

  it('returns exit 2 for missing config', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'lie-detector-cli-empty-'));
    directories.push(cwd);
    const result = await runCli(['--text', 'Tests pass.'], cwd);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('Lie Detector: Configuration file not found:');
  });

  it.each([
    [[], 'Missing required --text.'],
    [['--unknown'], 'Unknown argument: --unknown'],
    [['--text'], 'Missing value for --text.'],
    [['--text', 'Tests pass.', '--timeout-ms', '0'], '--timeout-ms must be a positive integer.'],
  ] as const)('returns exit 2 for invalid arguments %#', async (args, message) => {
    const result = await runCli([...args]);
    expect(result).toEqual({ exitCode: 2, stdout: '', stderr: `Lie Detector: ${message}\n` });
  });
});
```

- [ ] **Step 2: Run CLI tests and confirm RED**

Run: `npm test -- --run tests/integration/cli.test.ts`

Expected: FAIL because `runCli` is not exported.

- [ ] **Step 3: Implement argument parsing and CLI execution**

```ts
import { resolve } from 'node:path';

import { loadConfig } from '../config/index.js';
import { evaluateMessage, type VerifierCommands } from '../orchestration/index.js';

export interface CliResult {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
}

interface ParsedArgs {
  text: string;
  cwd: string;
  configPath: string;
  verify?: string;
  timeoutMs?: number;
}

export async function runCli(args: string[], defaultCwd = process.cwd()): Promise<CliResult> {
  try {
    const parsed = parseArgs(args, defaultCwd);
    const config = await loadConfig(parsed.configPath);
    const commands: VerifierCommands = {
      default: parsed.verify ?? config.verify,
      ...(config.verifyTests === undefined ? {} : { tests: config.verifyTests }),
      ...(config.verifyBuild === undefined ? {} : { build: config.verifyBuild }),
      ...(config.verifyLint === undefined ? {} : { lint: config.verifyLint }),
    };
    const timeoutMs = parsed.timeoutMs ?? config.timeoutMs;
    const evaluation = await evaluateMessage({
      text: parsed.text,
      commands,
      cwd: parsed.cwd,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
    const stdout = `${JSON.stringify(evaluation)}\n`;

    if (evaluation.verdict === 'lie') return { exitCode: 1, stdout, stderr: '' };
    if (evaluation.verifications?.some(({ result }) => result.error !== undefined)) {
      return { exitCode: 2, stdout, stderr: '' };
    }
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, stdout: '', stderr: `Lie Detector: ${message}\n` };
  }
}

function parseArgs(args: string[], defaultCwd: string): ParsedArgs {
  let text: string | undefined;
  let cwdValue = defaultCwd;
  let configValue: string | undefined;
  let verify: string | undefined;
  let timeoutMs: number | undefined;

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!['--text', '--cwd', '--config', '--verify', '--timeout-ms'].includes(flag ?? '')) {
      throw new Error(`Unknown argument: ${flag}`);
    }
    const value = args[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${flag}.`);

    if (flag === '--text') text = value;
    else if (flag === '--cwd') cwdValue = value;
    else if (flag === '--config') configValue = value;
    else if (flag === '--verify') verify = value;
    else if (flag === '--timeout-ms') {
      timeoutMs = Number(value);
      if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
        throw new Error('--timeout-ms must be a positive integer.');
      }
    }
  }

  if (text === undefined) throw new Error('Missing required --text.');
  const cwd = resolve(defaultCwd, cwdValue);
  return {
    text,
    cwd,
    configPath: resolve(cwd, configValue ?? '.claude-lie-detector.json'),
    ...(verify === undefined ? {} : { verify }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}
```

- [ ] **Step 4: Run CLI integration tests and full tests**

Run: `npm test -- --run tests/integration/cli.test.ts`

Expected: PASS, 13 tests.

Run: `npm test -- --run`

Expected: all tests pass.

- [ ] **Step 5: Commit CLI core**

```powershell
git add src/cli/index.ts tests/integration/cli.test.ts
git commit -m "feat: run detector from cli"
```

---

### Task 3: Package and document the executable

**Files:**
- Create: `src/cli/bin.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: `runCli(process.argv.slice(2))`
- Produces: npm executable `claude-lie-detector` at `dist/cli/bin.js`

- [ ] **Step 1: Add a failing package metadata test**

Add this case to `tests/unit/scaffold.test.ts`:

```ts
import { readFile } from 'node:fs/promises';

it('exposes the compiled CLI executable', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    bin?: Record<string, string>;
  };

  expect(packageJson.bin).toEqual({ 'claude-lie-detector': 'dist/cli/bin.js' });
});
```

- [ ] **Step 2: Run metadata test and confirm RED**

Run: `npm test -- --run tests/unit/scaffold.test.ts`

Expected: FAIL because `package.json` has no `bin` field.

- [ ] **Step 3: Add executable wrapper**

Create `src/cli/bin.ts`:

```ts
#!/usr/bin/env node

import { runCli } from './index.js';

const result = await runCli(process.argv.slice(2));
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
```

Add to `package.json` after `private`:

```json
"bin": {
  "claude-lie-detector": "dist/cli/bin.js"
},
```

- [ ] **Step 4: Document configuration and CLI use**

Replace README project status with:

```markdown
The repository contains a runnable CLI core with deterministic claim detection, project-configured verification, claim-specific verifier routing, and structured `truth`/`lie` results. Claude Code integration and presentation remain under development.
```

Add after Requirements:

````markdown
## Configuration

Create `.claude-lie-detector.json` in the project to verify:

```json
{
  "verify": "npm test",
  "verifyTests": "npm test",
  "verifyBuild": "npm run build",
  "verifyLint": "npm run lint",
  "timeoutMs": 120000
}
```

Run a message through the detector:

```powershell
claude-lie-detector --text "All tests pass."
```

Use `--cwd`, `--config`, `--verify`, or `--timeout-ms` for temporary overrides. Claude Code integration is not wired yet.
````

- [ ] **Step 5: Run metadata test and build**

Run: `npm test -- --run tests/unit/scaffold.test.ts`

Expected: PASS, 2 tests.

Run: `npm run build`

Expected: exit `0` and `dist/cli/bin.js` exists.

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

- [ ] **Step 7: Commit packaging and docs**

```powershell
git add src/cli/bin.ts package.json README.md tests/unit/scaffold.test.ts
git commit -m "feat: package cli runner"
```
