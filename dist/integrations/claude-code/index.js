import { presentCliResult, runCli } from '../../cli/index.js';
import { appendLocalLog, eventId, runProjectQueue } from '../../shared/index.js';
/**
 * Serialize the internal hook result into the JSON shape current Claude Code
 * reads from a Stop hook's stdout. A turn with nothing to report emits `{}`.
 * See https://code.claude.com/docs/en/hooks (Stop hook output).
 */
export function serializeHookOutput(output) {
    const payload = output.systemMessage
        ? { hookSpecificOutput: { hookEventName: 'Stop', systemMessage: output.systemMessage } }
        : {};
    return `${JSON.stringify(payload)}\n`;
}
export function parseStopHookInput(source) {
    let value;
    try {
        value = JSON.parse(source);
    }
    catch {
        throw new Error('Invalid Claude Code hook JSON.');
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('Claude Code hook input must be a JSON object.');
    }
    const input = value;
    if (input.hook_event_name !== 'Stop') {
        throw new Error('Claude Code hook event must be "Stop".');
    }
    if (typeof input.cwd !== 'string' || input.cwd.trim() === '') {
        throw new Error('Claude Code hook "cwd" must be a non-empty string.');
    }
    if (typeof input.last_assistant_message !== 'string') {
        throw new Error('Claude Code hook "last_assistant_message" must be a string.');
    }
    return {
        cwd: input.cwd,
        lastAssistantMessage: input.last_assistant_message,
        eventId: eventId(typeof input.session_id === 'string' ? input.session_id : undefined, input.last_assistant_message),
    };
}
export async function runClaudeCodeHook(source) {
    try {
        const input = parseStopHookInput(source);
        return await runProjectQueue(input.cwd, { id: input.eventId, source }, runClaudeCodeHookOnce) ?? {};
    }
    catch (error) {
        return {
            systemMessage: `Lie Detector error: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
async function runClaudeCodeHookOnce(source) {
    const input = parseStopHookInput(source);
    try {
        const result = await runCli([
            '--text',
            input.lastAssistantMessage,
            '--cwd',
            input.cwd,
        ]);
        const presentationError = await presentCliResult(result);
        if (presentationError) {
            await log(input.cwd, `presentation=error reason=${JSON.stringify(presentationError)}`);
            return { systemMessage: `Lie Detector error: ${presentationError}` };
        }
        if (result.exitCode === 0) {
            const evaluation = JSON.parse(result.stdout);
            await log(input.cwd, `verdict=${evaluation.verdict ?? 'unverified'}`);
            return evaluation.verdict === 'truth' ? { systemMessage: 'Lie Detector: TRUTH' } : {};
        }
        if (result.exitCode === 1) {
            await log(input.cwd, 'verdict=lie');
            return { systemMessage: 'Lie Detector: LIE' };
        }
        const error = cliError(result.stdout, result.stderr);
        await log(input.cwd, `verdict=error reason=${JSON.stringify(error)}`);
        return { systemMessage: `Lie Detector error: ${error}` };
    }
    catch (error) {
        await log(input.cwd, `integration=error reason=${JSON.stringify(error instanceof Error ? error.message : String(error))}`);
        return {
            systemMessage: `Lie Detector error: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
async function log(cwd, message) {
    await appendLocalLog(cwd, message).catch(() => undefined);
}
function cliError(stdout, stderr) {
    if (stderr)
        return stderr.trim().replace(/^Lie Detector:\s*/, '');
    const evaluation = JSON.parse(stdout);
    return evaluation.verifications?.find(({ result }) => result.error)?.result.error
        ?? 'Verifier failed.';
}
//# sourceMappingURL=index.js.map