import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { exec } from './exec';

export async function exists(p: string): Promise<boolean> {
  try {
    await lstat(p);
    return true;
  } catch {
    return false;
  }
}

/** Entry names in `dir`, or none when it's missing or unreadable. */
export async function list(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

export const joinAll = (dir: string, names: string[]) => names.map((name) => path.join(dir, name));

export async function existing(paths: string[]): Promise<string[]> {
  const flags = await mapLimit(paths, 16, exists);
  return paths.filter((_, i) => flags[i]);
}

/** Every symlink under `dir`, without following any of them. */
export async function symlinksIn(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const p = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) found.push(p);
    else if (entry.isDirectory()) found.push(...(await symlinksIn(p)));
  }
  return found;
}

/** Like Promise.all over `items`, but with at most `limit` running at once. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const RM_CHUNK = 200;

/** `rm -rf` keeps going past files it can't delete (e.g. protected simulator thumbnails). */
export async function removePaths(paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += RM_CHUNK) {
    await exec('rm', ['-rf', ...paths.slice(i, i + RM_CHUNK)]);
  }
}

/** "/Users/me/Library/Caches" → "~/Library/Caches". */
export function tilde(home: string, p: string): string {
  return p === home ? '~' : p.startsWith(home + path.sep) ? `~${p.slice(home.length)}` : p;
}
