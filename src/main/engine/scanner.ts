import { MIN_SIZE, type RuleResult, type ScanProgress } from '~shared/types';
import type { EngineContext } from './context';
import { mapLimit } from './fsutil';
import type { CleanupRule, ScanPlan } from './rules';
import { sizesOf, sum } from './size';

export interface PlannedRule {
  rule: CleanupRule;
  plan: ScanPlan;
  size: number;
  sizes: Map<string, number>;
}

const MAX_ITEMS = 40;

const isExcluded = (target: string, ctx: EngineContext) =>
  ctx.excluded.some((dir) => target === dir || target.startsWith(`${dir}/`));

export async function scanRule(rule: CleanupRule, ctx: EngineContext): Promise<PlannedRule> {
  let plan: ScanPlan;
  try {
    plan = await rule.scan(ctx);
  } catch (error) {
    plan = { targets: [], detail: '', blocked: `Couldn’t scan: ${(error as Error).message}` };
  }
  plan = {
    ...plan,
    targets: plan.targets.filter((t) => !isExcluded(t, ctx)),
    truncate: plan.truncate?.filter((t) => !isExcluded(t, ctx)),
  };
  const sizes = plan.size === undefined ? await sizesOf([...(plan.truncate ?? []), ...plan.targets]) : new Map<string, number>();
  return { rule, plan, sizes, size: plan.size ?? sum(sizes.values()) };
}

/** Scans every rule (three at a time) and reports each one as it finishes. */
export async function scanRules(
  ctx: EngineContext,
  rules: CleanupRule[],
  onProgress?: (progress: ScanProgress) => void,
  onResult?: (result: RuleResult) => void,
): Promise<PlannedRule[]> {
  let done = 0;
  let found = 0;
  return mapLimit(rules, 3, async (rule) => {
    onProgress?.({ done, total: rules.length, current: rule.name, found });
    const planned = await scanRule(rule, ctx);
    done += 1;
    found += planned.plan.blocked ? 0 : planned.size;
    onProgress?.({ done, total: rules.length, current: rule.name, found });
    if (planned.size >= MIN_SIZE) onResult?.(toResult(planned));
    return planned;
  });
}

export function toResult({ rule, plan, size, sizes }: PlannedRule): RuleResult {
  const items = [...sizes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ITEMS)
    .map(([path, itemSize]) => ({ path, size: itemSize }));
  return {
    id: rule.id,
    name: rule.name,
    category: rule.category,
    safety: rule.safety,
    explain: rule.explain,
    detail: plan.detail,
    blocked: plan.blocked,
    size,
    items,
    itemCount: plan.targets.length + (plan.truncate?.length ?? 0),
  };
}
