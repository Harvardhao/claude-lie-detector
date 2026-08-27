import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';

import type { Claim } from '../detector/index.js';
import type { VerificationResult } from '../verifier/index.js';

const executeFile = promisify(execFile);

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

export function evaluateCommand(
  claim: Claim,
  result: VerificationResult,
  command: string,
): ClaimEvaluation {
  const evidence: Evidence = {
    kind: 'command',
    observedAt: Date.now(),
    ...(result.exitCode === undefined ? {} : { passing: result.exitCode === 0 }),
    details: result.error ?? `Verifier exited ${result.exitCode}`,
  };
  if (result.error) return { claim, state: 'error', reason: result.error, evidence: [evidence] };
  if (result.exitCode === 0 && claim.scope === 'all' && /(?:^|\s)(?:tests?[\\/]|\S+\.test\.\w+)(?:\s|$)/i.test(command)) {
    return { claim, state: 'unverified', reason: 'A targeted test command cannot prove that all tests pass.', evidence: [evidence] };
  }
  return result.exitCode === 0
    ? { claim, state: 'supported', reason: 'Configured verifier passed.', evidence: [evidence] }
    : { claim, state: 'contradicted', reason: `Configured verifier exited ${result.exitCode}.`, evidence: [evidence] };
}

export async function inspectClaim(claim: Claim, cwd: string): Promise<ClaimEvaluation | undefined> {
  if (claim.kind === 'PUSHED') {
    return { claim, state: 'unverified', reason: 'Remote push verification is not configured.' };
  }
  if (claim.kind === 'FILE_CREATED' || claim.kind === 'FILE_CHANGED') {
    if (!claim.subject) return { claim, state: 'unverified', reason: 'No file path was detected.' };
    const path = resolve(cwd, claim.subject);
    const projectRelative = relative(cwd, path);
    if (projectRelative.startsWith('..') || isAbsolute(projectRelative)) {
      return { claim, state: 'unverified', reason: 'Claimed file is outside the active project.' };
    }
    try {
      await stat(path);
      return {
        claim,
        state: 'supported',
        reason: 'The claimed file exists in the current project state.',
        evidence: [{ kind: 'filesystem', observedAt: Date.now(), passing: true, details: claim.subject }],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { claim, state: 'contradicted', reason: `File not found: ${claim.subject}` };
      }
      return { claim, state: 'error', reason: error instanceof Error ? error.message : String(error) };
    }
  }
  if (claim.kind === 'COMMITTED') {
    try {
      const { stdout } = await executeFile('git', ['log', '-1', '--format=%H'], { cwd });
      return stdout.trim()
        ? { claim, state: 'supported', reason: 'A local commit exists.', evidence: [{ kind: 'git', observedAt: Date.now(), passing: true, details: stdout.trim() }] }
        : { claim, state: 'unverified', reason: 'No local commit was found.' };
    } catch (error) {
      return { claim, state: 'error', reason: error instanceof Error ? error.message : String(error) };
    }
  }
  return undefined;
}
