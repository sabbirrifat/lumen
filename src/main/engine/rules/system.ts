import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { joinAll, list, tilde } from '../fsutil';
import { contentsRule, homePath, libPath } from './helpers';
import type { CleanupRule } from './types';

/** Lumen's own caches, and Apple's, which system services rely on. */
const NEVER_CLEAN = (name: string) => name.startsWith('com.apple.') || name === 'CloudKit' || /^(app\.lumen|lumen)/i.test(name);

/**
 * Everything in ~/Library/Caches that a more specific rule doesn't already cover, skipping apps
 * that are running right now (cache folders are named after the app's bundle id).
 */
export function appCachesRule(specificRules: CleanupRule[]): CleanupRule {
  return {
    id: 'app-caches',
    name: 'Application caches',
    category: 'system',
    safety: 'safe',
    explain: 'Temporary files apps keep to load faster, such as Spotify and Telegram media. Apps rebuild them as needed. Caches of running apps are skipped.',
    roots: (ctx) => [libPath(ctx, 'Caches')],
    async scan(ctx) {
      const dir = libPath(ctx, 'Caches');
      const claimed = new Set<string>();
      for (const rule of specificRules) {
        for (const root of rule.roots(ctx)) {
          if (root.startsWith(dir + path.sep)) claimed.add(root.slice(dir.length + 1).split(path.sep)[0]);
        }
      }
      const running = [...ctx.processes.bundleIds].map((id) => id.toLowerCase());
      const isRunning = (name: string) => running.some((id) => name.toLowerCase() === id || name.toLowerCase().startsWith(`${id}.`));
      const names = await list(dir);
      const skipped = names.filter((n) => !claimed.has(n) && !NEVER_CLEAN(n) && isRunning(n)).length;
      const targets = joinAll(dir, names.filter((n) => !claimed.has(n) && !NEVER_CLEAN(n) && !isRunning(n)));
      return { targets, detail: tilde(ctx.home, dir) + (skipped ? ` · skips ${skipped} running app${skipped === 1 ? '' : 's'}` : '') };
    },
  };
}

const trash: CleanupRule = {
  id: 'trash',
  name: 'Trash',
  category: 'system',
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

export const systemRules: CleanupRule[] = [
  contentsRule({
    id: 'user-logs',
    name: 'App logs',
    category: 'system',
    explain: 'Log files apps write for troubleshooting. They start fresh on their own.',
    dirs: (ctx) => [libPath(ctx, 'Logs')],
    keep: ['DiagnosticReports'],
  }),
  contentsRule({
    id: 'crash-reports',
    name: 'Crash reports',
    category: 'system',
    explain: 'Reports saved after apps crashed. Only useful if you’re sending one to a developer.',
    dirs: (ctx) => [libPath(ctx, 'Logs', 'DiagnosticReports')],
  }),
  trash,
];
