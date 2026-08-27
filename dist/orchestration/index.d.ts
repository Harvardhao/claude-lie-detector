import { type Claim } from '../detector/index.js';
import { type ClaimEvaluation } from '../evidence/index.js';
import { type VerificationResult } from '../verifier/index.js';
export interface EvaluationOptions {
    text: string;
    commands: VerifierCommands;
    cwd: string;
    timeoutMs?: number;
}
export interface VerifierCommands {
    default: string;
    tests?: string;
    build?: string;
    lint?: string;
}
export interface RoutedVerification {
    command: string;
    claims: Claim[];
    result: VerificationResult;
}
export interface EvaluationResult {
    verdict?: 'truth' | 'lie';
    claims?: Claim[];
    evaluations?: ClaimEvaluation[];
    verifications?: RoutedVerification[];
}
export declare function evaluateMessage(options: EvaluationOptions): Promise<EvaluationResult>;
//# sourceMappingURL=index.d.ts.map