#!/usr/bin/env node
import { presentCliResult, runCli } from './index.js';
const result = await runCli(process.argv.slice(2));
if (result.stdout)
    process.stdout.write(result.stdout);
if (result.stderr)
    process.stderr.write(result.stderr);
const presentationError = await presentCliResult(result);
if (presentationError)
    process.stderr.write(`Lie Detector presentation error: ${presentationError}\n`);
process.exitCode = result.exitCode;
//# sourceMappingURL=bin.js.map