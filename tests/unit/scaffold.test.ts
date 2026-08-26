import { describe, expect, it } from 'vitest';

import * as cli from '../../src/cli/index.js';
import * as config from '../../src/config/index.js';
import * as detector from '../../src/detector/index.js';
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
      verifier,
      orchestration,
      claudeCode,
      windowsPresentation,
      shared,
    ];

    expect(modules).toHaveLength(8);
    expect(modules.every((module) => typeof module === 'object')).toBe(true);
  });
});
