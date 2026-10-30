import path from 'node:path';
import type { AppInfo, Leftover } from '~shared/types';
import type { EngineContext } from './context';
import { exec } from './exec';
import { list, mapLimit } from './fsutil';
import { readPlist } from './plist';
import { sizesOf } from './size';

/** ~/Library folders where apps leave files behind. */
export const LEFTOVER_DIRS = [
  'Application Support',
  'Application Scripts',
  'Caches',
  'Containers',
  'Group Containers',
  'Cookies',
  'HTTPStorages',
  'LaunchAgents',
  'Logs',
  'Preferences',
  'Saved Application State',
  'WebKit',
];

export const applicationDirs = (ctx: EngineContext) =>
  ctx.external ? ['/Applications', path.join(ctx.home, 'Applications')] : [path.join(ctx.home, 'Applications')];

interface BundleInfo {
  CFBundleIdentifier?: string;
  CFBundleName?: string;
  CFBundleDisplayName?: string;
  CFBundleShortVersionString?: string;
}

const readBundle = (appPath: string): Promise<BundleInfo | null> => readPlist(path.join(appPath, 'Contents', 'Info.plist'));

/** Apps the user installed. Apple's own apps are left out: macOS protects and reinstalls them. */
export async function listApps(ctx: EngineContext, dirs = applicationDirs(ctx)): Promise<AppInfo[]> {
  const paths: string[] = [];
  for (const dir of dirs) {
    paths.push(...(await list(dir)).filter((name) => name.endsWith('.app')).map((name) => path.join(dir, name)));
  }
  const apps = await mapLimit(paths, 8, async (appPath): Promise<AppInfo | null> => {
    const bundle = await readBundle(appPath);
    const bundleId = bundle?.CFBundleIdentifier ?? '';
    if (!bundleId || bundleId.startsWith('com.apple.')) return null;
    return {
      path: appPath,
      name: bundle?.CFBundleDisplayName || bundle?.CFBundleName || path.basename(appPath, '.app'),
      bundleId,
      version: bundle?.CFBundleShortVersionString ?? '',
      size: (await sizesOf([appPath])).get(appPath) ?? 0,
      running: ctx.processes.bundleIds.has(bundleId),
    };
  });
  return apps.filter((a): a is AppInfo => a !== null).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Library files that belong to `app`: names containing its bundle id, or exactly its name
 * (e.g. "~/Library/Application Support/Slack"). Short names are skipped to avoid false matches.
 */
export async function findLeftovers(ctx: EngineContext, app: Pick<AppInfo, 'bundleId' | 'name' | 'path'>): Promise<Leftover[]> {
  const id = app.bundleId.toLowerCase();
  const names = new Set([app.name, path.basename(app.path, '.app')].map((n) => n.toLowerCase()).filter((n) => n.length >= 4));
  const matches = (entry: string) => {
    const lower = entry.toLowerCase();
    return lower.includes(id) || names.has(lower) || names.has(lower.replace(/\.(plist|savedstate|binarycookies)$/, ''));
  };
  const found: { path: string; kind: string }[] = [];
  for (const kind of LEFTOVER_DIRS) {
    const dir = path.join(ctx.home, 'Library', kind);
    for (const entry of await list(dir)) if (matches(entry)) found.push({ path: path.join(dir, entry), kind });
  }
  const sizes = await sizesOf(found.map((f) => f.path));
  return found.map((f) => ({ ...f, size: sizes.get(f.path) ?? 0 })).sort((a, b) => b.size - a.size);
}

export const leftoverRoots = (ctx: EngineContext) => LEFTOVER_DIRS.map((d) => path.join(ctx.home, 'Library', d));

/** Spotlight lists hundreds of apps on a real Mac; far fewer means its index can't be trusted. */
const MIN_SPOTLIGHT_APPS = 10;

/**
 * Lower-cased bundle ids of every installed or running app: Applications folders, plus
 * Spotlight's view of apps anywhere on disk. Null when Spotlight can't answer, because then
 * an app's data could be mistaken for a leftover.
 */
export async function installedBundleIds(ctx: EngineContext): Promise<Set<string> | null> {
  const ids = new Set([...ctx.processes.bundleIds].map((id) => id.toLowerCase()));
  const paths: string[] = [];
  for (const dir of applicationDirs(ctx)) {
    paths.push(...(await list(dir)).filter((name) => name.endsWith('.app')).map((name) => path.join(dir, name)));
  }
  for (const bundle of await mapLimit(paths, 8, readBundle)) {
    if (bundle?.CFBundleIdentifier) ids.add(bundle.CFBundleIdentifier.toLowerCase());
  }
  if (ctx.external) {
    const query = await exec('mdfind', ['-attr', 'kMDItemCFBundleIdentifier', 'kMDItemContentType == "com.apple.application-bundle"'], 60_000);
    const found = [...query.stdout.matchAll(/kMDItemCFBundleIdentifier = (\S+)/g)].map((m) => m[1].toLowerCase());
    if (!query.ok || found.length < MIN_SPOTLIGHT_APPS) return null;
    found.forEach((id) => ids.add(id));
  }
  return ids;
}
