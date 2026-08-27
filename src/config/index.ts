import { readFile } from 'node:fs/promises';

export interface ProjectConfig {
  verify: string;
  verifyTests?: string;
  verifyBuild?: string;
  verifyLint?: string;
  timeoutMs?: number;
}

export async function loadConfig(path: string): Promise<ProjectConfig> {
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Configuration file not found: ${path}`, { cause: error });
    }
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(`Invalid JSON configuration: ${path}`);
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Configuration must be a JSON object.');
  }

  const raw = value as Record<string, unknown>;
  const verify = command(raw.verify, 'verify');
  const verifyTests = optionalCommand(raw.verifyTests, 'verifyTests');
  const verifyBuild = optionalCommand(raw.verifyBuild, 'verifyBuild');
  const verifyLint = optionalCommand(raw.verifyLint, 'verifyLint');
  const timeoutMs = optionalTimeout(raw.timeoutMs);

  return {
    verify,
    ...(verifyTests === undefined ? {} : { verifyTests }),
    ...(verifyBuild === undefined ? {} : { verifyBuild }),
    ...(verifyLint === undefined ? {} : { verifyLint }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

function command(value: unknown, key: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Configuration "${key}" must be a non-empty string.`);
  }
  return value;
}

function optionalCommand(value: unknown, key: string): string | undefined {
  return value === undefined ? undefined : command(value, key);
}

function optionalTimeout(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error('Configuration "timeoutMs" must be a positive integer.');
  }
  return value as number;
}
