export interface Claim {
  kind: 'TESTS_PASS';
  confidence: 'strong_assertion';
  sourceText: string;
}

const TEST_PASS =
  /\b(?:(?:all\s+)?tests?\s+(?:pass(?:ed|es|ing)?|are\s+(?:green|passing))|(?:npm test|pytest|vitest)\s+pass(?:ed|es)?)\b/i;
const NON_ASSERTION =
  /\b(?:maybe|might|may|could|i think|probably|likely|should|will|going to|plan to)\b/i;

export function detectTestPassClaim(text: string): Claim | undefined {
  if (text.includes('?') || NON_ASSERTION.test(text) || !TEST_PASS.test(text)) return undefined;

  return { kind: 'TESTS_PASS', confidence: 'strong_assertion', sourceText: text };
}
