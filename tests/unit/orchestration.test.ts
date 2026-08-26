import { describe, expect, it } from 'vitest';

import { evaluateMessage } from '../../src/orchestration/index.js';

const node = JSON.stringify(process.execPath);

describe('evaluateMessage', () => {
  it('uses a claim-specific verifier when configured', async () => {
    const tests = `${node} -e "process.exit(0)"`;
    const result = await evaluateMessage({
      text: 'All tests pass.',
      commands: {
        default: `${node} -e "process.exit(1)"`,
        tests,
      },
      cwd: process.cwd(),
    });

    expect(result.verdict).toBe('truth');
    expect(result.verifications?.[0]?.command).toBe(tests);
  });

  it('falls back to the default verifier', async () => {
    const result = await evaluateMessage({
      text: 'The build succeeds.',
      commands: { default: `${node} -e "process.exit(0)"` },
      cwd: process.cwd(),
    });

    expect(result.verdict).toBe('truth');
    expect(result.claims).toMatchObject([{ kind: 'BUILD_PASSES' }]);
  });

  it('runs a shared verifier once for multiple claims', async () => {
    const result = await evaluateMessage({
      text: 'The bug is fixed and everything works.',
      commands: { default: `${node} -e "process.exit(0)"` },
      cwd: process.cwd(),
    });

    expect(result.verifications).toHaveLength(1);
    expect(result.verifications?.[0]?.claims).toMatchObject([
      { kind: 'BUG_FIXED' },
      { kind: 'GENERIC_SUCCESS' },
    ]);
  });

  it('returns lie when any routed verifier fails', async () => {
    const result = await evaluateMessage({
      text: 'The build succeeds and lint is clean.',
      commands: {
        default: `${node} -e "process.exit(0)"`,
        build: `${node} -e "process.exit(0)"`,
        lint: `${node} -e "process.exit(1)"`,
      },
      cwd: process.cwd(),
    });

    expect(result.verdict).toBe('lie');
    expect(result.verifications).toHaveLength(2);
  });

  it('does not run verification without a claim', async () => {
    const result = await evaluateMessage({
      text: 'The tests might pass.',
      commands: { default: `${node} -e "process.exit(1)"` },
      cwd: process.cwd(),
    });

    expect(result).toEqual({});
  });

  it('returns no verdict for a verifier error', async () => {
    const result = await evaluateMessage({
      text: 'Tests pass.',
      commands: { default: `${node} -e "setTimeout(() => {}, 1_000)"` },
      cwd: process.cwd(),
      timeoutMs: 10,
    });

    expect(result.verdict).toBeUndefined();
    expect(result.verifications?.[0]?.result.error).toBe('Verifier timed out after 10ms');
  });
});
