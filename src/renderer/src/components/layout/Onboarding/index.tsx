import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { LockIcon, ShieldIcon, SparkleIcon } from '~components/icons';
import { LumenMark } from '~components/layout/LumenMark';
import { Button } from '~components/ui/Button';
import { useLumen } from '~store';
import styles from './Onboarding.module.css';

/** First-run welcome: what Lumen does, and the one permission that helps it see everything. */
export function Onboarding() {
  const settings = useLumen((s) => s.settings);
  const platform = useLumen((s) => s.platform);
  const update = useLumen((s) => s.updateSettings);
  const refreshPlatform = useLumen((s) => s.refreshPlatform);
  const [step, setStep] = useState(0);
  const open = settings !== null && !settings.onboarded;

  const finish = () => void update({ onboarded: true });

  return (
    <AnimatePresence>
      {open && (
        <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.4 } }}>
          <motion.div className={styles.card} initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 24 }}>
            <AnimatePresence mode="wait">
              {step === 0 ? (
                <motion.div key="welcome" className={styles.step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                  <div className={styles.mark}>
                    <LumenMark size={72} />
                  </div>
                  <h1>Welcome to Lumen</h1>
                  <p>A calm, thorough cleaner that knows where macOS, your apps and your tools hide their junk.</p>
                  <ul className={styles.points}>
                    <li>
                      <SparkleIcon size={16} /> Smart Scan checks 50+ places: caches, old downloads, iPhone backups and more
                    </li>
                    <li>
                      <ShieldIcon size={16} /> Only offers what’s safe; anything personal is off-limits
                    </li>
                  </ul>
                  <Button size="lg" onClick={() => setStep(1)}>
                    Continue
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="access" className={styles.step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}>
                  <div className={styles.lock}>
                    <LockIcon size={32} />
                  </div>
                  <h1>Let Lumen see everything</h1>
                  <p>
                    With Full Disk Access, Lumen can also measure the Trash and app containers. Open System Settings, turn on Lumen under Full Disk Access,
                    then come back. You can skip this and do it later in Settings.
                  </p>
                  {platform?.fullDiskAccess && <p className={styles.granted}>Full Disk Access is on. You’re all set.</p>}
                  <div className={styles.actions}>
                    {!platform?.fullDiskAccess && (
                      <Button
                        size="lg"
                        onClick={() => {
                          void window.lumen.openFullDiskAccess();
                          window.addEventListener('focus', () => void refreshPlatform(), { once: true });
                        }}
                      >
                        Open System Settings
                      </Button>
                    )}
                    <Button variant={platform?.fullDiskAccess ? 'primary' : 'ghost'} size="lg" onClick={finish}>
                      {platform?.fullDiskAccess ? 'Start using Lumen' : 'Skip for now'}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
