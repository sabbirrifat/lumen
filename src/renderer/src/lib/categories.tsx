import type { ComponentType } from 'react';
import type { RuleCategory } from '~shared/types';
import { ChipIcon, CodeIcon, HammerIcon, type IconProps, OrbitIcon, WindowIcon } from '~components/icons';

export interface CategoryInfo {
  id: RuleCategory;
  label: string;
  blurb: string;
  color: string;
  Icon: ComponentType<IconProps>;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'developer', label: 'Developer tools', blurb: 'Package caches, old toolchains, logs', color: 'var(--cat-developer)', Icon: CodeIcon },
  { id: 'xcode', label: 'Xcode & simulators', blurb: 'Build data and simulator devices', color: 'var(--cat-xcode)', Icon: HammerIcon },
  { id: 'apps', label: 'App caches', blurb: 'Browsers, editors and chat apps', color: 'var(--cat-apps)', Icon: WindowIcon },
  { id: 'system', label: 'System junk', blurb: 'App caches, logs, crash reports', color: 'var(--cat-system)', Icon: ChipIcon },
  { id: 'ai', label: 'AI tools', blurb: 'Downloaded models and agent data', color: 'var(--cat-ai)', Icon: OrbitIcon },
];

export const categoryInfo = (id: RuleCategory) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
