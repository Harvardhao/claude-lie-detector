import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function runProjectQueue(cwd, event, run) {
    const base = join(tmpdir(), `claude-lie-detector-${digest(cwd)}`);
    const lock = join(base, 'active');
    const pending = join(base, 'pending.json');
    const last = join(base, 'last-event');
    await mkdir(base, { recursive: true });
    try {
        await mkdir(lock);
    }
    catch (error) {
        if (error.code !== 'EEXIST')
            throw error;
        await writeFile(pending, JSON.stringify(event), 'utf8');
        return undefined;
    }
    let output;
    let current = event;
    try {
        while (current) {
            const previous = await readFile(last, 'utf8').catch(() => '');
            if (current.id !== previous) {
                const currentOutput = await run(current.source);
                output ??= currentOutput;
                await writeFile(last, current.id, 'utf8');
            }
            current = await readFile(pending, 'utf8')
                .then((source) => JSON.parse(source))
                .catch(() => undefined);
            await rm(pending, { force: true });
        }
        return output;
    }
    finally {
        await rm(lock, { recursive: true, force: true });
    }
}
export async function appendLocalLog(cwd, message) {
    const time = new Date().toISOString();
    await appendFile(join(cwd, '.claude-lie-detector.log'), `[${time}] ${message}\n`, 'utf8');
}
export function eventId(sessionId, text) {
    return digest(`${sessionId ?? 'unknown'}\0${text}`);
}
function digest(value) {
    return createHash('sha256').update(value).digest('hex').slice(0, 24);
}
//# sourceMappingURL=index.js.map