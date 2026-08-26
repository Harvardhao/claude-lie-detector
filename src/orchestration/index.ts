import { detectClaims, type Claim } from '../detector/index.js';
import { runVerifier, type VerificationResult } from '../verifier/index.js';

export interface EvaluationOptions {
  text: string;
  command: string;
  cwd: string;
  timeoutMs?: number;
}

export interface EvaluationResult {
  verdict?: 'truth' | 'lie';
  claims?: Claim[];
  verification?: VerificationResult;
}

export async function evaluateMessage(options: EvaluationOptions): Promise<EvaluationResult> {
  const claims = detectClaims(options.text);
  if (claims.length === 0) return {};

  const verification = await runVerifier(options);
  if (verification.exitCode === undefined) return { claims, verification };

  return {
    verdict: verification.exitCode === 0 ? 'truth' : 'lie',
    claims,
    verification,
  };
}
