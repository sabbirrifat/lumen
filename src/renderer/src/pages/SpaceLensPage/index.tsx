import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import type { DirEntry } from '~shared/types';
import { Sunburst } from '~components/charts/Sunburst';
import { FilesIcon, FolderIcon, PackageIcon, RefreshIcon, RevealIcon, TrashIcon } from '~components/icons';
import { Button } from '~components/ui/Button';
import { IconButton, PageHeader, SizeBar, Spinner } from '~components/ui/Controls';
import { Modal } from '~components/ui/Modal';
import { useLumenEvent } from '~hooks/useLumenEvent';
import { formatBytes } from '~lib/format';
import { sound } from '~lib/sound';
import { useLumen } from '~store';
import { toast } from '~store/toasts';
import styles from './SpaceLensPage.module.css';

const SUB_FOLDERS = 8;

function Lens({ dir, home, refresh, onOpen, onReload }: { dir: string; home: string; refresh: boolean; onOpen: (dir: string) => void; onReload: () => void }) {
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [sub, setSub] = useState<Record<string, DirEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<DirEntry | null>(null);

  useLumenEvent('spaceLens:entry', ({ dir: from, entry }) => {
    if (from === dir && loading) setEntries((prev) => [...prev.filter((e) => e.path !== entry.path), entry].sort((a, b) => b.size - a.size));
  });

  useEffect(() => {
    let cancelled = false;
    void window.lumen.spaceLens(dir, refresh).then(async (list) => {
      if (cancelled) return;
      setEntries(list);
      setLoading(false);
      // Measure the biggest folders one level deeper for the outer ring.
      for (const entry of list.filter((e) => e.isDir && !e.isPackage).slice(0, SUB_FOLDERS)) {
        const children = await window.lumen.spaceLens(entry.path);
        if (cancelled) return;
        setSub((prev) => ({ ...prev, [entry.path]: children }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [dir, refresh]);

  const total = entries.reduce((t, e) => t + e.size, 0);
  const segments = dir === home ? [] : dir.slice(home.length + 1).split('/');
  const parent = dir === home ? undefined : dir.slice(0, dir.lastIndexOf('/'));
  const open = (entry: DirEntry) => {
    if (!entry.isDir || entry.isPackage) return;
    sound.tick();
    onOpen(entry.path);
  };

  const trash = async (entry: DirEntry) => {
    setConfirm(null);
    const result = await window.lumen.trash([entry.path]);
    if (result.trashed.length) {
      sound.whoosh();
      toast(`Moved ${entry.name} to the Trash · ${formatBytes(result.freed)}`, 'success');
      void useLumen.getState().refreshDisk();
      onReload();
    } else {
      sound.error();
      toast(result.failed[0]?.error.replace(/^.*?: /, `${entry.name} `) ?? 'Couldn’t move it to the Trash.', 'error');
    }
  };

  return (
    <>
      <nav className={styles.crumbs}>
        <button type="button" onClick={() => onOpen(home)}>
          Home
        </button>
        {segments.map((segment, i) => (
          <span key={i}>
            <span className={styles.sep}>/</span>
            <button type="button" onClick={() => onOpen(`${home}/${segments.slice(0, i + 1).join('/')}`)}>
              {segment}
            </button>
          </span>
        ))}
        {loading && <Spinner size={13} />}
      </nav>

      <div className={styles.layout}>
        <motion.div className={styles.chart} initial={{ opacity: 0, scale: 0.92, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 22 }}>
          <Sunburst
            name={segments.at(-1) ?? 'Home'}
            entries={entries}
            sub={sub}
            hovered={hovered}
            onHover={setHovered}
            onOpen={open}
            onUp={parent ? () => onOpen(parent) : undefined}
          />
        </motion.div>

        <div className={styles.list}>
          {entries.length === 0 && !loading && <p className={styles.emptyNote}>This folder is empty, or Lumen can’t read it.</p>}
          {entries.slice(0, 80).map((entry) => {
            const Icon = entry.isPackage ? PackageIcon : entry.isDir ? FolderIcon : FilesIcon;
            return (
              <div
                key={entry.path}
                className={`${styles.row} ${hovered === entry.path ? styles.rowHover : ''} ${entry.isDir && !entry.isPackage ? styles.rowOpenable : ''}`}
                onMouseEnter={() => setHovered(entry.path)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => open(entry)}
              >
                <Icon size={16} className={styles.rowIcon} />
                <div className={styles.rowMain}>
                  <span className={styles.rowName}>{entry.name}</span>
                  <SizeBar fraction={total ? entry.size / total : 0} />
                </div>
                <span className={`${styles.rowSize} mono`}>{formatBytes(entry.size)}</span>
                <div className={styles.rowActions}>
                  <IconButton label="Show in Finder" onClick={() => void window.lumen.reveal(entry.path)}>
                    <RevealIcon size={15} />
                  </IconButton>
                  <IconButton label="Move to Trash" tone="danger" onClick={() => setConfirm(entry)}>
                    <TrashIcon size={15} />
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        icon={<TrashIcon size={22} />}
        title={`Move “${confirm?.name}” to the Trash?`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirm && void trash(confirm)}>
              Move to Trash
            </Button>
          </>
        }
      >
        <p>
          {formatBytes(confirm?.size ?? 0)} will move to the Trash. You can put it back from there until you empty the Trash.
        </p>
      </Modal>
    </>
  );
}

export function SpaceLensPage() {
  const home = useLumen((s) => s.platform?.home);
  const [dir, setDir] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const current = dir ?? home;

  return (
    <div className={styles.page}>
      <PageHeader title="Space Lens" subtitle="See what fills your disk. Click a ring to go inside a folder, or the center to go back up.">
        <Button variant="ghost" size="sm" icon={<RefreshIcon size={14} />} onClick={() => setVersion((v) => v + 1)}>
          Rescan
        </Button>
      </PageHeader>
      {current && home ? (
        <Lens
          key={`${current}:${version}`}
          dir={current}
          home={home}
          // Only a Rescan skips the cache; moving between folders reuses earlier measurements.
          refresh={version > 0}
          onOpen={(next) => {
            setVersion(0);
            setDir(next);
          }}
          onReload={() => setVersion((v) => v + 1)}
        />
      ) : (
        <Spinner />
      )}
    </div>
  );
}
