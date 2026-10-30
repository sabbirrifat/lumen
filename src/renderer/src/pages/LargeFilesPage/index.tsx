import { AnimatePresence, motion } from 'motion/react';
import { type ComponentType, useMemo, useState } from 'react';
import type { FileInfo, FileKind, LargeFilesProgress } from '~shared/types';
import {
  ArchiveIcon,
  DiscIcon,
  EyeIcon,
  FilesIcon,
  type IconProps,
  ImageIcon,
  MusicIcon,
  PackageIcon,
  RevealIcon,
  SearchIcon,
  TrashIcon,
  VideoIcon,
} from '~components/icons';
import { Button } from '~components/ui/Button';
import { Checkbox } from '~components/ui/Checkbox';
import { EmptyState, IconButton, PageHeader, Segmented, Spinner } from '~components/ui/Controls';
import { Modal } from '~components/ui/Modal';
import { useLumenEvent } from '~hooks/useLumenEvent';
import { formatBytes, plural, timeAgo, tildePath } from '~lib/format';
import { sound } from '~lib/sound';
import { useLumen } from '~store';
import { toast } from '~store/toasts';
import styles from './LargeFilesPage.module.css';

const MB = 1000 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const SHOWN = 300;

const KIND_ICONS: Record<FileKind, ComponentType<IconProps>> = {
  video: VideoIcon,
  audio: MusicIcon,
  image: ImageIcon,
  archive: ArchiveIcon,
  'disk-image': DiscIcon,
  installer: PackageIcon,
  document: FilesIcon,
  other: FilesIcon,
};

const KIND_FILTERS: { value: FileKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Videos' },
  { value: 'disk-image', label: 'Disk images' },
  { value: 'archive', label: 'Archives' },
  { value: 'installer', label: 'Installers' },
  { value: 'other', label: 'Other' },
];

type Status = 'idle' | 'scanning' | 'done';

