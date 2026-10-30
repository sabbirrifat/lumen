import { execFile } from 'node:child_process';

export interface ExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Runs a command and always resolves. Tools like `du` and `find` exit non-zero when they hit an
 * unreadable file, but their output is still good, so callers decide what `ok` means to them.
 */
export function exec(cmd: string, args: string[], timeout = 0): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout }, (error, stdout, stderr) => {
      resolve({ ok: !error, stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });
}
