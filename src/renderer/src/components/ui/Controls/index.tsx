import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import styles from './Controls.module.css';

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'review' | 'blocked' | 'safe'; children: ReactNode }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`${styles.toggle} ${on ? styles.toggleOn : ''}`} onClick={() => onChange(!on)}>
      <motion.span className={styles.knob} layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
    </button>
  );
}

export function Slider({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={value}
      aria-label={label}
      className={styles.slider}
      style={{ '--fill': `${value * 100}%` } as React.CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  id: string;
}

export function Segmented<T extends string | number>({ value, options, onChange, id }: SegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={`${styles.segment} ${option.value === value ? styles.segmentActive : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.value === value && <motion.span layoutId={`seg-${id}`} className={styles.segmentPill} transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          <span className={styles.segmentLabel}>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function IconButton({ label, onClick, children, tone }: { label: string; onClick: () => void; children: ReactNode; tone?: 'danger' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`${styles.iconButton} ${tone === 'danger' ? styles.iconDanger : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className={styles.spinner} style={{ width: size, height: size }} aria-hidden />;
}

export function SizeBar({ fraction, color }: { fraction: number; color?: string }) {
  return (
    <span className={styles.bar}>
      <motion.span
        className={styles.barFill}
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(2, Math.min(100, fraction * 100))}%` }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </span>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <motion.div className={styles.empty} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className={styles.emptyIcon}>{icon}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </motion.div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className={styles.header}>
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className={styles.headerActions}>{children}</div>}
    </header>
  );
}
