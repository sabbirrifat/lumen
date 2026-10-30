import { arc } from 'd3-shape';
import { motion } from 'motion/react';
import type { DirEntry } from '~shared/types';
import { formatBytes } from '~lib/format';
import styles from './Sunburst.module.css';

interface Props {
  name: string;
  entries: DirEntry[];
  /** Children of first-ring folders, once they've been measured. */
  sub: Record<string, DirEntry[]>;
  hovered: string | null;
  onHover: (path: string | null) => void;
  onOpen: (entry: DirEntry) => void;
  onUp?: () => void;
}

interface Slice {
  key: string;
  entry?: DirEntry;
  a0: number;
  a1: number;
  r0: number;
  r1: number;
  color: string;
}

const SIZE = 440;
const RINGS = { core: 74, inner: [80, 152], outer: [156, 204] } as const;
const MIN_FRACTION = 0.012;
const TAU = Math.PI * 2;

const arcPath = arc<Slice>()
  .startAngle((d) => d.a0)
  .endAngle((d) => d.a1)
  .innerRadius((d) => d.r0)
  .outerRadius((d) => d.r1)
  .padAngle(0.008)
  .padRadius(140)
  .cornerRadius(5);

/** Teal → violet → rose across the first ring. */
const hue = (i: number, n: number) => 165 + (165 * i) / Math.max(1, n - 1);

function layout(entries: DirEntry[], sub: Record<string, DirEntry[]>): Slice[] {
  const total = entries.reduce((t, e) => t + e.size, 0);
  if (!total) return [];
  const big = entries.filter((e) => e.size / total >= MIN_FRACTION);
  const rest = total - big.reduce((t, e) => t + e.size, 0);
  const slices: Slice[] = [];
  let angle = 0;
  big.forEach((entry, i) => {
    const span = (entry.size / total) * TAU;
    const h = hue(i, big.length);
    slices.push({ key: entry.path, entry, a0: angle, a1: angle + span, r0: RINGS.inner[0], r1: RINGS.inner[1], color: `hsl(${h} 78% 64%)` });
    const children = sub[entry.path];
    if (children && entry.size) {
      let childAngle = angle;
      for (const child of children) {
        const childSpan = (child.size / entry.size) * span;
        if (childSpan > 0.012) {
          slices.push({ key: child.path, entry: child, a0: childAngle, a1: childAngle + childSpan, r0: RINGS.outer[0], r1: RINGS.outer[1], color: `hsl(${h} 60% 70% / 0.55)` });
        }
        childAngle += childSpan;
      }
    }
    angle += span;
  });
  if (rest > 0) {
    slices.push({ key: '__rest', a0: angle, a1: TAU, r0: RINGS.inner[0], r1: RINGS.inner[1], color: 'rgba(255,255,255,0.1)' });
  }
  return slices;
}

export function Sunburst({ name, entries, sub, hovered, onHover, onOpen, onUp }: Props) {
  const slices = layout(entries, sub);
  const total = entries.reduce((t, e) => t + e.size, 0);
  const focus = slices.find((s) => s.entry?.path === hovered)?.entry;

  return (
    <svg className={styles.svg} viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`} onMouseLeave={() => onHover(null)}>
      <defs>
        <radialGradient id="lens-core" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="rgba(139,123,255,0.35)" />
          <stop offset="100%" stopColor="rgba(16,18,32,0.95)" />
        </radialGradient>
      </defs>
      {slices.map((slice, i) => {
        const clickable = slice.entry?.isDir && !slice.entry.isPackage;
        const dimmed = hovered !== null && slice.entry?.path !== hovered;
        return (
          <motion.path
            key={slice.key}
            d={arcPath(slice) ?? ''}
            fill={slice.color}
            className={clickable ? styles.clickable : undefined}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: dimmed ? 0.35 : 1, scale: 1 }}
            transition={{ opacity: { duration: 0.2 }, scale: { delay: Math.min(i, 30) * 0.012, type: 'spring', stiffness: 220, damping: 24 } }}
            onMouseEnter={() => onHover(slice.entry?.path ?? null)}
            onClick={() => clickable && slice.entry && onOpen(slice.entry)}
          />
        );
      })}
      <g className={onUp ? styles.clickable : undefined} onClick={onUp}>
        <circle r={RINGS.core} fill="url(#lens-core)" stroke="rgba(255,255,255,0.08)" />
        <text className={styles.centerName} y={-8} textAnchor="middle">
          {truncate(focus?.name ?? name, 16)}
        </text>
        <text className={styles.centerSize} y={16} textAnchor="middle">
          {formatBytes(focus?.size ?? total)}
        </text>
        {onUp && !focus && (
          <text className={styles.centerHint} y={36} textAnchor="middle">
            click to go up
          </text>
        )}
        {focus && total > 0 && (
          <text className={styles.centerHint} y={36} textAnchor="middle">
            {Math.round((focus.size / total) * 100)}% of this folder
          </text>
        )}
      </g>
    </svg>
  );
}

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
