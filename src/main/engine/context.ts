import os from 'node:os';
import { exec } from './exec';
import { exists } from './fsutil';
import { type ProcessSnapshot, snapshotProcesses } from './processes';

export interface EngineContext {
  home: string;
  /** Homebrew prefix: /opt/homebrew on Apple silicon, /usr/local on Intel. */
  brewPrefix: string;
  processes: ProcessSnapshot;
  /**
   * Whether rules may use tools that act on real machine state (docker, simctl) and read
   * cache locations from environment variables. Off when LUMEN_HOME points at a test fixture.
   */
  external: boolean;
  /** Xcode's simctl is available. */
  simctl: boolean;
  /** Folders the user excluded in Settings. Nothing inside them is touched. */
  excluded: string[];
}

export async function createContext(overrides: Partial<EngineContext> = {}): Promise<EngineContext> {
  const fixtureHome = process.env.LUMEN_HOME;
  const external = overrides.external ?? !fixtureHome;
  const brewPrefix =
    overrides.brewPrefix ??
    process.env.LUMEN_BREW_PREFIX ??
    ((await exists('/opt/homebrew')) ? '/opt/homebrew' : '/usr/local');
  return {
    home: overrides.home ?? fixtureHome ?? os.homedir(),
    brewPrefix,
    processes: overrides.processes ?? (await snapshotProcesses()),
    external,
    simctl: overrides.simctl ?? (external && (await exec('xcrun', ['--find', 'simctl'])).ok),
    excluded: overrides.excluded ?? [],
  };
}

/** A cache location from the environment (e.g. UV_CACHE_DIR), ignored in fixture mode. */
export function envPath(ctx: EngineContext, name: string): string | undefined {
  return ctx.external ? process.env[name] || undefined : undefined;
}
