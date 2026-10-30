import { truncate } from 'node:fs/promises';
import type { CleanOutcome, CleanProgress } from '~shared/types';
import type { EngineContext } from './context';
import { removePaths } from './fsutil';
import { assertDeletable } from './guard';
import type { CleanupRule, ScanPlan } from './rules';
import { scanRule } from './scanner';
import { sizeOf } from './size';

export interface CleanOptions {
  /** Moves a path to the Trash. Required for rules whose targets are the user's own files. */
  moveToTrash?: (target: string) => Promise<void>;
  /** The "move cleaned caches to the Trash" setting. */
  cachesToTrash?: boolean;
  onProgress?: (progress: CleanProgress) => void;
}

/** Drops every path the guard rejects. */
async function guarded(paths: string[], rule: CleanupRule, ctx: EngineContext): Promise<string[]> {
  const kept: string[] = [];
  for (const target of paths) {
    try {
      await assertDeletable(target, ctx, { roots: rule.roots(ctx), allowNodeModules: rule.allowNodeModules });
      kept.push(target);
    } catch {
      // Rejected paths are simply left alone.
    }
  }
  return kept;
}

const usesTrash = (rule: CleanupRule, opts: CleanOptions) => !!rule.toTrash || !!opts.cachesToTrash;

async function applyPlan(rule: CleanupRule, plan: ScanPlan, ctx: EngineContext, opts: CleanOptions) {
  if (rule.clean) return rule.clean(plan, ctx);
  for (const file of plan.truncate ?? []) await truncate(file).catch(() => undefined);
  if (!usesTrash(rule, opts)) return removePaths(plan.targets);
  // Never fall back to deleting: these may be files the user can't get back.
  if (!opts.moveToTrash) throw new Error('Moving to the Trash isn’t available');
  for (const target of plan.targets) await opts.moveToTrash(target).catch(() => undefined);
}

/**
 * Cleans the given rules one after another. Each rule is re-scanned first, so an app opened
 * or a uv tool started since the scan is respected, and every path goes through the guard.
 */
export async function cleanRules(ctx: EngineContext, rules: CleanupRule[], opts: CleanOptions = {}): Promise<CleanOutcome[]> {
  const outcomes: CleanOutcome[] = [];
  let done = 0;
  for (const [index, rule] of rules.entries()) {
    opts.onProgress?.({ done: index, total: rules.length, current: rule.name, freed: done });
    const { plan, size } = await scanRule(rule, ctx);
    const outcome: CleanOutcome = { id: rule.id, name: rule.name, freed: 0, trashed: 0 };
    outcomes.push(outcome);
    if (plan.blocked) {
      outcome.error = plan.blocked;
      continue;
    }
    const safePlan: ScanPlan = {
      ...plan,
      targets: await guarded(plan.targets, rule, ctx),
      truncate: await guarded(plan.truncate ?? [], rule, ctx),
    };
    try {
      await applyPlan(rule, safePlan, ctx, opts);
      // Measures everything scanned, so paths the guard rejected don't count as cleaned.
      const left = plan.size === undefined ? await sizeOf([...plan.targets, ...(plan.truncate ?? [])]) : 0;
      const cleaned = Math.max(0, size - left);
      if (usesTrash(rule, opts) && !rule.clean) outcome.trashed = cleaned;
      else outcome.freed = cleaned;
      done += cleaned;
    } catch (error) {
      outcome.error = (error as Error).message;
    }
  }
  opts.onProgress?.({ done: rules.length, total: rules.length, current: '', freed: done });
  return outcomes;
}
