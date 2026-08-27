import { resolve } from 'node:path';

import { loadConfig } from '../config/index.js';
import { evaluateMessage, type VerifierCommands } from '../orchestration/index.js';

export interface CliResult {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
}

interface ParsedArgs {
  text: string;
  cwd: string;
  configPath: string;
  verify?: string;
  timeoutMs?: number;
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

    if (evaluation.verifications?.some(({ result }) => result.error !== undefined)) {
      return { exitCode: 2, stdout, stderr: '' };
    }
    if (evaluation.verdict === 'lie') return { exitCode: 1, stdout, stderr: '' };
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { exitCode: 2, stdout: '', stderr: `Lie Detector: ${message}\n` };
  }
}

function parseArgs(args: string[], defaultCwd: string): ParsedArgs {
  let text: string | undefined;
  let cwdValue = defaultCwd;
  let configValue: string | undefined;
  let verify: string | undefined;
  let timeoutMs: number | undefined;

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
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
  }

  if (text === undefined) throw new Error('Missing required --text.');
  const cwd = resolve(defaultCwd, cwdValue);
  return {
    text,
    cwd,
    configPath: resolve(cwd, configValue ?? '.claude-lie-detector.json'),
    ...(verify === undefined ? {} : { verify }),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
}
