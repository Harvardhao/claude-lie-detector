import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/config/index.js';

const directories: string[] = [];

async function configFile(contents: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lie-detector-config-'));
  directories.push(directory);
  const path = join(directory, '.claude-lie-detector.json');
  await writeFile(path, contents, 'utf8');
  return path;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('loadConfig', () => {
  it('loads verifier routes and timeout', async () => {
    const path = await configFile(JSON.stringify({
      verify: 'npm test',
      verifyTests: 'npm test -- --run',
      verifyBuild: 'npm run build',
      verifyLint: 'npm run lint',
      timeoutMs: 120_000,
    }));

    await expect(loadConfig(path)).resolves.toEqual({
      verify: 'npm test',
      verifyTests: 'npm test -- --run',
      verifyBuild: 'npm run build',
      verifyLint: 'npm run lint',
      timeoutMs: 120_000,
    });
  });

  it('rejects malformed JSON', async () => {
    const path = await configFile('{');
    await expect(loadConfig(path)).rejects.toThrow(`Invalid JSON configuration: ${path}`);
  });

  it.each([
    [{}, 'Configuration "verify" must be a non-empty string.'],
    [{ verify: 'npm test', verifyBuild: '' }, 'Configuration "verifyBuild" must be a non-empty string.'],
    [{ verify: 'npm test', timeoutMs: 0 }, 'Configuration "timeoutMs" must be a positive integer.'],
  ])('rejects invalid values in %j', async (value, message) => {
    const path = await configFile(JSON.stringify(value));
    await expect(loadConfig(path)).rejects.toThrow(message);
  });

  it('reports a missing file', async () => {
    const path = join(tmpdir(), `missing-lie-detector-${Date.now()}.json`);
    await expect(loadConfig(path)).rejects.toThrow(`Configuration file not found: ${path}`);
  });
});
