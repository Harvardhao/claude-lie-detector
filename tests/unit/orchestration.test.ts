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

  it('verifies a non-test success claim', async () => {
    const result = await evaluateMessage({
      text: 'The build succeeds.',
      command: `${node} -e "process.exit(0)"`,
      cwd: process.cwd(),
    });

    expect(result.verdict).toBe('truth');
    expect(result.claims).toMatchObject([{ kind: 'BUILD_PASSES' }]);
  });

  it('retains every claim from a compound message', async () => {
    const result = await evaluateMessage({
      text: 'The bug is fixed and all tests pass.',
      command: `${node} -e "process.exit(0)"`,
      cwd: process.cwd(),
    });

    expect(result.claims).toMatchObject([{ kind: 'BUG_FIXED' }, { kind: 'TESTS_PASS' }]);
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
