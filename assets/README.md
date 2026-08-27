# Assets

- `show-verdict.ps1` — the Windows popup/sound presenter. Not user-editable config.
- `truth.png`, `lie.png` — default verdict images, shown centered in the popup.
- `truth.wav`, `lie.wav` — default verdict sounds (WAV only; playback uses
  `System.Media.SoundPlayer`).

A project's `.claude-lie-detector.json` may override any of these with
`truthImage`, `lieImage`, `truthSound`, or `lieSound` (paths relative to the
project). When a key is omitted, the matching file here is used if it exists;
otherwise the popup falls back to centered text and no sound.

Set `CLAUDE_LIE_DETECTOR_ASSETS_DIR` to load the bundled media from another
directory.
