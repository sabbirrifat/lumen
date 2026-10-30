import path from 'node:path';
import type { AppInfo, Leftover } from '~shared/types';
import type { EngineContext } from './context';
import { exec } from './exec';
import { list, mapLimit } from './fsutil';
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

async function readBundle(appPath: string): Promise<BundleInfo | null> {
  const { ok, stdout } = await exec('plutil', ['-convert', 'json', '-o', '-', path.join(appPath, 'Contents', 'Info.plist')]);
  try {
    return ok ? (JSON.parse(stdout) as BundleInfo) : null;
  } catch {
    return null;
  }
}

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
