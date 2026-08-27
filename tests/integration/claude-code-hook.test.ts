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
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    shell: process.platform === 'win32',
  });
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
