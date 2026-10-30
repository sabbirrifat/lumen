import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useEffect } from 'react';
import styles from './Modal.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
}

export function Modal({ open, onClose, title, children, actions, icon }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className={styles.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className={styles.card}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {icon && <div className={styles.icon}>{icon}</div>}
            <h2>{title}</h2>
            {children && <div className={styles.body}>{children}</div>}
            {actions && <div className={styles.actions}>{actions}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
