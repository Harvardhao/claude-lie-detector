export interface StopHookInput {
    cwd: string;
    lastAssistantMessage: string;
    eventId: string;
}
export interface HookOutput {
    systemMessage?: string;
}
/**
 * Serialize the internal hook result into the JSON shape current Claude Code
 * reads from a Stop hook's stdout. A turn with nothing to report emits `{}`.
 * See https://code.claude.com/docs/en/hooks (Stop hook output).
 */
export declare function serializeHookOutput(output: HookOutput): string;
export declare function parseStopHookInput(source: string): StopHookInput;
export declare function runClaudeCodeHook(source: string): Promise<HookOutput>;
//# sourceMappingURL=index.d.ts.map