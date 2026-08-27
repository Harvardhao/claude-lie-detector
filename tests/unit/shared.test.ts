import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { runProjectQueue } from '../../src/shared/index.js';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('runProjectQueue', () => {
  it('serializes work and retains only the pending event', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'lie-detector-queue-project-'));
    directories.push(cwd);
    const seen: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });

    const first = runProjectQueue(cwd, { id: 'one', source: 'one' }, async (source) => {
      seen.push(source);
      await gate;
      return source;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = runProjectQueue(cwd, { id: 'two', source: 'two' }, async (source) => {
      seen.push(source);
      return source;
    });
    release();

    await expect(first).resolves.toBe('one');
    await expect(second).resolves.toBeUndefined();
    expect(seen).toEqual(['one', 'two']);
  });
});
