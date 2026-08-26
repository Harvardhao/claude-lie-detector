import { exec } from 'node:child_process';

export interface VerifierOptions {
  command: string;
  cwd: string;
  timeoutMs?: number;
}

export interface VerificationResult {
  exitCode?: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
}

export function runVerifier({
  command,
  cwd,
  timeoutMs = 30_000,
}: VerifierOptions): Promise<VerificationResult> {
  const startedAt = performance.now();

  return new Promise((resolve) => {
    exec(command, { cwd, timeout: timeoutMs }, (error, stdout, stderr) => {
      const durationMs = performance.now() - startedAt;

      if (!error) {
        resolve({ exitCode: 0, stdout, stderr, durationMs });
      } else if (error.killed) {
        resolve({ stdout, stderr, durationMs, error: `Verifier timed out after ${timeoutMs}ms` });
      } else if (typeof error.code === 'number') {
        resolve({ exitCode: error.code, stdout, stderr, durationMs });
      } else {
        resolve({ stdout, stderr, durationMs, error: error.message });
      }
    });
  });
}
