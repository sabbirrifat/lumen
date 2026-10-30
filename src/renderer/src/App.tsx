import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { Backdrop } from '~components/layout/Backdrop';
import { Onboarding } from '~components/layout/Onboarding';
import { Sidebar } from '~components/layout/Sidebar';
import { Toaster } from '~components/layout/Toaster';
import { CleanupPage } from '~pages/CleanupPage';
import { HistoryPage } from '~pages/HistoryPage';
import { LargeFilesPage } from '~pages/LargeFilesPage';
import { SettingsPage } from '~pages/SettingsPage';
import { SmartScanPage } from '~pages/SmartScanPage';
import { SpaceLensPage } from '~pages/SpaceLensPage';
import { UninstallerPage } from '~pages/UninstallerPage';
import { type Page, useLumen } from '~store';
import styles from './App.module.css';

const PAGES: Record<Page, () => React.JSX.Element | null> = {
  scan: SmartScanPage,
  cleanup: CleanupPage,
  space: SpaceLensPage,
  large: LargeFilesPage,
  uninstall: UninstallerPage,
  history: HistoryPage,
  settings: SettingsPage,
};

export function App() {
  const page = useLumen((s) => s.page);
  const boot = useLumen((s) => s.boot);
  useEffect(() => boot(), [boot]);
  const Current = PAGES[page];

  return (
    <div className={styles.shell}>
      <Backdrop />
      <Sidebar />
      <main className={styles.main}>
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            className={styles.page}
            initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
            // A leftover filter would isolate the page and stop the orb's glow blending with the backdrop.
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
            exit={{ opacity: 0, y: -8, filter: 'blur(8px)' }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <Current />
          </motion.div>
        </AnimatePresence>
      </main>
      <Toaster />
      <Onboarding />
    </div>
  );
}
