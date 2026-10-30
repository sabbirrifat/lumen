import { aiRules } from './ai';
import { appRules } from './apps';
import { developerRules } from './developer';
import { deviceRules } from './devices';
import { fileRules } from './files';
import { appCachesRule, systemRules } from './system';
import type { CleanupRule } from './types';
import { xcodeRules } from './xcode';

const specific = [...systemRules, ...appRules, ...fileRules, ...deviceRules, ...developerRules, ...xcodeRules, ...aiRules];

/** Every cleanup rule. The catch-all cache rule skips folders a specific rule already covers. */
export const RULES: CleanupRule[] = [...specific, appCachesRule(specific)];

export type { CleanupRule, ScanPlan } from './types';
