import type { ComponentType } from 'react';
import type { RuleCategory } from '~shared/types';
import { ChipIcon, CodeIcon, DownloadIcon, type IconProps, OrbitIcon, PhoneIcon, WindowIcon } from '~components/icons';

export interface CategoryInfo {
  id: RuleCategory;
  label: string;
  /** Fits the narrow category cards on Smart Scan. */
  short: string;
  color: string;
  Icon: ComponentType<IconProps>;
}

/** In display order: everyday categories first, then the ones for developers. */
export const CATEGORIES: CategoryInfo[] = [
  { id: 'system', label: 'System junk', short: 'System junk', color: 'var(--cat-system)', Icon: ChipIcon },
  { id: 'apps', label: 'Browsers & apps', short: 'Apps', color: 'var(--cat-apps)', Icon: WindowIcon },
  { id: 'files', label: 'Downloads & Trash', short: 'Downloads', color: 'var(--cat-files)', Icon: DownloadIcon },
  { id: 'devices', label: 'iPhone & iPad', short: 'iPhone & iPad', color: 'var(--cat-devices)', Icon: PhoneIcon },
  { id: 'developer', label: 'Developer tools', short: 'Developer', color: 'var(--cat-developer)', Icon: CodeIcon },
  { id: 'ai', label: 'AI tools', short: 'AI tools', color: 'var(--cat-ai)', Icon: OrbitIcon },
];

export const categoryInfo = (id: RuleCategory) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
