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
export declare function runVerifier({ command, cwd, timeoutMs, }: VerifierOptions): Promise<VerificationResult>;
//# sourceMappingURL=index.d.ts.map