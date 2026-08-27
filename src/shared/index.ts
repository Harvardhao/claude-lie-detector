import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface QueuedEvent {
  id: string;
  source: string;
}

export async function runProjectQueue<T>(
  cwd: string,
  event: QueuedEvent,
  run: (source: string) => Promise<T>,
): Promise<T | undefined> {
  const base = join(tmpdir(), `claude-lie-detector-${digest(cwd)}`);
  const lock = join(base, 'active');
  const pending = join(base, 'pending.json');
  const last = join(base, 'last-event');
  await mkdir(base, { recursive: true });

  try {
    await mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    await writeFile(pending, JSON.stringify(event), 'utf8');
    return undefined;
  }

  let output: T | undefined;
  let current: QueuedEvent | undefined = event;
  try {
    while (current) {
      const previous = await readFile(last, 'utf8').catch(() => '');
      if (current.id !== previous) {
        const currentOutput = await run(current.source);
        output ??= currentOutput;
        await writeFile(last, current.id, 'utf8');
      }
      current = await readFile(pending, 'utf8')
        .then((source) => JSON.parse(source) as QueuedEvent)
        .catch(() => undefined);
      await rm(pending, { force: true });
    }
    return output;
  } finally {
    await rm(lock, { recursive: true, force: true });
  }
}

export async function appendLocalLog(cwd: string, message: string): Promise<void> {
  const time = new Date().toISOString();
  await appendFile(join(cwd, '.claude-lie-detector.log'), `[${time}] ${message}\n`, 'utf8');
}

export function eventId(sessionId: string | undefined, text: string): string {
  return digest(`${sessionId ?? 'unknown'}\0${text}`);
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}
