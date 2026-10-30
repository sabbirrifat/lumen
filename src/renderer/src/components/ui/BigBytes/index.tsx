import { splitBytes } from '~lib/format';
import { CountUp } from '../CountUp';
import styles from './BigBytes.module.css';

/** A large animated size, e.g. "84.2 GB", with the unit set smaller. */
export function BigBytes({ bytes, className }: { bytes: number; className?: string }) {
  return (
    <CountUp value={bytes}>
      {(v) => {
        const { value, unit } = splitBytes(v);
        return (
          <span className={`${styles.big} ${className ?? ''}`}>
            {value}
            <span className={styles.unit}>{unit}</span>
          </span>
        );
      }}
    </CountUp>
  );
}
