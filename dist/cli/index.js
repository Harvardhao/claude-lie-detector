import { resolve } from 'node:path';
import { loadConfig } from '../config/index.js';
import { evaluateMessage } from '../orchestration/index.js';
import { presentVerdict } from '../presentation/windows/index.js';
export async function runCli(args, defaultCwd = process.cwd()) {
    try {
        const parsed = parseArgs(args, defaultCwd);
        const config = await loadConfig(parsed.configPath);
        const commands = {
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
            ...resolveAsset(evaluation.verdict === 'truth' ? config.truthImage : config.lieImage, parsed.cwd, 'imagePath'),
            ...resolveAsset(evaluation.verdict === 'truth' ? config.truthSound : config.lieSound, parsed.cwd, 'soundPath'),
        };
        if (evaluation.verifications?.some(({ result }) => result.error !== undefined)) {
            return { exitCode: 2, stdout, stderr: '' };
        }
        if (evaluation.verdict === 'lie') {
            return { exitCode: 1, stdout, stderr: '', ...(presentation ? { presentation } : {}) };
        }
        return { exitCode: 0, stdout, stderr: '', ...(presentation ? { presentation } : {}) };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { exitCode: 2, stdout: '', stderr: `Lie Detector: ${message}\n` };
    }
}
export async function presentCliResult(result) {
    return result.presentation ? presentVerdict(result.presentation) : undefined;
}
function parseArgs(args, defaultCwd) {
    let text;
    let cwdValue = defaultCwd;
    let configValue;
    let verify;
    let timeoutMs;
    let mute = false;
    let noPopup = false;
    for (let index = 0; index < args.length;) {
        const flag = args[index];
        if (flag === '--mute' || flag === '--no-popup') {
            if (flag === '--mute')
                mute = true;
            else
                noPopup = true;
            index += 1;
            continue;
        }
        if (!['--text', '--cwd', '--config', '--verify', '--timeout-ms'].includes(flag ?? '')) {
            throw new Error(`Unknown argument: ${flag}`);
        }
        const value = args[index + 1];
        if (value === undefined)
            throw new Error(`Missing value for ${flag}.`);
        if (flag === '--text')
            text = value;
        else if (flag === '--cwd')
            cwdValue = value;
        else if (flag === '--config')
            configValue = value;
        else if (flag === '--verify')
            verify = value;
        else if (flag === '--timeout-ms') {
            timeoutMs = Number(value);
            if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
                throw new Error('--timeout-ms must be a positive integer.');
            }
        }
        index += 2;
    }
    if (text === undefined)
        throw new Error('Missing required --text.');
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
function resolveAsset(value, cwd, key) {
    return value === undefined ? {} : { [key]: resolve(cwd, value) };
}
//# sourceMappingURL=index.js.map