export function LargeFilesPage() {
  const home = useLumen((s) => s.platform?.home);
  const [status, setStatus] = useState<Status>('idle');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [progress, setProgress] = useState<LargeFilesProgress | null>(null);
  const [minSize, setMinSize] = useState(100 * MB);
  /** The threshold of the last scan; a lower one needs a new scan. */
  const [scannedSize, setScannedSize] = useState(Infinity);
  /** When the last scan finished; "unused for N months" is measured from here. */
  const [scannedAt, setScannedAt] = useState(0);
  const [age, setAge] = useState(0);
  const [kind, setKind] = useState<FileKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  useLumenEvent('largeFiles:progress', setProgress);

  const scan = async (size = minSize) => {
    setStatus('scanning');
    setProgress(null);
    setSelected(new Set());
    setScannedSize(size);
    sound.scanStart();
    const found = await window.lumen.largeFiles(size);
    setScannedAt(Date.now());
    setFiles(found);
    setStatus('done');
    sound.found();
  };

  const visible = useMemo(() => {
    const cutoff = age ? scannedAt - age * DAY : Infinity;
    const q = query.trim().toLowerCase();
    return files.filter(
      (f) =>
        f.size >= minSize &&
        Math.max(f.accessed, f.modified) <= cutoff &&
        (kind === 'all' || f.kind === kind || (kind === 'other' && ['other', 'document', 'audio', 'image'].includes(f.kind))) &&
        (!q || f.name.toLowerCase().includes(q)),
    );
  }, [files, minSize, age, kind, query, scannedAt]);

  const chosen = files.filter((f) => selected.has(f.path));
  const chosenSize = chosen.reduce((t, f) => t + f.size, 0);

  const toggle = (path: string) => {
    const next = new Set(selected);
    const on = !next.has(path);
    if (on) next.add(path);
    else next.delete(path);
    sound.toggle(on);
    setSelected(next);
  };

  const trash = async () => {
    setConfirming(false);
    const result = await window.lumen.trash(chosen.map((f) => f.path));
    const gone = new Set(result.trashed);
    setFiles((prev) => prev.filter((f) => !gone.has(f.path)));
    setSelected(new Set());
    if (result.trashed.length) {
      sound.whoosh();
      toast(`Moved ${plural(result.trashed.length, 'file')} to the Trash · ${formatBytes(result.freed)}`, 'success');
      void useLumen.getState().refreshDisk();
    }
    if (result.failed.length) toast(`${plural(result.failed.length, 'file')} couldn’t be moved`, 'error');
  };

  return (
    <div className={styles.page}>
      <PageHeader title="Large & Old Files" subtitle="Big files in your home folder, biggest first. Anything you remove goes to the Trash.">
        {status === 'done' && (
          <Button variant="ghost" size="sm" onClick={() => void scan()}>
            Scan again
          </Button>
        )}
      </PageHeader>

      <div className={styles.filters}>
        <Segmented
          id="min"
          value={minSize}
          onChange={(v) => {
            setMinSize(v);
            if (status === 'done' && v < scannedSize) void scan(v);
          }}
          options={[
            { value: 50 * MB, label: '50 MB+' },
            { value: 100 * MB, label: '100 MB+' },
            { value: 500 * MB, label: '500 MB+' },
            { value: 1000 * MB, label: '1 GB+' },
          ]}
        />
        <Segmented
          id="age"
          value={age}
          onChange={setAge}
          options={[
            { value: 0, label: 'Any age' },
            { value: 180, label: 'Unused 6 mo' },
            { value: 365, label: 'Unused 1 yr' },
          ]}
        />
        <Segmented id="kind" value={kind} onChange={setKind} options={KIND_FILTERS} />
        <label className={styles.search}>
          <SearchIcon size={15} />
          <input placeholder="Filter by name" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      {status === 'idle' && (
        <EmptyState
          icon={<FilesIcon size={26} />}
          title="Find what’s taking up room"
          action={
            <Button icon={<SearchIcon size={16} />} onClick={() => void scan()}>
              Find large files
            </Button>
          }
        >
          Lumen looks through your home folder, skipping Library, hidden folders and app bundles.
        </EmptyState>
      )}

      {status === 'scanning' && (
        <div className={styles.scanning}>
          <Spinner size={22} />
          <div>
            <div>Looking for large files… {progress ? plural(progress.found, 'file') : ''} so far</div>
            <div className={styles.scanPath}>{progress ? tildePath(progress.current, home) : ''}</div>
          </div>
          <Button variant="subtle" size="sm" onClick={() => void window.lumen.cancelLargeFiles()}>
            Stop
          </Button>
        </div>
      )}

      {status === 'done' && visible.length === 0 && (
        <EmptyState icon={<FilesIcon size={26} />} title="Nothing matches these filters">
          Try a smaller size or a different kind.
        </EmptyState>
      )}

      {status === 'done' && visible.length > 0 && (
        <div className={styles.list}>
          {visible.slice(0, SHOWN).map((file, i) => {
            const Icon = KIND_ICONS[file.kind];
            const checked = selected.has(file.path);
            return (
              <motion.div
                key={file.path}
                className={`${styles.row} ${checked ? styles.rowChecked : ''}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 20) * 0.02 }}
                onClick={() => toggle(file.path)}
              >
                <Checkbox checked={checked} onChange={() => toggle(file.path)} label={`Select ${file.name}`} />
                <span className={styles.kind}>
                  <Icon size={17} />
                </span>
                <div className={styles.main}>
                  <span className={styles.name}>{file.name}</span>
                  <span className={styles.where}>{tildePath(file.path.slice(0, file.path.lastIndexOf('/')), home)}</span>
                </div>
                <span className={styles.when}>opened {timeAgo(Math.max(file.accessed, file.modified))}</span>
                <span className={`${styles.size} mono`}>{formatBytes(file.size)}</span>
                <div className={styles.actions}>
                  <IconButton label="Quick Look" onClick={() => void window.lumen.preview(file.path)}>
                    <EyeIcon size={15} />
                  </IconButton>
                  <IconButton label="Show in Finder" onClick={() => void window.lumen.reveal(file.path)}>
                    <RevealIcon size={15} />
                  </IconButton>
                </div>
              </motion.div>
            );
          })}
          {visible.length > SHOWN && <p className={styles.more}>Showing the {SHOWN} largest of {visible.length}.</p>}
        </div>
      )}

      <AnimatePresence>
        {chosen.length > 0 && (
          <motion.div className={styles.footer} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
            <div>
              <div className={styles.footerSize}>{formatBytes(chosenSize)}</div>
              <div className={styles.footerMeta}>{plural(chosen.length, 'file')} selected</div>
            </div>
            <Button variant="danger" size="lg" icon={<TrashIcon size={18} />} onClick={() => setConfirming(true)}>
              Move to Trash
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        icon={<TrashIcon size={22} />}
        title={`Move ${plural(chosen.length, 'file')} to the Trash?`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void trash()}>
              Move to Trash
            </Button>
          </>
        }
      >
        <p>{formatBytes(chosenSize)} will move to the Trash. You can put files back from there until you empty it.</p>
      </Modal>
    </div>
  );
}
