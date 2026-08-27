export interface PresentationRequest {
    verdict: 'truth' | 'lie';
    popup: boolean;
    durationMs: number;
    soundEnabled: boolean;
    imagePath?: string;
    soundPath?: string;
}
export declare function presentVerdict(request: PresentationRequest): Promise<string | undefined>;
//# sourceMappingURL=index.d.ts.map