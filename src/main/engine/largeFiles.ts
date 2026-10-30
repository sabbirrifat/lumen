import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { FileInfo, FileKind, LargeFilesProgress } from '~shared/types';

const KINDS: [FileKind, RegExp][] = [
  ['video', /\.(mp4|mov|m4v|mkv|avi|webm|wmv|flv|mpg|mpeg|prores)$/i],
  ['audio', /\.(mp3|wav|aiff?|flac|m4a|aac|ogg|caf|logicx)$/i],
  ['image', /\.(jpe?g|png|heic|tiff?|raw|cr2|cr3|nef|arw|dng|psd|gif|webp)$/i],
  ['disk-image', /\.(dmg|iso|img|sparseimage|sparsebundle|vmdk|qcow2|vdi|utm)$/i],
  ['installer', /\.(pkg|mpkg|xip|ipa|apk|exe|msi)$/i],
  ['archive', /\.(zip|rar|7z|tar|gz|tgz|bz2|xz|zst)$/i],
  ['document', /\.(pdf|key|pages|numbers|docx?|pptx?|xlsx?|csv|sqlite|db)$/i],
];

export function kindOf(name: string): FileKind {
  return KINDS.find(([, pattern]) => pattern.test(name))?.[0] ?? 'other';
}

/** Hidden folders, ~/Library, dependency folders and bundles are skipped. */
const PRUNE = ['.*', 'node_modules', '*.app', '*.photoslibrary', '*.musiclibrary', '*.tvlibrary', '*.xcarchive', '*.fcpbundle'];

/**
 * Files in `home` at least `minSize` bytes. `find` does the walking natively and streams results;
 * `signal` stops it early.
 */
export function findLargeFiles(
  home: string,
  minSize: number,
  onProgress?: (progress: LargeFilesProgress) => void,
  signal?: AbortSignal,
): Promise<FileInfo[]> {
  const pruneArgs = PRUNE.flatMap((name, i) => [...(i ? ['-o'] : []), '-name', name]);
  const args = [
    home, '-mindepth', '1',
    '(', '-type', 'd', '(', ...pruneArgs, '-o', '-path', path.join(home, 'Library'), ')', ')', '-prune',
    '-o', '-type', 'f', '-size', `+${Math.max(1, Math.floor(minSize / 1024))}k`, '-print0',
  ];
  return new Promise((resolve) => {
    const child = spawn('find', args, { signal, stdio: ['ignore', 'pipe', 'ignore'] });
    const pending: Promise<FileInfo | null>[] = [];
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      const parts = buffer.split('\0');
      buffer = parts.pop() ?? '';
      for (const file of parts) {
        pending.push(
          stat(file).then(
            (info) => ({
              path: file,
              name: path.basename(file),
              size: info.size,
              accessed: info.atimeMs,
              modified: info.mtimeMs,
              kind: kindOf(file),
            }),
            () => null,
          ),
        );
        onProgress?.({ found: pending.length, current: path.dirname(file) });
      }
    });
    const finish = async () => {
      const files = (await Promise.all(pending)).filter((f): f is FileInfo => f !== null);
      resolve(files.sort((a, b) => b.size - a.size));
    };
    child.on('close', finish);
    child.on('error', finish);
  });
}
