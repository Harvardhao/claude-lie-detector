import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  parseStopHookInput,
  runClaudeCodeHook,
  serializeHookOutput,
} from '../../src/integrations/claude-code/index.js';

const node = JSON.stringify(process.execPath);
const directories: string[] = [];

async function project(exitCode: number): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'lie-detector-hook-'));
  directories.push(cwd);
  await writeFile(
    join(cwd, '.claude-lie-detector.json'),
    JSON.stringify({ verify: `${node} -e "process.exit(${exitCode})"`, popup: false, sound: false }),
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
      eventId: expect.any(String),
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

describe('serializeHookOutput', () => {
  it('wraps a message in the Claude Code Stop output shape', () => {
    expect(JSON.parse(serializeHookOutput({ systemMessage: 'Lie Detector: TRUTH' }))).toEqual({
      hookSpecificOutput: { hookEventName: 'Stop', systemMessage: 'Lie Detector: TRUTH' },
    });
  });

  it('emits an empty object when there is nothing to report', () => {
    expect(serializeHookOutput({})).toBe('{}\n');
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
