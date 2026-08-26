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
