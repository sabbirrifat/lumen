import path from 'node:path';
import type { RuleCategory, Safety } from '~shared/types';
import type { EngineContext } from '../context';
import { existing, joinAll, list, tilde } from '../fsutil';
import { isAppRunning } from '../processes';
import type { CleanupRule } from './types';

export const homePath = (ctx: EngineContext, ...parts: string[]) => path.join(ctx.home, ...parts);
export const libPath = (ctx: EngineContext, ...parts: string[]) => path.join(ctx.home, 'Library', ...parts);

export interface RuleInfo {
  id: string;
  name: string;
  category: RuleCategory;
  safety?: Safety;
  explain: string;
  /** App (without .app) whose files these are; the rule is blocked while it runs. */
  app?: string;
}

export const blockedWhileRunning = (ctx: EngineContext, app?: string) =>
  app && isAppRunning(ctx.processes, app) ? `Quit ${app} to clean` : undefined;

export async function describeDirs(ctx: EngineContext, dirs: string[]): Promise<string> {
  const present = await existing(dirs);
  return (present.length ? present : dirs).map((d) => tilde(ctx.home, d)).join(' · ');
}

/** Deletes everything inside `dirs`; the folders themselves stay. */
export function contentsRule(info: RuleInfo & { dirs(ctx: EngineContext): string[]; keep?: string[] }): CleanupRule {
  return {
    safety: 'safe',
    ...info,
    roots: info.dirs,
    async scan(ctx) {
      const dirs = info.dirs(ctx);
      const targets: string[] = [];
      for (const dir of dirs) {
        targets.push(...joinAll(dir, (await list(dir)).filter((name) => !info.keep?.includes(name))));
      }
      return { targets, detail: await describeDirs(ctx, dirs), blocked: blockedWhileRunning(ctx, info.app) };
    },
  };
}

/** Deletes specific sub-folders (caches inside an app's data folder), leaving everything else. */
export function pathsRule(
  info: RuleInfo & { roots(ctx: EngineContext): string[]; paths(ctx: EngineContext): Promise<string[]> },
): CleanupRule {
  return {
    safety: 'safe',
    ...info,
    async scan(ctx) {
      const targets = await existing(await info.paths(ctx));
      return { targets, detail: await describeDirs(ctx, info.roots(ctx)), blocked: blockedWhileRunning(ctx, info.app) };
    },
  };
}

/**
 * Orders version folder names oldest first: "mac_arm-149.0.7827.22" → [149, 0, 7827, 22].
 * Bare revisions ("mac-1045629", "chromium-1140") predate dotted versions, so they sort first.
 */
export function compareVersions(a: string, b: string): number {
  const key = (name: string) => {
    const parts = name.slice(name.lastIndexOf('-') + 1).split('.').map((p) => Number(p) || 0);
    return parts.length > 1 ? parts : [0, ...parts];
  };
  const x = key(a);
  const y = key(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}
