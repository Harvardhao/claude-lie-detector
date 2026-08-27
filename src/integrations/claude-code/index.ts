import { presentCliResult, runCli } from '../../cli/index.js';
import { appendLocalLog, eventId, runProjectQueue } from '../../shared/index.js';

export interface StopHookInput {
  cwd: string;
  lastAssistantMessage: string;
  eventId: string;
}

export interface HookOutput {
  systemMessage?: string;
}

export function parseStopHookInput(source: string): StopHookInput {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error('Invalid Claude Code hook JSON.');
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Claude Code hook input must be a JSON object.');
  }

  const input = value as Record<string, unknown>;
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

export async function runClaudeCodeHook(source: string): Promise<HookOutput> {
  try {
    const input = parseStopHookInput(source);
    return await runProjectQueue(
      input.cwd,
      { id: input.eventId, source },
      runClaudeCodeHookOnce,
    ) ?? {};
  } catch (error) {
    return {
      systemMessage: `Lie Detector error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function runClaudeCodeHookOnce(source: string): Promise<HookOutput> {
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
      const evaluation = JSON.parse(result.stdout) as { verdict?: string };
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
  } catch (error) {
    await log(input.cwd, `integration=error reason=${JSON.stringify(error instanceof Error ? error.message : String(error))}`);
    return {
      systemMessage: `Lie Detector error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function log(cwd: string, message: string): Promise<void> {
  await appendLocalLog(cwd, message).catch(() => undefined);
}

function cliError(stdout: string, stderr: string): string {
  if (stderr) return stderr.trim().replace(/^Lie Detector:\s*/, '');

  const evaluation = JSON.parse(stdout) as {
    verifications?: Array<{ result: { error?: string } }>;
  };
  return evaluation.verifications?.find(({ result }) => result.error)?.result.error
    ?? 'Verifier failed.';
}
