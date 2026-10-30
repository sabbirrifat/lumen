import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import type { AppInfo, Leftover } from '~shared/types';
import { AppsIcon, RevealIcon, SearchIcon, TrashIcon, XIcon } from '~components/icons';
import { Button } from '~components/ui/Button';
import { Checkbox } from '~components/ui/Checkbox';
import { Badge, EmptyState, IconButton, PageHeader, Spinner } from '~components/ui/Controls';
import { Modal } from '~components/ui/Modal';
import { formatBytes, middleTruncate, plural, tildePath } from '~lib/format';
import { sound } from '~lib/sound';
import { useLumen } from '~store';
import { toast } from '~store/toasts';
import styles from './UninstallerPage.module.css';

function Details({ app, onClose, onRemoved }: { app: AppInfo; onClose: () => void; onRemoved: (app: AppInfo) => void }) {
  const home = useLumen((s) => s.platform?.home);
  const [leftovers, setLeftovers] = useState<Leftover[] | null>(null);
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void window.lumen.leftovers(app.path).then((found) => !cancelled && setLeftovers(found));
    return () => {
      cancelled = true;
    };
  }, [app.path]);

  const chosen = (leftovers ?? []).filter((l) => !unticked.has(l.path));
  const total = app.size + chosen.reduce((t, l) => t + l.size, 0);

  const uninstall = async () => {
    setConfirming(false);
    setWorking(true);
    const result = await window.lumen.uninstall(app.path, chosen.map((l) => l.path));
    setWorking(false);
    if (result.ok) {
      sound.complete();
      toast(`${app.name} uninstalled · ${formatBytes(result.freed)} freed`, 'success');
      void useLumen.getState().refreshDisk();
      onRemoved(app);
    } else {
      sound.error();
      toast(result.error ?? 'Couldn’t uninstall the app.', 'error');
    }
  };

  return (
    <motion.aside
      className={styles.details}
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
        <XIcon size={16} />
      </button>
      <div className={styles.hero}>
        {app.icon ? <img src={app.icon} alt="" className={styles.heroIcon} /> : <AppsIcon size={56} />}
        <h2>{app.name}</h2>
        <p>
          {app.version && `Version ${app.version} · `}
          {formatBytes(app.size)}
        </p>
        {app.running && <Badge tone="review">Running · Lumen will ask it to quit</Badge>}
      </div>

      <h3 className={styles.sectionTitle}>Leftover files</h3>
      {leftovers === null ? (
        <div className={styles.loading}>
          <Spinner /> Looking in ~/Library…
        </div>
      ) : leftovers.length === 0 ? (
        <p className={styles.none}>No leftover files found.</p>
      ) : (
        <ul className={styles.leftovers}>
          {leftovers.map((l) => (
            <li key={l.path}>
              <Checkbox
                checked={!unticked.has(l.path)}
                label={`Remove ${l.path}`}
                onChange={() => {
                  const next = new Set(unticked);
                  if (next.has(l.path)) next.delete(l.path);
                  else next.add(l.path);
                  setUnticked(next);
                }}
              />
              <div className={styles.leftoverMain}>
                <span title={l.path}>{middleTruncate(tildePath(l.path, home), 34)}</span>
                <span className={styles.leftoverKind}>{l.kind}</span>
              </div>
              <span className="mono">{formatBytes(l.size)}</span>
              <IconButton label="Show in Finder" onClick={() => void window.lumen.reveal(l.path)}>
                <RevealIcon size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.detailsFooter}>
        <div>
          <div className={styles.total}>{formatBytes(total)}</div>
          <div className={styles.totalMeta}>app {chosen.length ? `+ ${plural(chosen.length, 'leftover')}` : 'only'}</div>
        </div>
        <Button variant="danger" icon={working ? <Spinner size={14} /> : <TrashIcon size={16} />} disabled={working || leftovers === null} onClick={() => setConfirming(true)}>
          Uninstall
        </Button>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        icon={app.icon ? <img src={app.icon} alt="" width={36} height={36} /> : <AppsIcon size={22} />}
        title={`Uninstall ${app.name}?`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void uninstall()}>
              Uninstall
            </Button>
          </>
        }
      >
        <p>
          The app {chosen.length > 0 && `and ${plural(chosen.length, 'leftover item')}`} will move to the Trash ({formatBytes(total)}). You can restore them
          from the Trash until you empty it.
        </p>
      </Modal>
    </motion.aside>
  );
}

export function UninstallerPage() {
  const [apps, setApps] = useState<AppInfo[] | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<AppInfo | null>(null);
  const [sort, setSort] = useState<'name' | 'size'>('size');

  useEffect(() => {
    let cancelled = false;
    void window.lumen.apps().then((list) => !cancelled && setApps(list));
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (apps ?? []).filter((a) => !q || a.name.toLowerCase().includes(q));
    return sort === 'size' ? [...list].sort((a, b) => b.size - a.size) : list;
  }, [apps, query, sort]);

  return (
    <div className={`${styles.page} ${active ? styles.withDetails : ''}`}>
      <div className={styles.main}>
        <PageHeader title="Uninstaller" subtitle="Remove apps completely, along with the caches, preferences and support files they leave behind." />
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <SearchIcon size={15} />
            <input placeholder="Search apps" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <button type="button" className={styles.sort} onClick={() => setSort(sort === 'size' ? 'name' : 'size')}>
            Sort: {sort === 'size' ? 'Size' : 'Name'}
          </button>
        </div>

        {apps === null ? (
          <div className={styles.loading}>
            <Spinner /> Reading your Applications folder…
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={<AppsIcon size={26} />} title="No apps found">
            {query ? 'Nothing matches that search.' : 'Apps you install yourself show up here.'}
          </EmptyState>
        ) : (
          <div className={styles.grid}>
            {shown.map((app, i) => (
              <motion.button
                key={app.path}
                type="button"
                className={`${styles.tile} ${active?.path === app.path ? styles.tileActive : ''}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 24) * 0.018 }}
                whileHover={{ y: -3 }}
                onClick={() => {
                  sound.tick();
                  setActive(app);
                }}
              >
                {app.icon ? <img src={app.icon} alt="" className={styles.icon} /> : <AppsIcon size={44} />}
                <span className={styles.tileName}>{app.name}</span>
                <span className={styles.tileSize}>{formatBytes(app.size)}</span>
                {app.running && <span className={styles.runningDot} title="Running" />}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {active && (
          <Details
            key={active.path}
            app={active}
            onClose={() => setActive(null)}
            onRemoved={(removed) => {
              setApps((list) => (list ?? []).filter((a) => a.path !== removed.path));
              setActive(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
