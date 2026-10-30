import path from 'node:path';
import { joinAll, list, tilde } from '../fsutil';
import { installedBundleIds } from '../uninstaller';
import { contentsRule, libPath } from './helpers';
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

/**
 * Library folders named after an app's bundle id. Caches aren't here: the application caches
 * rule already clears those for installed and deleted apps alike.
 */
const LEFTOVER_KINDS = ['Containers', 'Saved Application State', 'HTTPStorages', 'WebKit', 'Application Scripts'];
const BUNDLE_ID = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+){2,}$/;

/**
 * The bundle id a Library entry is named after. Entries can carry a suffix, a developer team
 * prefix or a group prefix: "BQR82RBBHL.com.tinyspeck.slackmacgap", "group.com.foo.shared".
 */
export const bundleIdOf = (entry: string) =>
  entry
    .replace(/\.(savedState|binarycookies)$/i, '')
    .replace(/^[A-Z0-9]{10}\./, '')
    .replace(/^groups?\./i, '');

/**
 * "com.microsoft.oneauth" → "com.microsoft". Vendors share helpers and data between their apps,
 * so anything from a vendor with an app still installed is kept. That misses some real
 * leftovers, which is the safe way to be wrong.
 */
const vendorOf = (id: string) => id.toLowerCase().split('.').slice(0, 2).join('.');

/** Apple's ids, including Shortcuts, which still uses the ids of Workflow, the app it grew from. */
const appleOwned = (id: string) => id.includes('com.apple.') || id.startsWith('is.workflow.');

const deletedAppLeftovers: CleanupRule = {
  id: 'app-leftovers',
  name: 'Leftovers from deleted apps',
  category: 'system',
  safety: 'review',
  toTrash: true,
  explain:
    'Data that apps you’ve already removed left behind, such as their sandbox containers and saved window state. Nothing belonging to an app that’s still installed is included. It moves to the Trash.',
  roots: (ctx) => LEFTOVER_KINDS.map((kind) => libPath(ctx, kind)),
  async scan(ctx) {
    const installed = await installedBundleIds(ctx);
    if (!installed) return { targets: [], detail: '~/Library', blocked: 'Turn on Spotlight so Lumen can tell which apps are installed' };
    const installedVendors = new Set([...installed].map(vendorOf));
    const targets: string[] = [];
    const labels: Record<string, string> = {};
    for (const kind of LEFTOVER_KINDS) {
      const dir = libPath(ctx, kind);
      for (const entry of await list(dir)) {
        const id = bundleIdOf(entry);
        const lower = id.toLowerCase();
        if (!BUNDLE_ID.test(id) || appleOwned(lower) || NEVER_CLEAN(lower) || installedVendors.has(vendorOf(lower))) continue;
        const target = path.join(dir, entry);
        targets.push(target);
        labels[target] = `${id} · ${kind}`;
      }
    }
    return { targets, labels, detail: `${targets.length} item${targets.length === 1 ? '' : 's'} from apps that are no longer installed` };
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
  deletedAppLeftovers,
];
