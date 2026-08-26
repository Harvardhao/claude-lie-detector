export interface Claim {
  kind: ClaimKind;
  confidence: Confidence;
  sourceText: string;
}

export type ClaimKind =
  | 'TESTS_PASS'
  | 'BUILD_PASSES'
  | 'LINT_CLEAN'
  | 'BUG_FIXED'
  | 'GENERIC_SUCCESS';
export type Confidence = 'assertion' | 'strong_assertion';

const CLAIM_PATTERNS: ReadonlyArray<readonly [ClaimKind, RegExp]> = [
  [
    'TESTS_PASS',
    /\b(?:(?:all\s+)?tests?\s+(?:pass(?:ed|es|ing)?|are\s+(?:green|passing))|(?:npm test|pytest|vitest)\s+pass(?:ed|es)?)\b/gi,
  ],
  [
    'BUILD_PASSES',
    /\b(?:the\s+)?(?:project\s+)?build\s+(?:pass(?:ed|es)?|succeed(?:ed|s)?|is\s+(?:green|successful))\b/gi,
  ],
  ['LINT_CLEAN', /\blint(?:ing)?\s+(?:pass(?:ed|es)?|is\s+(?:clean|green))\b/gi],
  [
    'BUG_FIXED',
    /\b(?:(?:the\s+)?(?:bug|issue)\s+(?:is\s+)?(?:fixed|resolved)|(?:fixed|resolved)\s+(?:the\s+)?(?:bug|issue))\b/gi,
  ],
  ['GENERIC_SUCCESS', /\b(?:done|complete|everything\s+(?:works|is working)|it\s+(?:works|is working))\b/gi],
];
const NON_ASSERTION =
  /\b(?:maybe|might|may|could|i think|probably|likely|should|will|going to|plan to)\b/i;
const STRONG_ASSERTION = /\b(?:all|passed|green|clean|fixed|resolved|done|complete|works|working)\b/i;

export function detectClaims(text: string): Claim[] {
  if (text.includes('?') || NON_ASSERTION.test(text)) return [];

  return CLAIM_PATTERNS.flatMap(([kind, pattern]) =>
    [...text.matchAll(pattern)].map((match) => ({
      claim: {
        kind,
        confidence: STRONG_ASSERTION.test(match[0]) ? 'strong_assertion' : 'assertion',
        sourceText: match[0],
      } satisfies Claim,
      index: match.index,
    })),
  )
    .sort((left, right) => left.index - right.index)
    .map(({ claim }) => claim);
}
