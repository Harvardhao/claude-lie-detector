import { describe, expect, it } from 'vitest';

import { detectTestPassClaim } from '../../src/detector/index.js';

describe('detectTestPassClaim', () => {
  it.each(['All tests pass.', 'Tests are green!', 'vitest passed'])('detects %s', (text) => {
    expect(detectTestPassClaim(text)).toEqual({
      kind: 'TESTS_PASS',
      confidence: 'strong_assertion',
      sourceText: text,
    });
  });

  it.each(['Maybe the tests pass.', 'The tests should pass.', 'Will the tests pass?'])(
    'ignores %s',
    (text) => expect(detectTestPassClaim(text)).toBeUndefined(),
  );
});
