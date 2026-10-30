import type { RuleCategory, Safety } from '~shared/types';
import type { EngineContext } from '../context';

export interface ScanPlan {
  /** Paths to delete. */
  targets: string[];
  /** Files to empty in place (logs a running server keeps open). */
  truncate?: string[];
  /** Why this can't be cleaned right now. */
  blocked?: string;
  detail: string;
  /** Set when the size comes from a tool (docker) instead of measuring targets. */
  size?: number;
}

export interface CleanupRule {
  id: string;
  name: string;
  category: RuleCategory;
  safety: Safety;
  explain: string;
  /** Folders this rule may delete inside. The guard rejects any target outside them. */
  roots(ctx: EngineContext): string[];
  scan(ctx: EngineContext): Promise<ScanPlan>;
  /** Custom cleanup. By default `truncate` files are emptied and `targets` deleted. */
  clean?(plan: ScanPlan, ctx: EngineContext): Promise<void>;
  allowNodeModules?: boolean;
}
