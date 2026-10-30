import { describe, it } from 'vitest';
import { createContext } from '~engine/context';
import { RULES } from '~engine/rules';
import { scanRules } from '~engine/scanner';

/**
 * Scans your real home folder and prints what each rule would free. Read-only: nothing is
 * cleaned. Run with: npm run dry-run (add LUMEN_DRY_RUN_RULE=<id> to list one rule's items).
 */
describe.runIf(process.env.LUMEN_DRY_RUN)('dry run on this Mac', () => {
  it('reports what each rule would free', async () => {
    const ctx = await createContext();
    const planned = await scanRules(ctx, RULES);
    const rows = planned
      .filter((p) => p.size > 0 || p.plan.blocked)
      .sort((a, b) => b.size - a.size)
      .map((p) => ({
        rule: p.rule.id,
        safety: p.rule.safety,
        GB: +(p.size / 1e9).toFixed(2),
        blocked: p.plan.blocked ?? '',
      }));
    console.table(rows);
    const safe = planned.filter((p) => p.rule.safety === 'safe' && !p.plan.blocked).reduce((t, p) => t + p.size, 0);
    const all = planned.filter((p) => !p.plan.blocked).reduce((t, p) => t + p.size, 0);
    console.log(`Safe: ${(safe / 1e9).toFixed(2)} GB · everything: ${(all / 1e9).toFixed(2)} GB`);

    const focus = planned.find((p) => p.rule.id === process.env.LUMEN_DRY_RUN_RULE);
    if (focus) {
      console.log(`\n${focus.rule.id}: ${focus.plan.targets.length} items`);
      for (const target of focus.plan.targets) {
        console.log(`  ${((focus.sizes.get(target) ?? 0) / 1e6).toFixed(1).padStart(8)} MB  ${focus.plan.labels?.[target] ?? target}`);
      }
    }
  }, 600_000);
});
