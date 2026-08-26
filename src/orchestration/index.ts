import { detectClaims, type Claim } from '../detector/index.js';
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
  verifications?: RoutedVerification[];
}

export async function evaluateMessage(options: EvaluationOptions): Promise<EvaluationResult> {
  const claims = detectClaims(options.text);
  if (claims.length === 0) return {};

  const routes = new Map<string, Claim[]>();
  for (const claim of claims) {
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
  }

  if (verifications.some(({ result }) => result.exitCode !== undefined && result.exitCode !== 0)) {
    return { verdict: 'lie', claims, verifications };
  }

  if (verifications.some(({ result }) => result.exitCode === undefined)) {
    return { claims, verifications };
  }

  return { verdict: 'truth', claims, verifications };
}

function commandFor(claim: Claim, commands: VerifierCommands): string {
  if (claim.kind === 'TESTS_PASS') return commands.tests ?? commands.default;
  if (claim.kind === 'BUILD_PASSES') return commands.build ?? commands.default;
  if (claim.kind === 'LINT_CLEAN') return commands.lint ?? commands.default;
  return commands.default;
}
