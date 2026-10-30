import { motion } from 'motion/react';
import type { ComponentType } from 'react';
import { AppsIcon, BroomIcon, ClockIcon, FilesIcon, GearIcon, type IconProps, LensIcon, SparkleIcon } from '~components/icons';
import { LumenMark } from '~components/layout/LumenMark';
import { formatBytes } from '~lib/format';
import { type Page, selectedSize, useLumen } from '~store';
import styles from './Sidebar.module.css';

const MAIN: { page: Page; label: string; Icon: ComponentType<IconProps> }[] = [
  { page: 'scan', label: 'Smart Scan', Icon: SparkleIcon },
  { page: 'cleanup', label: 'Cleanup', Icon: BroomIcon },
  { page: 'space', label: 'Space Lens', Icon: LensIcon },
  { page: 'large', label: 'Large & Old Files', Icon: FilesIcon },
  { page: 'uninstall', label: 'Uninstaller', Icon: AppsIcon },
];

const FOOTER: typeof MAIN = [
  { page: 'history', label: 'History', Icon: ClockIcon },
  { page: 'settings', label: 'Settings', Icon: GearIcon },
];

export function Sidebar() {
  const page = useLumen((s) => s.page);
  const go = useLumen((s) => s.go);
  const disk = useLumen((s) => s.disk);
  const pending = useLumen((s) => (s.phase === 'results' ? selectedSize(s.results, s.selected) : 0));

  const item = ({ page: target, label, Icon }: (typeof MAIN)[number]) => (
    <button key={target} type="button" className={`${styles.item} ${page === target ? styles.active : ''}`} onClick={() => go(target)}>
      {page === target && <motion.span layoutId="nav-active" className={styles.activeBg} transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <Icon size={18} className={styles.icon} />
      <span className={styles.label}>{label}</span>
      {target === 'cleanup' && pending > 0 && <span className={styles.pill}>{formatBytes(pending)}</span>}
    </button>
  );

  const used = disk ? 1 - disk.free / disk.total : 0;
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <LumenMark size={26} />
        <span>Lumen</span>
      </div>
      <nav className={styles.nav}>{MAIN.map(item)}</nav>
      <div className={styles.spacer} />
      <nav className={styles.nav}>{FOOTER.map(item)}</nav>
      {disk && (
        <div className={styles.disk}>
          <div className={styles.diskRow}>
            <span>Macintosh HD</span>
            <span className="mono">{Math.round(used * 100)}%</span>
          </div>
          <div className={styles.diskBar}>
            <motion.div className={styles.diskFill} initial={{ width: 0 }} animate={{ width: `${used * 100}%` }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <div className={styles.diskFree}>
            {formatBytes(disk.free)} free of {formatBytes(disk.total)}
          </div>
        </div>
      )}
    </aside>
  );
}
