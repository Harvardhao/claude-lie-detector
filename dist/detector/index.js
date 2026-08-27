const CLAIM_PATTERNS = [
    ['FILE_CREATED', /\b(?:created|added)\s+[`"']?([^`"'\s,]+)[`"']?/gi],
    ['FILE_CHANGED', /\b(?:changed|modified|updated)\s+[`"']?([^`"'\s,]+)[`"']?/gi],
    ['COMMITTED', /\b(?:i\s+)?committed\s+(?:the\s+)?changes?\b/gi],
    ['PUSHED', /\b(?:the\s+)?changes?\s+(?:are\s+)?pushed\b/gi],
    ['IMPLEMENTATION_COMPLETE', /\b(?:the\s+)?implementation\s+is\s+complete\b/gi],
    ['SERVICE_RUNNING', /\b(?:the\s+)?(?:server|service)\s+is\s+running\b/gi],
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
    ['GENERIC_SUCCESS', /\b(?:done|everything\s+(?:works|is working)|it\s+(?:works|is working))\b/gi],
];
const NON_ASSERTION = /\b(?:maybe|might|may|could|i think|probably|likely|should|will|going to|plan to)\b/i;
const STRONG_ASSERTION = /\b(?:all|passed|green|clean|fixed|resolved|done|complete|works|working)\b/i;
export function detectClaims(text) {
    if (text.includes('?') || NON_ASSERTION.test(text))
        return [];
    return CLAIM_PATTERNS.flatMap(([kind, pattern]) => [...text.matchAll(pattern)].map((match) => ({
        claim: {
            kind,
            confidence: STRONG_ASSERTION.test(match[0]) ? 'strong_assertion' : 'assertion',
            sourceText: match[0],
            ...(match[1] === undefined ? {} : { subject: match[1].replace(/[.!?]+$/, '') }),
            ...(kind === 'TESTS_PASS' && /^all\s+tests?/i.test(match[0]) ? { scope: 'all' } : {}),
        },
        index: match.index,
    })))
        .sort((left, right) => left.index - right.index)
        .map(({ claim }) => claim);
}
//# sourceMappingURL=index.js.map