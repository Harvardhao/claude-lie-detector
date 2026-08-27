import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../config/index.js';
import { evaluateMessage, type VerifierCommands } from '../orchestration/index.js';
import { presentVerdict, type PresentationRequest } from '../presentation/windows/index.js';

export interface CliResult {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
  presentation?: PresentationRequest;
}

interface ParsedArgs {
  text: string;
  cwd: string;
  configPath: string;
  verify?: string;
  timeoutMs?: number;
  mute: boolean;
  noPopup: boolean;
}

export async function runCli(args: string[], defaultCwd = process.cwd()): Promise<CliResult> {
  try {
    const parsed = parseArgs(args, defaultCwd);
    const config = await loadConfig(parsed.configPath);
    const commands: VerifierCommands = {
      default: parsed.verify ?? config.verify,
      ...(config.verifyTests === undefined ? {} : { tests: config.verifyTests }),
      ...(config.verifyBuild === undefined ? {} : { build: config.verifyBuild }),
      ...(config.verifyLint === undefined ? {} : { lint: config.verifyLint }),
    };
    const timeoutMs = parsed.timeoutMs ?? config.timeoutMs;
    const evaluation = await evaluateMessage({
      text: parsed.text,
      commands,
      cwd: parsed.cwd,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
    });
    const stdout = `${JSON.stringify(evaluation)}\n`;
    const presentation = evaluation.verdict === undefined ? undefined : {
      verdict: evaluation.verdict,
      popup: !parsed.noPopup && (config.popup ?? true),
      durationMs: config.popupDurationMs ?? 1_800,
      soundEnabled: !parsed.mute && (config.sound ?? true),
      ...resolveAsset(
        evaluation.verdict === 'truth' ? config.truthImage : config.lieImage,
        parsed.cwd,
        'imagePath',
        evaluation.verdict === 'truth' ? 'truthImage' : 'lieImage',
      ),
      ...resolveAsset(
        evaluation.verdict === 'truth' ? config.truthSound : config.lieSound,
        parsed.cwd,
        'soundPath',
        evaluation.verdict === 'truth' ? 'truthSound' : 'lieSound',
      ),
    } satisfies PresentationRequest;

    if (evaluation.verifications?.some(({ result }) => result.error !== undefined)) {
      return { exitCode: 2, stdout, stderr: '' };
    }
    if (evaluation.verdict === 'lie') {
      return { exitCode: 1, stdout, stderr: '', ...(presentation ? { presentation } : {}) };
    }
    return { exitCode: 0, stdout, stderr: '', ...(presentation ? { presentation } : {}) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, stdout: '', stderr: `Lie Detector: ${message}\n` };
  }
}

export async function presentCliResult(result: CliResult): Promise<string | undefined> {
  return result.presentation ? presentVerdict(result.presentation) : undefined;
}

function parseArgs(args: string[], defaultCwd: string): ParsedArgs {
  let text: string | undefined;
  let cwdValue = defaultCwd;
  let configValue: string | undefined;
  let verify: string | undefined;
  let timeoutMs: number | undefined;
  let mute = false;
  let noPopup = false;

  for (let index = 0; index < args.length;) {
    const flag = args[index];
    if (flag === '--mute' || flag === '--no-popup') {
      if (flag === '--mute') mute = true;
      else noPopup = true;
      index += 1;
      continue;
    }
    if (!['--text', '--cwd', '--config', '--verify', '--timeout-ms'].includes(flag ?? '')) {
      throw new Error(`Unknown argument: ${flag}`);
    }
    const value = args[index + 1];
    if (value === undefined) throw new Error(`Missing value for ${flag}.`);

    if (flag === '--text') text = value;
    else if (flag === '--cwd') cwdValue = value;
    else if (flag === '--config') configValue = value;
    else if (flag === '--verify') verify = value;
    else if (flag === '--timeout-ms') {
      timeoutMs = Number(value);
      if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
        throw new Error('--timeout-ms must be a positive integer.');
      }
    }
    index += 2;
  }

  if (text === undefined) throw new Error('Missing required --text.');
  const cwd = resolve(defaultCwd, cwdValue);
  return {
    text,
    cwd,
    configPath: resolve(cwd, configValue ?? '.claude-lie-detector.json'),
    mute,
    noPopup,
    ...(verify === undefined ? {} : { verify }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}

const BUNDLED_ASSET_FILES = {
  truthImage: 'truth.png',
  lieImage: 'lie.png',
  truthSound: 'truth.wav',
  lieSound: 'lie.wav',
} as const;

type BundledAsset = keyof typeof BUNDLED_ASSET_FILES;

/**
 * Directory holding the media shipped with the package. Overridable via
 * CLAUDE_LIE_DETECTOR_ASSETS_DIR (used by tests and relocated installs).
 */
function bundledAssetsDir(): string {
  return process.env.CLAUDE_LIE_DETECTOR_ASSETS_DIR
    ?? fileURLToPath(new URL('../../assets/', import.meta.url));
}

function bundledAsset(name: BundledAsset): string | undefined {
  const path = resolve(bundledAssetsDir(), BUNDLED_ASSET_FILES[name]);
  return existsSync(path) ? path : undefined;
}

/**
 * A project's config path wins when set (a missing file still degrades to text
 * or silence in the presenter). Otherwise fall back to the bundled default,
 * but only when that file actually exists.
 */
function resolveAsset(
  value: string | undefined,
  cwd: string,
  key: 'imagePath' | 'soundPath',
  bundled: BundledAsset,
): Partial<PresentationRequest> {
  if (value !== undefined) return { [key]: resolve(cwd, value) };
  const fallback = bundledAsset(bundled);
  return fallback ? { [key]: fallback } : {};
}
