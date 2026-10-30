import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { joinAll } from '../fsutil';
import { homePath } from './helpers';
import type { CleanupRule } from './types';

const DAY = 24 * 60 * 60 * 1000;
const BUNDLE = /\.(app|photoslibrary|fcpbundle|imovielibrary)$/i;

/**
 * Files and bundles in `dir` (and its sub-folders, up to `depth`) whose names match `pattern`
 * and that haven't changed in `days`. Bundles are matched or skipped whole, never entered.
 */
async function findStale(dir: string, pattern: RegExp, days: number, depth = 2): Promise<string[]> {
  const cutoff = Date.now() - days * DAY;
  const found: string[] = [];
  const walk = async (folder: string, level: number) => {
    for (const entry of await readdir(folder, { withFileTypes: true }).catch(() => [])) {
      const p = path.join(folder, entry.name);
      if (pattern.test(entry.name)) {
        const info = await lstat(p).catch(() => null);
        if (info && info.mtimeMs < cutoff) found.push(p);
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && !BUNDLE.test(entry.name) && level < depth) {
        await walk(p, level + 1);
      }
    }
  };
  await walk(dir, 1);
  return found;
}

const INSTALLERS = /\.(dmg|pkg|mpkg|xip|iso)$/i;
const UNFINISHED = /\.(download|crdownload|part|partial|opdownload)$/i;

const oldInstallers: CleanupRule = {
  id: 'old-installers',
  name: 'Old installers in Downloads',
  category: 'files',
  safety: 'review',
  toTrash: true,
  explain:
    'Disk images and installer packages in Downloads that are more than a week old. Once an app is installed, its installer is rarely needed again. They move to the Trash.',
  roots: (ctx) => [homePath(ctx, 'Downloads')],
  async scan(ctx) {
    const targets = await findStale(homePath(ctx, 'Downloads'), INSTALLERS, 7);
    return { targets, detail: `~/Downloads · ${targets.length} installer${targets.length === 1 ? '' : 's'}` };
  },
};

const unfinishedDownloads: CleanupRule = {
  id: 'unfinished-downloads',
  name: 'Unfinished downloads',
  category: 'files',
  safety: 'safe',
  toTrash: true,
  explain: 'Downloads from Safari, Chrome and Firefox that stopped partway and haven’t moved in a day. They can’t be opened as they are. They move to the Trash.',
  roots: (ctx) => [homePath(ctx, 'Downloads')],
  async scan(ctx) {
    return { targets: await findStale(homePath(ctx, 'Downloads'), UNFINISHED, 1), detail: '~/Downloads' };
  },
};

const trash: CleanupRule = {
  id: 'trash',
  name: 'Trash',
  category: 'files',
  safety: 'review',
  explain: 'Files you’ve already moved to the Trash. Emptying it can’t be undone.',
  roots: (ctx) => [homePath(ctx, '.Trash')],
  async scan(ctx) {
    const dir = homePath(ctx, '.Trash');
    try {
      return { targets: joinAll(dir, await readdir(dir)), detail: '~/.Trash' };
    } catch (error) {
      const denied = (error as NodeJS.ErrnoException).code === 'EPERM';
      return { targets: [], detail: '~/.Trash', blocked: denied ? 'Needs Full Disk Access' : undefined };
    }
  },
};

export const fileRules: CleanupRule[] = [oldInstallers, unfinishedDownloads, trash];
