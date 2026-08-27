import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export async function presentVerdict(request) {
    if (process.platform !== 'win32' || (!request.popup && !request.soundEnabled))
        return undefined;
    const script = fileURLToPath(new URL('../../../assets/show-verdict.ps1', import.meta.url));
    const child = spawn('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        script,
        '-Verdict',
        request.verdict.toUpperCase(),
        '-DurationMs',
        String(request.durationMs),
        '-Popup',
        String(request.popup),
        '-Sound',
        String(request.soundEnabled),
        ...(request.imagePath ? ['-ImagePath', request.imagePath] : []),
        ...(request.soundPath ? ['-SoundPath', request.soundPath] : []),
    ], { detached: true, stdio: 'ignore', windowsHide: true });
    return new Promise((resolve) => {
        child.once('error', (error) => resolve(error.message));
        child.once('spawn', () => {
            child.unref();
            resolve(undefined);
        });
    });
}
//# sourceMappingURL=index.js.map