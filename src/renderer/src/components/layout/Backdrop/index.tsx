import styles from './Backdrop.module.css';

/** Slow-drifting aurora light behind everything, plus the window's drag strip. */
export function Backdrop() {
  return (
    <>
      <div className={styles.backdrop} aria-hidden>
        <span className={`${styles.blob} ${styles.one}`} />
        <span className={`${styles.blob} ${styles.two}`} />
        <span className={`${styles.blob} ${styles.three}`} />
        <span className={styles.grain} />
      </div>
      <div className={styles.dragRegion} aria-hidden />
    </>
  );
}
