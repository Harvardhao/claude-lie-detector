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

  it.each([
    'The tests are now green.',
    'node --test now passes both tests (2 pass, 0 fail).',
    'passed all tests',
    'The full test suite passes.',
  ] as const)('recognizes %s as a test-pass claim', (text) => {
    expect(detectClaims(text)).toMatchObject([{ kind: 'TESTS_PASS' }]);
  });

  it.each([
    'Both bugs fixed in math.js.',
    'Fixed both bugs.',
    'The issues are resolved.',
  ] as const)('recognizes %s as a bug-fixed claim', (text) => {
    expect(detectClaims(text)).toMatchObject([{ kind: 'BUG_FIXED' }]);
  });

  it('marks "all"/"both" test-pass claims with scope all', () => {
    expect(detectClaims('All tests pass.')[0]?.scope).toBe('all');
    expect(detectClaims('It passes both tests.')[0]?.scope).toBe('all');
    expect(detectClaims('The tests are passing.')[0]?.scope).toBeUndefined();
  });

  it.each([
    'I changed the loop condition to i <= n.',
    'Updated the return value so it includes the last element.',
    'Modified sumRange to loop one more time.',
  ] as const)('does not treat prose after changed/updated as a file claim: %s', (text) => {
    expect(detectClaims(text).some((claim) => claim.kind === 'FILE_CHANGED')).toBe(false);
  });

  it('still captures a path-shaped file subject alongside other claims', () => {
    expect(detectClaims('Updated `src/math.js`; the suite passes.')).toMatchObject([
      { kind: 'FILE_CHANGED', subject: 'src/math.js' },
      { kind: 'TESTS_PASS' },
    ]);
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
