import { exec, execFile } from 'node:child_process';

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
    let timedOut = false;
    const child = exec(command, { cwd }, (error, stdout, stderr) => {
      clearTimeout(timer);
      const durationMs = performance.now() - startedAt;

      if (timedOut) {
        resolve({ stdout, stderr, durationMs, error: `Verifier timed out after ${timeoutMs}ms` });
      } else if (!error) {
        resolve({ exitCode: 0, stdout, stderr, durationMs });
      } else if (typeof error.code === 'number') {
        resolve({ exitCode: error.code, stdout, stderr, durationMs });
      } else {
        resolve({ stdout, stderr, durationMs, error: error.message });
      }
    });

    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === 'win32' && child.pid !== undefined) {
        execFile('taskkill', ['/pid', String(child.pid), '/T', '/F']);
      } else {
        child.kill();
      }
    }, timeoutMs);
  });
}
