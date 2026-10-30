import { motion } from 'motion/react';
import styles from './Checkbox.module.css';

interface Props {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}

export function Checkbox({ checked, onChange, disabled, label }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`${styles.box} ${checked ? styles.checked : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
    </button>
  );
}
