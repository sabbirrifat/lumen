import { aiRules } from './ai';
import { appRules } from './apps';
import { developerRules } from './developer';
import { appCachesRule, systemRules } from './system';
import type { CleanupRule } from './types';
import { xcodeRules } from './xcode';

const specific = [...developerRules, ...xcodeRules, ...appRules, ...systemRules, ...aiRules];

/** Every cleanup rule. The catch-all cache rule skips folders a specific rule already covers. */
export const RULES: CleanupRule[] = [...specific, appCachesRule(specific)];

export type { CleanupRule, ScanPlan } from './types';
