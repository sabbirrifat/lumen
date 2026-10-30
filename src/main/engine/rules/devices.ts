import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { readPlist } from '../plist';
import { contentsRule, libPath } from './helpers';
import type { CleanupRule } from './types';

/** "Sam's iPhone · backed up 3 Mar 2025", from the backup's Info.plist. */
async function describeBackup(dir: string): Promise<string | undefined> {
  const info = await readPlist(path.join(dir, 'Info.plist'));
  if (!info?.['Device Name']) return undefined;
  const date = info['Last Backup Date'] ? new Date(info['Last Backup Date']) : null;
  const when = date && !Number.isNaN(date.getTime()) ? ` · backed up ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
  return `${info['Device Name']}${when}`;
}

const backups: CleanupRule = {
  id: 'ios-backups',
  name: 'iPhone and iPad backups',
  category: 'devices',
  safety: 'review',
  toTrash: true,
  explain:
    'Backups of iPhones and iPads made with Finder. Keep the newest backup of any device you still use; backups of old devices can usually go. They move to the Trash.',
  roots: (ctx) => [libPath(ctx, 'Application Support', 'MobileSync', 'Backup')],
  async scan(ctx) {
    const dir = libPath(ctx, 'Application Support', 'MobileSync', 'Backup');
    let names: string[];
    try {
      names = (await readdir(dir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (error) {
      const denied = (error as NodeJS.ErrnoException).code === 'EPERM';
      return { targets: [], detail: 'MobileSync backups', blocked: denied ? 'Needs Full Disk Access' : undefined };
    }
    const targets = names.map((name) => path.join(dir, name));
    const labels: Record<string, string> = {};
    for (const target of targets) {
      const label = await describeBackup(target);
      if (label) labels[target] = label;
    }
    return { targets, labels, detail: `${targets.length} backup${targets.length === 1 ? '' : 's'}` };
  },
};

export const deviceRules: CleanupRule[] = [
  backups,
  contentsRule({
    id: 'ios-updates',
    name: 'iPhone and iPad software updates',
    category: 'devices',
    explain: 'System updates Finder downloaded to update or restore a device. Finder downloads them again if they’re needed.',
    dirs: (ctx) => ['iPhone', 'iPad', 'iPod'].map((device) => libPath(ctx, 'iTunes', `${device} Software Updates`)),
  }),
];
