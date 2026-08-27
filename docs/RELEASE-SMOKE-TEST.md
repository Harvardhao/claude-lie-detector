# Release smoke test

Run this on a Windows machine before tagging a release. Everything else
(claim detection, evidence, freshness, scope, verifier routing, queue/debounce,
logging, hook output shape) is covered by `npm test`. This checklist covers only
what automation cannot: the WPF popup, audio, and the live Claude Code hook.

Prep once:

```powershell
npm ci
npm run build
npm test          # expect: all files passed
```

Create a throwaway project to verify against:

```powershell
$proj = "$env:TEMP\lie-detector-smoke"
New-Item -ItemType Directory -Force $proj | Out-Null
Set-Content "$proj\.claude-lie-detector.json" '{ "verify": "node -e \"process.exit(0)\"", "popup": true, "sound": true, "popupDurationMs": 2000 }'
```

## 1. Popup and audio, in isolation

Drives `assets/show-verdict.ps1` directly — no Node, no Claude Code.

| # | Command | Expect |
|---|---------|--------|
| 1.1 | `powershell -NoProfile -ExecutionPolicy Bypass -File assets/show-verdict.ps1 -Verdict TRUTH -DurationMs 2000 -Popup True -Sound False` | Green centered window reading **TRUTH**, on top of other windows, auto-closes after ~2s |
| 1.2 | `powershell -NoProfile -ExecutionPolicy Bypass -File assets/show-verdict.ps1 -Verdict LIE -DurationMs 8000 -Popup True -Sound False`, then click the window | Red **LIE** window closes immediately on left-click |
| 1.3 | same as 1.2 but press `Esc` instead of clicking | Window closes on `Esc` |
| 1.4 | 1.1 with `-ImagePath "<abs path to a real .png>"` | Image fills the window instead of the text |
| 1.5 | 1.1 with `-ImagePath "C:\does\not\exist.png"` | Falls back to centered text, no crash |
| 1.6 | 1.1 with `-Sound True -SoundPath "<abs path to a real .wav>"` | Sound plays once; window still behaves |
| 1.7 | 1.6 with `-SoundPath "C:\does\not\exist.wav"` | Silent, no crash |

## 2. Hook executable, simulated Stop event

Feeds the JSON a real `Stop` hook would send into the compiled binary.

| # | Command | Expect |
|---|---------|--------|
| 2.1 | `('{"hook_event_name":"Stop","session_id":"s1","cwd":"' + $proj.Replace('\','/') + '","last_assistant_message":"All tests pass."}') \| node dist/integrations/claude-code/bin.js` | stdout is `{"hookSpecificOutput":{"hookEventName":"Stop","systemMessage":"Lie Detector: TRUTH"}}`; a green TRUTH popup appears; exit code 0 |
| 2.2 | edit the config's `verify` to `node -e "process.exit(1)"`, rerun 2.1 | `systemMessage` ends `LIE`; red popup; exit code 0 |
| 2.3 | set `last_assistant_message` to `"Still working on it."` | stdout is `{}`; no popup; exit code 0 |
| 2.4 | delete `.claude-lie-detector.json`, rerun 2.1 | `systemMessage` contains `Lie Detector error: Configuration file not found:`; no popup; exit code 0 |
| 2.5 | pipe in `{` (invalid JSON) | `systemMessage` is `Lie Detector error: Invalid Claude Code hook JSON.`; exit code 0 |
| 2.6 | after any run, open `$proj\.claude-lie-detector.log` | one readable line per run: claim/verdict/error, timestamps present, understandable at a glance |
| 2.7 | with a config that sets no `truthImage`/`truthSound`, rerun 2.1 | popup shows the bundled `assets/truth.png` and plays `assets/truth.wav` with no per-project config |
| 2.8 | add `"truthImage": "custom.png"` (a real file in `$proj`) and rerun 2.1 | popup shows `custom.png`, not the bundled image |

## 3. Live Claude Code integration

| # | Step | Expect |
|---|------|--------|
| 3.1 | `claude plugin validate . --strict` (if the installed Claude Code has the validator) | passes with no errors |
| 3.2 | From `$proj`, restore a passing config, then `claude --plugin-dir <repo path>` and ask Claude to make a trivial change and confirm "tests pass" | on turn end, a TRUTH popup appears; Claude is not blocked; a log line is written |
| 3.3 | Break the project so `verify` fails, repeat 3.2 | LIE popup; Claude still not blocked |
| 3.4 | Add `"mute": true` (or launch with `--mute` equivalent via config) and repeat | popup shows, no sound |
| 3.5 | Set `"popup": false`, repeat | no popup; hook still logs and returns |

## Sign-off

Release is clear when every row above passes, or a failing row is triaged as a
known, documented limitation with no blocker. Record the date, Claude Code
version, and Windows build here before tagging.

- Date:
- Claude Code version:
- Windows build:
- Result:
