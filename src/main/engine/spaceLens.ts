import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { DirEntry } from '~shared/types';
import { mapLimit } from './fsutil';
import { sizesOf } from './size';

const PACKAGE = /\.(app|photoslibrary|musiclibrary|tvlibrary|bundle|framework|plugin|kext|xcarchive|pkg|imovielibrary|fcpbundle)$/i;

/**
 * Sizes of everything directly inside `dir`. Folders are measured with `du` six at a time and
 * reported through `onEntry` as each finishes, so the UI can fill in while big folders run.
 */
export async function listDir(dir: string, onEntry?: (entry: DirEntry) => void): Promise<DirEntry[]> {
  const dirents = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const entries = await mapLimit(dirents, 6, async (dirent) => {
    const p = path.join(dir, dirent.name);
    const isDir = dirent.isDirectory();
    const size = isDir
      ? ((await sizesOf([p])).get(p) ?? 0)
      : await lstat(p).then((info) => info.blocks * 512, () => 0);
    const entry: DirEntry = { path: p, name: dirent.name, size, isDir, isPackage: isDir && PACKAGE.test(dirent.name) };
    onEntry?.(entry);
    return entry;
  });
  return entries.sort((a, b) => b.size - a.size);
}
