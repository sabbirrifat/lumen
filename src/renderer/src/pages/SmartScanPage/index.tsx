import { AnimatePresence, motion } from 'motion/react';
import { BroomIcon, ClockIcon, RefreshIcon, SparkleIcon } from '~components/icons';
import { Orb } from '~components/three/Orb';
import { BigBytes } from '~components/ui/BigBytes';
import { Button } from '~components/ui/Button';
import { ProgressRing } from '~components/ui/ProgressRing';
import { CATEGORIES } from '~lib/categories';
import { formatBytes, plural } from '~lib/format';
import { selectedSize, useLumen } from '~store';
import styles from './SmartScanPage.module.css';

const fade = {
  initial: { opacity: 0, y: 14, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(6px)' },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

export function SmartScanPage() {
  const phase = useLumen((s) => s.phase);
  const results = useLumen((s) => s.results);
  const selected = useLumen((s) => s.selected);
  const scanProgress = useLumen((s) => s.scanProgress);
  const cleanProgress = useLumen((s) => s.cleanProgress);
  const summary = useLumen((s) => s.summary);
  const { scan, clean, reset, go } = useLumen.getState();

  const scanFraction = scanProgress ? scanProgress.done / Math.max(1, scanProgress.total) : 0;
  const cleanFraction = cleanProgress ? cleanProgress.done / Math.max(1, cleanProgress.total) : 0;
  const ready = selectedSize(results, selected);
  const total = results.filter((r) => !r.blocked).reduce((t, r) => t + r.size, 0);
  const showRing = phase === 'scanning' || phase === 'cleaning';

  return (
    <div className={styles.page}>
      <div className={styles.stage}>
        <div className={styles.orb}>
          <Orb phase={phase} progress={scanFraction} />
          <AnimatePresence>
            {showRing && (
              <motion.div className={styles.ring} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}>
                <ProgressRing size={330} thickness={2.5} progress={phase === 'scanning' ? scanFraction : cleanFraction} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.copy}>
          <AnimatePresence mode="wait">
            {phase === 'idle' && (
              <motion.div key="idle" {...fade}>
                <p className={styles.overline}>Smart Scan</p>
                <h1 className={styles.title}>Clear the clutter, keep the calm.</h1>
                <p className={styles.lede}>
                  Lumen checks 30+ places where developer tools, apps and macOS pile up junk, and only offers what’s safe to remove.
                </p>
              </motion.div>
            )}
            {phase === 'scanning' && (
              <motion.div key="scanning" {...fade}>
                <p className={styles.overline}>Scanning</p>
                <BigBytes bytes={scanProgress?.found ?? 0} className={styles.number} />
                <p className={styles.lede}>
                  found so far · looking at <span className={styles.current}>{scanProgress?.current ?? 'your Mac'}</span>
                </p>
              </motion.div>
            )}
            {phase === 'results' && (
              <motion.div key="results" {...fade}>
                <p className={styles.overline}>Ready to clean</p>
                <BigBytes bytes={ready} className={styles.number} />
                <p className={styles.lede}>
                  selected from {formatBytes(total)} Lumen found in {plural(results.length, 'place')}. Items marked Review wait for you in Cleanup.
                </p>
              </motion.div>
            )}
            {phase === 'cleaning' && (
              <motion.div key="cleaning" {...fade}>
                <p className={styles.overline}>Cleaning</p>
                <BigBytes bytes={cleanProgress?.freed ?? 0} className={styles.number} />
                <p className={styles.lede}>
                  freed · <span className={styles.current}>{cleanProgress?.current || 'finishing up'}</span>
                </p>
              </motion.div>
            )}
            {phase === 'done' && summary && (
              <motion.div key="done" {...fade}>
                <p className={styles.overline}>All clear</p>
                <BigBytes bytes={summary.freed} className={styles.number} />
                <p className={styles.lede}>
                  freed. You now have {formatBytes(summary.freeAfter)} free, up from {formatBytes(summary.freeBefore)}.
                </p>
                {summary.outcomes
                  .filter((o) => o.error)
                  .slice(0, 2)
                  .map((o) => (
                    <p key={o.id} className={styles.skipped}>
                      Skipped {o.name}: {o.error}
                    </p>
                  ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className={styles.actions}>
          {phase === 'idle' && (
            <Button size="lg" icon={<SparkleIcon size={18} />} onClick={() => void scan()}>
              Start Smart Scan
            </Button>
          )}
          {phase === 'scanning' && scanProgress && (
            <span className={styles.status}>
              {scanProgress.done} of {scanProgress.total} checks done
            </span>
          )}
          {phase === 'results' && (
            <>
              <Button size="lg" icon={<BroomIcon size={18} />} disabled={ready === 0} onClick={() => void clean()}>
                Clean {formatBytes(ready)}
              </Button>
              <Button variant="ghost" size="lg" onClick={() => go('cleanup')}>
                Review items
              </Button>
            </>
          )}
          {phase === 'done' && (
            <>
              <Button size="lg" icon={<RefreshIcon size={18} />} onClick={() => void scan()}>
                Scan again
              </Button>
              <Button variant="ghost" size="lg" icon={<ClockIcon size={18} />} onClick={() => go('history')}>
                History
              </Button>
              <Button variant="subtle" onClick={reset}>
                Done
              </Button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(phase === 'scanning' || phase === 'results') && (
          <motion.div className={styles.categories} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            {CATEGORIES.map((cat, i) => {
              const rules = results.filter((r) => r.category === cat.id);
              const size = rules.filter((r) => !r.blocked).reduce((t, r) => t + r.size, 0);
              return (
                <motion.button
                  key={cat.id}
                  type="button"
                  className={styles.card}
                  style={{ '--accent': cat.color } as React.CSSProperties}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.08 * i, type: 'spring', stiffness: 260, damping: 26 }}
                  whileHover={{ y: -4 }}
                  onClick={() => go('cleanup')}
                >
                  <span className={styles.cardIcon}>
                    <cat.Icon size={18} />
                  </span>
                  <span className={styles.cardLabel}>{cat.label}</span>
                  <span className={styles.cardSize}>{size ? formatBytes(size) : '—'}</span>
                  <span className={styles.cardMeta}>{rules.length ? plural(rules.length, 'item') : cat.blurb}</span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
