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

  it('returns exit 2 when one routed verifier lies and another errors', async () => {
    const cwd = await project({
      verify: `${node} -e "process.exit(1)"`,
      verifyTests: `${node} -e "setTimeout(() => {}, 1_000)"`,
      timeoutMs: 250,
    });
    const result = await runCli(['--text', 'The bug is fixed and all tests pass.'], cwd);
    expect(result.exitCode).toBe(2);
    const evaluation = JSON.parse(result.stdout);
    expect(evaluation.evaluations).toEqual(expect.arrayContaining([
      expect.objectContaining({ state: 'contradicted' }),
      expect.objectContaining({ state: 'error' }),
    ]));
    expect(evaluation.verifications).toEqual(
      expect.arrayContaining([expect.objectContaining({ result: expect.objectContaining({ error: expect.any(String) }) })]),
    );
  });

  it('returns empty evaluation without running a verifier', async () => {
    const cwd = await project({ verify: 'command-that-must-not-run' });
    const result = await runCli(['--text', 'I am still investigating.'], cwd);
    expect(result).toEqual({ exitCode: 0, stdout: '{}\n', stderr: '' });
  });

  it('applies a temporary verifier override', async () => {
    const cwd = await project({ verify: `${node} -e "process.exit(1)"` });
    const result = await runCli(['--text', 'The bug is fixed.', '--verify', `${node} -e "process.exit(0)"`], cwd);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ verdict: 'truth' });
  });

  it('applies temporary presentation controls', async () => {
    const cwd = await project({ verify: `${node} -e "process.exit(0)"` });
    const result = await runCli(['--text', 'The bug is fixed.', '--mute', '--no-popup'], cwd);
    expect(result.presentation).toMatchObject({ popup: false, soundEnabled: false });
  });

  it('uses explicit cwd and config paths', async () => {
    const cwd = await project({ verify: `${node} -e "process.exit(1)"` });
    await writeFile(join(cwd, 'custom.json'), JSON.stringify({ verify: `${node} -e "process.exit(0)"` }), 'utf8');
    const result = await runCli(['--text', 'The bug is fixed.', '--cwd', cwd, '--config', 'custom.json']);
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
    const cwd = await project({ verify: `${node} -e "setTimeout(() => {}, 1_000)"`, timeoutMs: 10 });
    const result = await runCli(['--text', 'The bug is fixed.'], cwd);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain('Verifier timed out after 10ms');
  });

  it('returns exit 2 when the verifier cannot start', async () => {
    const cwd = await project({ verify: `${node} -e "process.exit(0)"` });
    const result = await runCli(['--text', 'The bug is fixed.', '--cwd', join(cwd, 'missing'), '--config', join(cwd, '.claude-lie-detector.json')]);
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
