import { describe, expect, it } from 'vitest';

import { detectClaims } from '../../src/detector/index.js';

describe('detectClaims', () => {
  it.each([
    ['All tests pass.', 'TESTS_PASS'],
    ['The build succeeds.', 'BUILD_PASSES'],
    ['Lint is clean.', 'LINT_CLEAN'],
    ['The bug is fixed.', 'BUG_FIXED'],
    ['Everything works now.', 'GENERIC_SUCCESS'],
    ['I created `src/new.ts`.', 'FILE_CREATED'],
    ['I changed src/index.ts.', 'FILE_CHANGED'],
    ['I committed the changes.', 'COMMITTED'],
    ['The changes are pushed.', 'PUSHED'],
    ['The implementation is complete.', 'IMPLEMENTATION_COMPLETE'],
    ['The service is running.', 'SERVICE_RUNNING'],
  ] as const)('normalizes %s as %s', (text, kind) => {
    expect(detectClaims(text)).toMatchObject([{ kind }]);
  });

  it('extracts multiple claims in source order', () => {
    expect(detectClaims('The bug is fixed, all tests pass, and lint is clean.')).toMatchObject([
      { kind: 'BUG_FIXED' },
      { kind: 'TESTS_PASS' },
      { kind: 'LINT_CLEAN' },
    ]);
  });

  it('classifies ordinary success language below emphatic completion language', () => {
    expect(detectClaims('The build succeeds.')[0]?.confidence).toBe('assertion');
    expect(detectClaims('The build passed.')[0]?.confidence).toBe('strong_assertion');
  });

  it.each(['Maybe the tests pass.', 'The tests should pass.', 'Will the tests pass?'])(
    'ignores %s',
    (text) => expect(detectClaims(text)).toEqual([]),
  );

  it('extracts a file subject', () => {
    expect(detectClaims('I created `src/new.ts`.')).toMatchObject([
      { kind: 'FILE_CREATED', subject: 'src/new.ts' },
    ]);
  });
});
