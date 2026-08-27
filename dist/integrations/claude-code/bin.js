#!/usr/bin/env node
import { runClaudeCodeHook, serializeHookOutput } from './index.js';
let source = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin)
    source += chunk;
const output = await runClaudeCodeHook(source);
process.stdout.write(serializeHookOutput(output));
//# sourceMappingURL=bin.js.map