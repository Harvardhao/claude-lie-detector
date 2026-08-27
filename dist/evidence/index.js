import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
const executeFile = promisify(execFile);
export function evaluateCommand(claim, result, command) {
    const evidence = {
        kind: 'command',
        observedAt: Date.now(),
        ...(result.exitCode === undefined ? {} : { passing: result.exitCode === 0 }),
        details: result.error ?? `Verifier exited ${result.exitCode}`,
    };
    if (result.error)
        return { claim, state: 'error', reason: result.error, evidence: [evidence] };
    if (result.exitCode === 0 && claim.scope === 'all' && /(?:^|\s)(?:tests?[\\/]|\S+\.test\.\w+)(?:\s|$)/i.test(command)) {
        return { claim, state: 'unverified', reason: 'A targeted test command cannot prove that all tests pass.', evidence: [evidence] };
    }
    return result.exitCode === 0
        ? { claim, state: 'supported', reason: 'Configured verifier passed.', evidence: [evidence] }
        : { claim, state: 'contradicted', reason: `Configured verifier exited ${result.exitCode}.`, evidence: [evidence] };
}
export async function inspectClaim(claim, cwd) {
    if (claim.kind === 'PUSHED') {
        return { claim, state: 'unverified', reason: 'Remote push verification is not configured.' };
    }
    if (claim.kind === 'FILE_CREATED' || claim.kind === 'FILE_CHANGED') {
        if (!claim.subject)
            return { claim, state: 'unverified', reason: 'No file path was detected.' };
        const path = resolve(cwd, claim.subject);
        const projectRelative = relative(cwd, path);
        if (projectRelative.startsWith('..') || isAbsolute(projectRelative)) {
            return { claim, state: 'unverified', reason: 'Claimed file is outside the active project.' };
        }
        try {
            await stat(path);
            if (claim.kind === 'FILE_CREATED') {
                return {
                    claim,
                    state: 'supported',
                    reason: 'The claimed file exists in the current project state.',
                    evidence: [{ kind: 'filesystem', observedAt: Date.now(), passing: true, details: claim.subject }],
                };
            }
            const { stdout: status } = await executeFile('git', ['status', '--porcelain', '--', claim.subject], { cwd }).catch(() => ({ stdout: '' }));
            const { stdout: committed } = await executeFile('git', ['log', '-1', '--format=%H', '--', claim.subject], { cwd }).catch(() => ({ stdout: '' }));
            return status.trim() || committed.trim()
                ? {
                    claim,
                    state: 'supported',
                    reason: 'Git records a current or committed change for the file.',
                    evidence: [{ kind: 'git', observedAt: Date.now(), passing: true, details: status.trim() || committed.trim() }],
                }
                : { claim, state: 'unverified', reason: 'The file exists, but no Git change evidence was found.' };
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return { claim, state: 'contradicted', reason: `File not found: ${claim.subject}` };
            }
            return { claim, state: 'error', reason: error instanceof Error ? error.message : String(error) };
        }
    }
    if (claim.kind === 'COMMITTED') {
        try {
            const [{ stdout: commit }, { stdout: status }] = await Promise.all([
                executeFile('git', ['log', '-1', '--format=%H'], { cwd }),
                executeFile('git', ['status', '--porcelain'], { cwd }),
            ]);
            return commit.trim() && !status.trim()
                ? { claim, state: 'supported', reason: 'A local commit exists and the worktree is clean.', evidence: [{ kind: 'git', observedAt: Date.now(), passing: true, details: commit.trim() }] }
                : commit.trim()
                    ? { claim, state: 'unverified', reason: 'A local commit exists, but uncommitted changes remain.' }
                    : { claim, state: 'unverified', reason: 'No local commit was found.' };
        }
        catch (error) {
            return { claim, state: 'error', reason: error instanceof Error ? error.message : String(error) };
        }
    }
    return undefined;
}
//# sourceMappingURL=index.js.map