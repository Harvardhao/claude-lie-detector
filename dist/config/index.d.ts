export interface ProjectConfig {
    verify: string;
    verifyTests?: string;
    verifyBuild?: string;
    verifyLint?: string;
    timeoutMs?: number;
    popup?: boolean;
    popupDurationMs?: number;
    sound?: boolean;
    truthImage?: string;
    lieImage?: string;
    truthSound?: string;
    lieSound?: string;
}
export declare function loadConfig(path: string): Promise<ProjectConfig>;
//# sourceMappingURL=index.d.ts.map