const CLAIM_PATTERNS = [
    ['FILE_CREATED', /\b(?:created|added)\s+(?:the\s+(?:file|module)\s+)?[`"']?([^`"'\s,]+)[`"']?/gi],
    ['FILE_CHANGED', /\b(?:changed|modified|updated|edited)\s+(?:the\s+(?:file|module)\s+)?[`"']?([^`"'\s,]+)[`"']?/gi],
    ['COMMITTED', /\b(?:i\s+)?committed\s+(?:the\s+)?changes?\b/gi],
    ['PUSHED', /\b(?:the\s+)?changes?\s+(?:are\s+)?pushed\b/gi],
    ['IMPLEMENTATION_COMPLETE', /\b(?:the\s+)?implementation\s+is\s+complete\b/gi],
    ['SERVICE_RUNNING', /\b(?:the\s+)?(?:server|service)\s+is\s+running\b/gi],
    [
        'TESTS_PASS',
        /\b(?:(?:all\s+|both\s+|every\s+|\d+(?:\s*\/\s*\d+)?\s+)?tests?\s+(?:pass(?:ed|es|ing)?|are\s+(?:now\s+)?(?:green|passing))|pass(?:es|ed)\s+(?:(?:all|both|every|\d+)\s+)?(?:the\s+)?tests|(?:the\s+)?(?:full\s+|whole\s+|entire\s+)?(?:test\s+)?suite\s+(?:pass(?:ed|es)?|is\s+(?:green|passing))|(?:npm\s+test|pytest|vitest|jest|node\s+--test)\s+pass(?:ed|es)?|\d+\s+passed\s*(?:,|and|;)?\s*(?:with\s+)?0\s+fail(?:ed|ing|ures)?)\b/gi,
    ],
    [
        'BUILD_PASSES',
        /\b(?:the\s+)?(?:project\s+)?build\s+(?:pass(?:ed|es)?|succeed(?:ed|s)?|is\s+(?:green|successful))\b/gi,
    ],
    ['LINT_CLEAN', /\blint(?:ing)?\s+(?:pass(?:ed|es)?|is\s+(?:clean|green))\b/gi],
    [
        'BUG_FIXED',
        /\b(?:(?:the\s+)?(?:\w+\s+){0,2}(?:bug|issue)s?\s+(?:are\s+|is\s+)?(?:fixed|resolved)|(?:fixed|resolved)\s+(?:the\s+|all\s+|both\s+)?(?:\w+\s+){0,2}(?:bug|issue)s?)\b/gi,
    ],
    ['GENERIC_SUCCESS', /\b(?:done|everything\s+(?:works|is working)|it\s+(?:works|is working))\b/gi],
];
const NON_ASSERTION = /\b(?:maybe|might|may|could|i think|probably|likely|should|will|going to|plan to)\b/i;
const STRONG_ASSERTION = /\b(?:all|passed|green|clean|fixed|resolved|done|complete|works|working)\b/i;
const ALL_SCOPE = /\b(?:all|both|every|whole|entire|full)\b/i;
export function detectClaims(text) {
    if (text.includes('?') || NON_ASSERTION.test(text))
        return [];
    return CLAIM_PATTERNS.flatMap(([kind, pattern]) => [...text.matchAll(pattern)].flatMap((match) => {
        const subject = match[1]?.replace(/[.!?,;:]+$/, '');
        // A file claim is only actionable with a path-shaped target; "changed the
        // condition to i <= n" must not be read as a claim about a file named "to".
        if ((kind === 'FILE_CREATED' || kind === 'FILE_CHANGED') && !isPathLike(subject)) {
            return [];
        }
        return [{
                claim: {
                    kind,
                    confidence: STRONG_ASSERTION.test(match[0]) ? 'strong_assertion' : 'assertion',
                    sourceText: match[0],
                    ...(subject === undefined ? {} : { subject }),
                    ...(kind === 'TESTS_PASS' && ALL_SCOPE.test(match[0]) ? { scope: 'all' } : {}),
                },
                index: match.index ?? 0,
            }];
    }))
        .sort((left, right) => left.index - right.index)
        .map(({ claim }) => claim);
}
function isPathLike(subject) {
    if (subject === undefined)
        return false;
    return /[\\/]/.test(subject) || /\.[A-Za-z0-9]{1,10}$/.test(subject);
}
//# sourceMappingURL=index.js.map