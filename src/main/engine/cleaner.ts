import { truncate } from 'node:fs/promises';
import type { CleanOutcome, CleanProgress } from '~shared/types';
import type { EngineContext } from './context';
import { removePaths } from './fsutil';
import { assertDeletable } from './guard';
import type { CleanupRule, ScanPlan } from './rules';
import { scanRule } from './scanner';
import { sizeOf } from './size';

export interface CleanOptions {
  /** Moves a path to the Trash instead of deleting it (the "caches to Trash" setting). */
  trash?: (target: string) => Promise<void>;
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

async function applyPlan(rule: CleanupRule, plan: ScanPlan, ctx: EngineContext, opts: CleanOptions) {
  if (rule.clean) return rule.clean(plan, ctx);
  for (const file of plan.truncate ?? []) await truncate(file).catch(() => undefined);
  if (opts.trash) {
    for (const target of plan.targets) await opts.trash(target).catch(() => undefined);
  } else {
    await removePaths(plan.targets);
  }
}

/**
 * Cleans the given rules one after another. Each rule is re-scanned first, so an app opened
 * or a uv tool started since the scan is respected, and every path goes through the guard.
 */
export async function cleanRules(ctx: EngineContext, rules: CleanupRule[], opts: CleanOptions = {}): Promise<CleanOutcome[]> {
  const outcomes: CleanOutcome[] = [];
  let freed = 0;
  for (const [index, rule] of rules.entries()) {
    opts.onProgress?.({ done: index, total: rules.length, current: rule.name, freed });
    const { plan, size } = await scanRule(rule, ctx);
    if (plan.blocked) {
      outcomes.push({ id: rule.id, name: rule.name, freed: 0, error: plan.blocked });
      continue;
    }
    const safePlan: ScanPlan = {
      ...plan,
      targets: await guarded(plan.targets, rule, ctx),
      truncate: await guarded(plan.truncate ?? [], rule, ctx),
    };
    try {
      await applyPlan(rule, safePlan, ctx, opts);
      // Measures everything scanned, so paths the guard rejected don't count as freed.
      const left = plan.size === undefined ? await sizeOf([...plan.targets, ...(plan.truncate ?? [])]) : 0;
      const ruleFreed = Math.max(0, size - left);
      freed += ruleFreed;
      outcomes.push({ id: rule.id, name: rule.name, freed: ruleFreed });
    } catch (error) {
      outcomes.push({ id: rule.id, name: rule.name, freed: 0, error: (error as Error).message });
    }
  }
  opts.onProgress?.({ done: rules.length, total: rules.length, current: '', freed });
  return outcomes;
}
