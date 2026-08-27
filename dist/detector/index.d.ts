export interface Claim {
    kind: ClaimKind;
    confidence: Confidence;
    sourceText: string;
    subject?: string;
    scope?: 'all';
}
export type ClaimKind = 'TESTS_PASS' | 'BUILD_PASSES' | 'LINT_CLEAN' | 'BUG_FIXED' | 'GENERIC_SUCCESS' | 'FILE_CHANGED' | 'FILE_CREATED' | 'COMMITTED' | 'PUSHED' | 'IMPLEMENTATION_COMPLETE' | 'SERVICE_RUNNING';
export type Confidence = 'assertion' | 'strong_assertion';
export declare function detectClaims(text: string): Claim[];
//# sourceMappingURL=index.d.ts.map