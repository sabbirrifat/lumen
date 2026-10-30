import { exec } from './exec';

export interface ProcessSnapshot {
  /** Full command line of every running process. */
  commands: string[];
  /** Bundle ids of running apps, from `lsappinfo`. */
  bundleIds: Set<string>;
}

export async function snapshotProcesses(): Promise<ProcessSnapshot> {
  const [ps, apps] = await Promise.all([exec('ps', ['-axo', 'args=']), exec('lsappinfo', ['list'])]);
  return {
    commands: ps.stdout.split('\n').filter(Boolean),
    bundleIds: new Set([...apps.stdout.matchAll(/bundleID="([^"]+)"/g)].map((m) => m[1])),
  };
}

export const emptySnapshot = (): ProcessSnapshot => ({ commands: [], bundleIds: new Set() });

/** True when `/<appName>.app/Contents/MacOS/...` is running, e.g. "Google Chrome". */
export function isAppRunning(snapshot: ProcessSnapshot, appName: string): boolean {
  const needle = `/${appName}.app/Contents/MacOS/`;
  return snapshot.commands.some((command) => command.includes(needle));
}

/**
 * Tools started with `uvx` (MCP servers, for one) run straight out of the uv cache's
 * archive-v0 folder. Those archives must survive a cleanup or the tool breaks mid-run.
 */
export function uvArchivesInUse(snapshot: ProcessSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const command of snapshot.commands) {
    for (const match of command.matchAll(/archive-v0\/([\w-]+)/g)) ids.add(match[1]);
  }
  return ids;
}
