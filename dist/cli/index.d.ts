import { type PresentationRequest } from '../presentation/windows/index.js';
export interface CliResult {
    exitCode: 0 | 1 | 2;
    stdout: string;
    stderr: string;
    presentation?: PresentationRequest;
}
export declare function runCli(args: string[], defaultCwd?: string): Promise<CliResult>;
export declare function presentCliResult(result: CliResult): Promise<string | undefined>;
//# sourceMappingURL=index.d.ts.map