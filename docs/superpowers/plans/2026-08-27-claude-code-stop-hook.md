# Claude Code Stop Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evaluate each completed main-agent Claude Code response through the existing CLI core using a non-blocking `Stop` hook.

**Architecture:** The Claude Code adapter validates hook JSON and maps it to `runCli` arguments; it does not duplicate detection or verification. A thin stdin/stdout executable exposes the adapter, while root-level Claude Code plugin metadata points at the compiled executable.

**Tech Stack:** Node.js 22+, TypeScript, Vitest, Claude Code command hooks

**Spec:** `docs/superpowers/specs/2026-08-27-claude-code-stop-hook-design.md`

## Global Constraints

- Use `Stop.last_assistant_message`; do not parse the transcript.
- Always let Claude Code stop normally; emit no blocking decision and exit `0`.
- Treat assistant text as data and pass it directly to `runCli`.
- Add no dependency and no second detector or verifier path.
- Keep popup, audio, logging, evidence reuse, and subagent events out of scope.

---

### Task 1: Normalize and run Claude Code Stop events

**Files:**
- Modify: `src/integrations/claude-code/index.ts`
- Create: `tests/unit/claude-code.test.ts`

**Interfaces:**
- Consumes: raw hook stdin as `string`
- Produces: `parseStopHookInput(source: string): StopHookInput`
- Produces: `runClaudeCodeHook(source: string): Promise<HookOutput>`
- Uses: `runCli(args: string[]): Promise<CliResult>`

- [ ] **Step 1: Write failing adapter tests**

Create `tests/unit/claude-code.test.ts`:

```ts
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  parseStopHookInput,
  runClaudeCodeHook,
} from '../../src/integrations/claude-code/index.js';

const node = JSON.stringify(process.execPath);
const directories: string[] = [];

async function project(exitCode: number): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'lie-detector-hook-'));
  directories.push(cwd);
  await writeFile(
    join(cwd, '.claude-lie-detector.json'),
    JSON.stringify({ verify: `${node} -e "process.exit(${exitCode})"` }),
    'utf8',
  );
  return cwd;
}

function event(cwd: string, lastAssistantMessage: string): string {
  return JSON.stringify({
    hook_event_name: 'Stop',
    cwd,
    last_assistant_message: lastAssistantMessage,
    transcript_path: 'ignored.jsonl',
  });
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('parseStopHookInput', () => {
  it('keeps only the supported Stop fields', () => {
    expect(parseStopHookInput(event('C:/project', 'All tests pass.'))).toEqual({
      cwd: 'C:/project',
      lastAssistantMessage: 'All tests pass.',
    });
  });

  it.each([
    ['{', 'Invalid Claude Code hook JSON.'],
    [JSON.stringify({ hook_event_name: 'PostToolUse', cwd: 'C:/project', last_assistant_message: 'Done.' }), 'Claude Code hook event must be "Stop".'],
    [JSON.stringify({ hook_event_name: 'Stop', cwd: '', last_assistant_message: 'Done.' }), 'Claude Code hook "cwd" must be a non-empty string.'],
    [JSON.stringify({ hook_event_name: 'Stop', cwd: 'C:/project' }), 'Claude Code hook "last_assistant_message" must be a string.'],
  ])('rejects invalid input %#', (source, message) => {
    expect(() => parseStopHookInput(source)).toThrow(message);
  });
});

describe('runClaudeCodeHook', () => {
  it('reports truth', async () => {
    const cwd = await project(0);
    await expect(runClaudeCodeHook(event(cwd, 'The bug is fixed.'))).resolves.toEqual({
      systemMessage: 'Lie Detector: TRUTH',
    });
  });

  it('reports lie', async () => {
    const cwd = await project(1);
    await expect(runClaudeCodeHook(event(cwd, 'The bug is fixed.'))).resolves.toEqual({
      systemMessage: 'Lie Detector: LIE',
    });
  });

  it('stays silent without a claim', async () => {
    const cwd = await project(1);
    await expect(runClaudeCodeHook(event(cwd, 'Still investigating.'))).resolves.toEqual({});
  });

  it('turns integration failures into non-blocking messages', async () => {
    await expect(runClaudeCodeHook('{')).resolves.toEqual({
      systemMessage: 'Lie Detector error: Invalid Claude Code hook JSON.',
    });
  });

  it('turns CLI failures into non-blocking messages', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'lie-detector-hook-empty-'));
    directories.push(cwd);
    const result = await runClaudeCodeHook(event(cwd, 'Tests pass.'));
    expect(result.systemMessage).toContain('Lie Detector error: Configuration file not found:');
  });
});
```

