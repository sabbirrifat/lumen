import { LockIcon } from '~components/icons';
import { Button } from '~components/ui/Button';
import { useLumen } from '~store';
import styles from './AccessNotice.module.css';

/** Shown until Lumen has Full Disk Access, which several rules need to see anything at all. */
export function AccessNotice() {
  const platform = useLumen((s) => s.platform);
  const refresh = useLumen((s) => s.refreshPlatform);
  if (!platform || platform.fullDiskAccess) return null;
  return (
    <div className={styles.notice}>
      <LockIcon size={16} className={styles.icon} />
      <span>
        macOS keeps Safari, Mail, iPhone backups and the Trash private. To include them, turn on Full Disk Access for Lumen, then reopen it.
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          void window.lumen.openFullDiskAccess();
          window.addEventListener('focus', () => void refresh(), { once: true });
        }}
      >
        Open Settings
      </Button>
    </div>
  );
}
