import { AnimatePresence, motion } from 'motion/react';
import { useToasts } from '~store/toasts';
import styles from './Toaster.module.css';

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div className={styles.stack} aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            type="button"
            layout
            className={`${styles.toast} ${styles[t.tone]}`}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={() => dismiss(t.id)}
          >
            <span className={styles.dot} />
            {t.text}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
