import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { HistoryEntry } from '~shared/types';
import { AppsIcon, BroomIcon, ClockIcon, TrashIcon } from '~components/icons';
import { BigBytes } from '~components/ui/BigBytes';
import { EmptyState, PageHeader, Spinner } from '~components/ui/Controls';
import { formatBytes, formatDate, plural } from '~lib/format';
import styles from './HistoryPage.module.css';

const KIND = {
  cleanup: { label: 'Cleanup', Icon: BroomIcon },
  trash: { label: 'Moved to Trash', Icon: TrashIcon },
  uninstall: { label: 'Uninstalled', Icon: AppsIcon },
};

export function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void window.lumen.history().then((list) => !cancelled && setEntries(list));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = (entries ?? []).reduce((t, e) => t + e.freed, 0);

  return (
    <div className={styles.page}>
      <PageHeader title="History" subtitle="Everything Lumen has cleaned, trashed or uninstalled." />
      {entries === null ? (
        <Spinner />
      ) : entries.length === 0 ? (
        <EmptyState icon={<ClockIcon size={26} />} title="Nothing yet">
          Your cleanups will be listed here.
        </EmptyState>
      ) : (
        <>
          <div className={styles.hero}>
            <span className={styles.heroLabel}>Freed with Lumen</span>
            <BigBytes bytes={total} className={styles.heroNumber} />
            <span className={styles.heroMeta}>across {plural(entries.length, 'cleanup')}</span>
          </div>
          <ul className={styles.list}>
            {entries.map((entry, i) => {
              const { label, Icon } = KIND[entry.kind];
              return (
                <motion.li key={`${entry.at}-${i}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 20) * 0.03 }}>
                  <span className={styles.icon}>
                    <Icon size={16} />
                  </span>
                  <div className={styles.main}>
                    <span className={styles.kind}>{label}</span>
                    <span className={styles.label}>{entry.label}</span>
                  </div>
                  <span className={styles.date}>{formatDate(entry.at)}</span>
                  <span className={`${styles.freed} mono`}>{formatBytes(entry.freed)}</span>
                </motion.li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