- [ ] **Step 2: Run the tests and confirm RED**

Run: `npm.cmd test -- --run tests/unit/claude-code.test.ts`

Expected: FAIL because both exports are missing.

- [ ] **Step 3: Implement the minimal adapter**

Replace `src/integrations/claude-code/index.ts` with:

```ts
import { runCli } from '../../cli/index.js';

export interface StopHookInput {
  cwd: string;
  lastAssistantMessage: string;
}

export interface HookOutput {
  systemMessage?: string;
}

export function parseStopHookInput(source: string): StopHookInput {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('Invalid Claude Code hook JSON.');
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Claude Code hook input must be a JSON object.');
  }

  const input = value as Record<string, unknown>;
  if (input.hook_event_name !== 'Stop') {
    throw new Error('Claude Code hook event must be "Stop".');
  }
  if (typeof input.cwd !== 'string' || input.cwd.trim() === '') {
    throw new Error('Claude Code hook "cwd" must be a non-empty string.');
  }
  if (typeof input.last_assistant_message !== 'string') {
    throw new Error('Claude Code hook "last_assistant_message" must be a string.');
  }

  return { cwd: input.cwd, lastAssistantMessage: input.last_assistant_message };
}

export async function runClaudeCodeHook(source: string): Promise<HookOutput> {
  try {
    const input = parseStopHookInput(source);
    const result = await runCli([
      '--text',
      input.lastAssistantMessage,
      '--cwd',
      input.cwd,
    ]);

    if (result.exitCode === 0) {
      const evaluation = JSON.parse(result.stdout) as { verdict?: string };
      return evaluation.verdict === 'truth' ? { systemMessage: 'Lie Detector: TRUTH' } : {};
    }
    if (result.exitCode === 1) return { systemMessage: 'Lie Detector: LIE' };

    return { systemMessage: `Lie Detector error: ${cliError(result.stdout, result.stderr)}` };
  } catch (error) {
    return {
      systemMessage: `Lie Detector error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function cliError(stdout: string, stderr: string): string {
  if (stderr) return stderr.trim().replace(/^Lie Detector:\s*/, '');

  const evaluation = JSON.parse(stdout) as {
    verifications?: Array<{ result: { error?: string } }>;
  };
  return evaluation.verifications?.find(({ result }) => result.error)?.result.error
    ?? 'Verifier failed.';
}
```

- [ ] **Step 4: Run focused and full tests**

Run: `npm.cmd test -- --run tests/unit/claude-code.test.ts`

Expected: PASS, 9 tests.

Run: `npm.cmd test -- --run`

Expected: all tests pass.

- [ ] **Step 5: Commit the adapter**

```powershell
git add -- src/integrations/claude-code/index.ts tests/unit/claude-code.test.ts
git commit -m "feat: handle Claude Code stop events"
```

---

### Task 2: Add the non-blocking hook executable

**Files:**
- Create: `src/integrations/claude-code/bin.ts`
- Create: `tests/integration/claude-code-hook.test.ts`

**Interfaces:**
- Consumes: Stop hook JSON on stdin
- Produces: one JSON `HookOutput` line on stdout and process exit `0`

- [ ] **Step 1: Write the failing executable integration tests**

Create `tests/integration/claude-code-hook.test.ts`:

```ts
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const directories: string[] = [];

function invoke(input: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/integrations/claude-code/bin.js']);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

beforeAll(() => {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);
});

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('Claude Code hook executable', () => {
  it('prints a truth notification and exits zero', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'lie-detector-hook-bin-'));
    directories.push(cwd);
    await writeFile(
      join(cwd, '.claude-lie-detector.json'),
      JSON.stringify({ verify: `${JSON.stringify(process.execPath)} -e "process.exit(0)"` }),
      'utf8',
    );

    const result = await invoke(JSON.stringify({
      hook_event_name: 'Stop',
      cwd,
      last_assistant_message: 'The bug is fixed.',
    }));

    expect(JSON.parse(result.stdout)).toEqual({ systemMessage: 'Lie Detector: TRUTH' });
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
  });

  it('prints an error notification and still exits zero', async () => {
    const result = await invoke('{');
    expect(JSON.parse(result.stdout)).toEqual({
      systemMessage: 'Lie Detector error: Invalid Claude Code hook JSON.',
    });
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
  });
});
```

- [ ] **Step 2: Build and confirm RED**

Run: `npm.cmd run build; npm.cmd test -- --run tests/integration/claude-code-hook.test.ts`

Expected: FAIL because `dist/integrations/claude-code/bin.js` does not exist.

- [ ] **Step 3: Add the executable wrapper**

Create `src/integrations/claude-code/bin.ts`:

```ts
#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

