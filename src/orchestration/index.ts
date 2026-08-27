import { detectClaims, type Claim } from '../detector/index.js';
import { evaluateCommand, inspectClaim, type ClaimEvaluation } from '../evidence/index.js';
import { runVerifier, type VerificationResult } from '../verifier/index.js';

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

export async function evaluateMessage(options: EvaluationOptions): Promise<EvaluationResult> {
  const claims = detectClaims(options.text);
  if (claims.length === 0) return {};

  const evaluations: ClaimEvaluation[] = [];
  const routes = new Map<string, Claim[]>();
  for (const claim of claims) {
    const inspection = await inspectClaim(claim, options.cwd);
    if (inspection) {
      evaluations.push(inspection);
      continue;
    }
    const command = commandFor(claim, options.commands);
    routes.set(command, [...(routes.get(command) ?? []), claim]);
  }

  const verifications: RoutedVerification[] = [];
  for (const [command, routedClaims] of routes) {
    const result = await runVerifier({
      command,
      cwd: options.cwd,
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
    });
    verifications.push({ command, claims: routedClaims, result });
    evaluations.push(...routedClaims.map((claim) => evaluateCommand(claim, result, command)));
  }

  const base = {
    claims,
    evaluations,
    ...(verifications.length === 0 ? {} : { verifications }),
  };
  if (evaluations.some(({ state }) => state === 'error')) return base;
  if (evaluations.some(({ state }) => state === 'contradicted')) {
    return { verdict: 'lie' as const, ...base };
  }
  if (evaluations.some(({ state }) => state === 'supported')) {
    return { verdict: 'truth' as const, ...base };
  }
  return base;
}

function commandFor(claim: Claim, commands: VerifierCommands): string {
  if (claim.kind === 'TESTS_PASS') return commands.tests ?? commands.default;
  if (claim.kind === 'BUILD_PASSES') return commands.build ?? commands.default;
  if (claim.kind === 'LINT_CLEAN') return commands.lint ?? commands.default;
  return commands.default;
}
