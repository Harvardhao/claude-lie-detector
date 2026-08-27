import type { Claim } from '../detector/index.js';
import type { VerificationResult } from '../verifier/index.js';
export type EvidenceState = 'supported' | 'contradicted' | 'unverified' | 'error';
export interface Evidence {
    kind: 'command' | 'filesystem' | 'git';
    observedAt: number;
    passing?: boolean;
    details: string;
}
export interface ClaimEvaluation {
    claim: Claim;
    state: EvidenceState;
    reason: string;
    evidence?: Evidence[];
}
export declare function evaluateCommand(claim: Claim, result: VerificationResult, command: string): ClaimEvaluation;
export declare function inspectClaim(claim: Claim, cwd: string): Promise<ClaimEvaluation | undefined>;
//# sourceMappingURL=index.d.ts.map