import { runClaudeCodeHook } from './index.js';

const output = await runClaudeCodeHook(await readFile(0, 'utf8'));
process.stdout.write(`${JSON.stringify(output)}\n`);
```

- [ ] **Step 4: Build and run focused and full tests**

Run: `npm.cmd run build`

Expected: exit `0` and `dist/integrations/claude-code/bin.js` exists.

Run: `npm.cmd test -- --run tests/integration/claude-code-hook.test.ts`

Expected: PASS, 2 tests.

Run: `npm.cmd test -- --run`

Expected: all tests pass.

- [ ] **Step 5: Commit the executable**

```powershell
git add -- src/integrations/claude-code/bin.ts tests/integration/claude-code-hook.test.ts
git commit -m "feat: run Claude Code stop hook"
```

---

### Task 3: Package the Claude Code plugin

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `hooks/hooks.json`
- Modify: `package.json`
- Modify: `plugin/README.md`
- Modify: `README.md`
- Modify: `tests/unit/scaffold.test.ts`

**Interfaces:**
- Produces: root plugin named `claude-lie-detector`
- Produces: `Stop` hook command resolving `dist/integrations/claude-code/bin.js` from `${CLAUDE_PLUGIN_ROOT}`

- [ ] **Step 1: Add failing package and hook metadata tests**

Add to `tests/unit/scaffold.test.ts`:

```ts
  it('packages the Claude Code plugin', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { files?: string[] };
    expect(packageJson.files).toEqual(expect.arrayContaining(['dist', '.claude-plugin', 'hooks']));

    const manifest = JSON.parse(await readFile('.claude-plugin/plugin.json', 'utf8')) as {
      name?: string;
    };
    expect(manifest.name).toBe('claude-lie-detector');

    const hooks = JSON.parse(await readFile('hooks/hooks.json', 'utf8')) as {
      hooks?: { Stop?: Array<{ hooks?: Array<{ type?: string; command?: string }> }> };
    };
    expect(hooks.hooks?.Stop?.[0]?.hooks?.[0]).toEqual({
      type: 'command',
      command: 'node "${CLAUDE_PLUGIN_ROOT}/dist/integrations/claude-code/bin.js"',
    });
  });
```

- [ ] **Step 2: Run the metadata test and confirm RED**

Run: `npm.cmd test -- --run tests/unit/scaffold.test.ts`

Expected: FAIL because the root plugin files do not exist.

- [ ] **Step 3: Add the minimal plugin metadata**

Create `.claude-plugin/plugin.json`:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-plugin-manifest.json",
  "name": "claude-lie-detector",
  "displayName": "Claude Lie Detector",
  "version": "0.0.0",
  "description": "Verifies confident Claude Code success claims."
}
```

Create `hooks/hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/dist/integrations/claude-code/bin.js\""
          }
        ]
      }
    ]
  }
}
```

Change `package.json` files to:

```json
  "files": [
    "dist",
    ".claude-plugin",
    "hooks",
    "assets",
    "plugin"
  ],
```

- [ ] **Step 4: Document local plugin use**

Replace `plugin/README.md` with:

```markdown
# Claude Code plugin

Build the project, then test the repository root as a local plugin:

```powershell
npm run build
claude --plugin-dir .
```

The plugin's non-blocking `Stop` hook reads `.claude-lie-detector.json` from the active project and evaluates Claude's final response.
```

Update the README project-status paragraph to state that Claude Code Stop-hook integration is available, and add the same two-command local-plugin example after the CLI configuration example.

- [ ] **Step 5: Run metadata and plugin validation**

Run: `npm.cmd test -- --run tests/unit/scaffold.test.ts`

Expected: PASS, 3 tests.

Run: `npm.cmd run build`

Expected: exit `0`.

Run: `claude plugin validate . --strict`

Expected: validation passes. If the installed Claude Code version does not provide `plugin validate`, record that the external validator is unavailable; the metadata test remains mandatory and must pass.

- [ ] **Step 6: Run all verification gates**

Run:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --run
npm.cmd run build
git diff --check
```

Expected: every command exits `0`; all tests pass; `git diff --check` prints nothing.

- [ ] **Step 7: Commit plugin packaging and documentation**

```powershell
git add -- .claude-plugin/plugin.json hooks/hooks.json package.json plugin/README.md README.md tests/unit/scaffold.test.ts
git commit -m "feat: package Claude Code plugin"
```
