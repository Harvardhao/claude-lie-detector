export interface QueuedEvent {
    id: string;
    source: string;
}
export declare function runProjectQueue<T>(cwd: string, event: QueuedEvent, run: (source: string) => Promise<T>): Promise<T | undefined>;
export declare function appendLocalLog(cwd: string, message: string): Promise<void>;
export declare function eventId(sessionId: string | undefined, text: string): string;
//# sourceMappingURL=index.d.ts.map