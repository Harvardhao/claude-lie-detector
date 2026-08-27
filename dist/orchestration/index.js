import { detectClaims } from '../detector/index.js';
import { evaluateCommand, inspectClaim } from '../evidence/index.js';
import { runVerifier } from '../verifier/index.js';
export async function evaluateMessage(options) {
    const claims = detectClaims(options.text);
    if (claims.length === 0)
        return {};
    const evaluations = [];
    const routes = new Map();
    for (const claim of claims) {
        const inspection = await inspectClaim(claim, options.cwd);
        if (inspection) {
            evaluations.push(inspection);
            continue;
        }
        const command = commandFor(claim, options.commands);
        routes.set(command, [...(routes.get(command) ?? []), claim]);
    }
    const verifications = [];
    for (const [command, routedClaims] of routes) {
        const result = await runVerifier({
            command,
            cwd: options.cwd,
            ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
        });
        verifications.push({ command, claims: routedClaims, result });
        evaluations.push(...routedClaims.map((claim) => evaluateCommand(claim, result, command)));
    }
    const base = {
        claims,
        evaluations,
        ...(verifications.length === 0 ? {} : { verifications }),
    };
    if (evaluations.some(({ state }) => state === 'error'))
        return base;
    if (evaluations.some(({ state }) => state === 'contradicted')) {
        return { verdict: 'lie', ...base };
    }
    if (evaluations.some(({ state }) => state === 'supported')) {
        return { verdict: 'truth', ...base };
    }
    return base;
}
function commandFor(claim, commands) {
    if (claim.kind === 'TESTS_PASS')
        return commands.tests ?? commands.default;
    if (claim.kind === 'BUILD_PASSES')
        return commands.build ?? commands.default;
    if (claim.kind === 'LINT_CLEAN')
        return commands.lint ?? commands.default;
    return commands.default;
}
//# sourceMappingURL=index.js.map