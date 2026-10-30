import type { ReactNode } from 'react';
import { FolderIcon, LockIcon, PlusIcon, ShieldIcon, SpeakerIcon, TrashIcon, XIcon } from '~components/icons';
import { LumenMark } from '~components/layout/LumenMark';
import { Button } from '~components/ui/Button';
import { Badge, IconButton, PageHeader, Slider, Toggle } from '~components/ui/Controls';
import { tildePath } from '~lib/format';
import { sound } from '~lib/sound';
import { useLumen } from '~store';
import styles from './SettingsPage.module.css';

function Row({ icon, title, children, control }: { icon: ReactNode; title: string; children?: ReactNode; control?: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowIcon}>{icon}</span>
      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        {children && <span className={styles.rowHint}>{children}</span>}
      </div>
      {control}
    </div>
  );
}

export function SettingsPage() {
  const settings = useLumen((s) => s.settings);
  const platform = useLumen((s) => s.platform);
  const update = useLumen((s) => s.updateSettings);
  const refreshPlatform = useLumen((s) => s.refreshPlatform);
  if (!settings) return null;

  const addExcluded = async () => {
    const folder = await window.lumen.chooseFolder();
    if (folder && !settings.excluded.includes(folder)) await update({ excluded: [...settings.excluded, folder] });
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Settings" />

      <section className={styles.card}>
        <h2>Sound</h2>
        <Row icon={<SpeakerIcon size={17} />} title="Sound effects" control={<Toggle label="Sound effects" on={settings.sound} onChange={(on) => void update({ sound: on }).then(() => sound.toggle(on))} />}>
          Soft chimes and an ambient pad while Lumen works.
        </Row>
        <Row
          icon={<SpeakerIcon size={17} />}
          title="Volume"
          control={
            <Slider
              label="Volume"
              value={settings.volume}
              onChange={(volume) => {
                void update({ volume }).then(() => sound.tick());
              }}
            />
          }
        />
      </section>

      <section className={styles.card}>
        <h2>Cleaning</h2>
        <Row
          icon={<TrashIcon size={17} />}
          title="Move cleaned caches to the Trash"
          control={<Toggle label="Move cleaned caches to the Trash" on={settings.cachesToTrash} onChange={(on) => void update({ cachesToTrash: on })} />}
        >
          Off: caches are deleted right away, which frees space immediately. On: you can restore them from the Trash.
        </Row>
        <Row icon={<FolderIcon size={17} />} title="Never touch these folders" control={<Button variant="ghost" size="sm" icon={<PlusIcon size={14} />} onClick={() => void addExcluded()}>Add folder</Button>}>
          Lumen skips anything inside them in every feature.
        </Row>
        {settings.excluded.length > 0 && (
          <ul className={styles.excluded}>
            {settings.excluded.map((dir) => (
              <li key={dir}>
                <FolderIcon size={14} />
                <span>{tildePath(dir, platform?.home)}</span>
                <IconButton label="Remove" onClick={() => void update({ excluded: settings.excluded.filter((d) => d !== dir) })}>
                  <XIcon size={14} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card}>
        <h2>Privacy</h2>
        <Row
          icon={<LockIcon size={17} />}
          title="Full Disk Access"
          control={
            <div className={styles.inline}>
              {platform?.fullDiskAccess ? <Badge tone="safe">Granted</Badge> : <Badge tone="review">Not granted</Badge>}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void window.lumen.openFullDiskAccess();
                  window.addEventListener('focus', () => void refreshPlatform(), { once: true });
                }}
              >
                Open System Settings
              </Button>
            </div>
          }
        >
          Lets Lumen measure the Trash and app containers. Add Lumen in System Settings, then come back.
        </Row>
        <Row icon={<ShieldIcon size={17} />} title="Everything stays on this Mac">
          Lumen makes no network requests. Personal folders like Documents, Photos and Mail are never cleaned.
        </Row>
      </section>

      <div className={styles.about}>
        <LumenMark size={28} />
        <div>
          <div className={styles.aboutName}>Lumen {platform?.version}</div>
          <div className={styles.rowHint}>A calm, thorough cleaner for your Mac.</div>
        </div>
      </div>
    </div>
  );
}
