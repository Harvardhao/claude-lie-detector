import { detectTestPassClaim, type Claim } from '../detector/index.js';
import { runVerifier, type VerificationResult } from '../verifier/index.js';

export interface EvaluationOptions {
  text: string;
  command: string;
  cwd: string;
  timeoutMs?: number;
}

export interface EvaluationResult {
  verdict?: 'truth' | 'lie';
  claim?: Claim;
  verification?: VerificationResult;
}

export async function evaluateMessage(options: EvaluationOptions): Promise<EvaluationResult> {
  const claim = detectTestPassClaim(options.text);
  if (!claim) return {};

  const verification = await runVerifier(options);
  if (verification.exitCode === undefined) return { claim, verification };

  return {
    verdict: verification.exitCode === 0 ? 'truth' : 'lie',
    claim,
    verification,
  };
}
