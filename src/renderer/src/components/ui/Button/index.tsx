import { type HTMLMotionProps, motion } from 'motion/react';
import type { ReactNode } from 'react';
import styles from './Button.module.css';

type Props = Omit<HTMLMotionProps<'button'>, 'children'> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  children?: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', icon, children, className, disabled, ...rest }: Props) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={[styles.button, styles[variant], styles[size], className].filter(Boolean).join(' ')}
      disabled={disabled}
      {...rest}
    >
      {icon}
      {children !== undefined && <span>{children}</span>}
    </motion.button>
  );
}
