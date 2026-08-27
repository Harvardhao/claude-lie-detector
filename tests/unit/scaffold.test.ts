import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import * as cli from '../../src/cli/index.js';
import * as config from '../../src/config/index.js';
import * as detector from '../../src/detector/index.js';
import * as evidence from '../../src/evidence/index.js';
import * as claudeCode from '../../src/integrations/claude-code/index.js';
import * as orchestration from '../../src/orchestration/index.js';
import * as windowsPresentation from '../../src/presentation/windows/index.js';
import * as shared from '../../src/shared/index.js';
import * as verifier from '../../src/verifier/index.js';

describe('project module boundaries', () => {
  it('exposes every planned responsibility as an importable module', () => {
    const modules = [
      cli,
      config,
      detector,
      evidence,
      verifier,
      orchestration,
      claudeCode,
      windowsPresentation,
      shared,
    ];

    expect(modules).toHaveLength(9);
    expect(modules.every((module) => typeof module === 'object')).toBe(true);
  });

  it('exposes the compiled CLI executable', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
      bin?: Record<string, string>;
    };

    expect(packageJson.bin).toEqual({ 'claude-lie-detector': 'dist/cli/bin.js' });
  });
});
