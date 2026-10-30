import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { RuleResult } from '~shared/types';
import { BroomIcon, ChevronIcon, RevealIcon, SparkleIcon } from '~components/icons';
import { Button } from '~components/ui/Button';
import { Checkbox } from '~components/ui/Checkbox';
import { Badge, EmptyState, IconButton, PageHeader, SizeBar } from '~components/ui/Controls';
import { CATEGORIES } from '~lib/categories';
import { formatBytes, middleTruncate, plural, tildePath } from '~lib/format';
import { selectedSize, useLumen } from '~store';
import styles from './CleanupPage.module.css';

function RuleRow({ rule, max, color }: { rule: RuleResult; max: number; color: string }) {
  const [open, setOpen] = useState(false);
  const checked = useLumen((s) => s.selected.includes(rule.id));
  const toggle = useLumen((s) => s.toggle);
  const home = useLumen((s) => s.platform?.home);
  return (
    <div className={`${styles.rule} ${open ? styles.open : ''}`}>
      <div className={styles.ruleHead} role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)}>
        <Checkbox checked={checked && !rule.blocked} disabled={!!rule.blocked} onChange={() => toggle(rule.id)} label={`Clean ${rule.name}`} />
        <div className={styles.ruleText}>
          <span className={styles.ruleName}>
            {rule.name}
            {rule.safety === 'review' && <Badge tone="review">Review</Badge>}
            {rule.blocked && <Badge tone="blocked">{rule.blocked}</Badge>}
          </span>
          <span className={styles.ruleDetail}>{rule.detail}</span>
        </div>
        <div className={styles.ruleSize}>
          <span className="mono">{formatBytes(rule.size)}</span>
          <SizeBar fraction={rule.size / max} color={color} />
        </div>
        <ChevronIcon size={16} className={styles.chevron} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className={styles.ruleBody}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className={styles.ruleBodyInner}>
              <p className={styles.explain}>{rule.explain}</p>
              {rule.items.length > 0 && (
                <ul className={styles.items}>
                  {rule.items.map((item) => (
                    <li key={item.path}>
                      <span className={styles.itemPath} title={item.path}>
                        {middleTruncate(tildePath(item.path, home), 90)}
                      </span>
                      <span className="mono">{formatBytes(item.size)}</span>
                      <IconButton label="Show in Finder" onClick={() => void window.lumen.reveal(item.path)}>
                        <RevealIcon size={15} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
              {rule.itemCount > rule.items.length && (
                <p className={styles.more}>and {plural(rule.itemCount - rule.items.length, 'smaller item')}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CleanupPage() {
  const phase = useLumen((s) => s.phase);
  const results = useLumen((s) => s.results);
  const selected = useLumen((s) => s.selected);
  const { scan, clean, selectSafe, selectNone } = useLumen.getState();
  const max = Math.max(1, ...results.map((r) => r.size));
  const total = selectedSize(results, selected);
  const count = results.filter((r) => selected.includes(r.id) && !r.blocked).length;

  if (phase !== 'results' || results.length === 0) {
    return (
      <div className={styles.page}>
        <PageHeader title="Cleanup" subtitle="Everything Smart Scan finds shows up here, grouped and explained." />
        <EmptyState
          icon={<BroomIcon size={26} />}
          title={phase === 'scanning' ? 'Scanning…' : 'Nothing to review yet'}
          action={
            phase !== 'scanning' && (
              <Button icon={<SparkleIcon size={16} />} onClick={() => void scan()}>
                Run Smart Scan
              </Button>
            )
          }
        >
          {phase === 'scanning' ? 'Results will appear here when the scan finishes.' : 'Run a Smart Scan to see what Lumen can clear.'}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Cleanup" subtitle="Safe items are ticked for you. Items marked Review are yours to decide.">
        <Button variant="subtle" size="sm" onClick={selectSafe}>
          Select safe
        </Button>
        <Button variant="subtle" size="sm" onClick={selectNone}>
          Select none
        </Button>
      </PageHeader>

      <div className={styles.groups}>
        {CATEGORIES.map((cat, gi) => {
          const rules = results.filter((r) => r.category === cat.id);
          if (!rules.length) return null;
          return (
            <motion.section
              key={cat.id}
              className={styles.group}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className={styles.groupTitle} style={{ color: cat.color }}>
                <cat.Icon size={16} />
                <span>{cat.label}</span>
                <span className={styles.groupTotal}>{formatBytes(rules.reduce((t, r) => t + r.size, 0))}</span>
              </h2>
              {rules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} max={max} color={cat.color} />
              ))}
            </motion.section>
          );
        })}
      </div>

      <div className={styles.footer}>
        <div>
          <div className={styles.footerSize}>{formatBytes(total)}</div>
          <div className={styles.footerMeta}>{plural(count, 'item')} selected</div>
        </div>
        <Button size="lg" icon={<BroomIcon size={18} />} disabled={total === 0} onClick={() => void clean()}>
          Clean {formatBytes(total)}
        </Button>
      </div>
    </div>
  );
}
