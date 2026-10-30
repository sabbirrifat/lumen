import { motion } from 'motion/react';
import { useId } from 'react';

interface Props {
  /** 0–1 */
  progress: number;
  size: number;
  thickness?: number;
}

/** A thin gradient ring that eases toward `progress`. */
export function ProgressRing({ progress, size, thickness = 3 }: Props) {
  const id = useId();
  const r = (size - thickness * 2) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--teal)" />
          <stop offset="55%" stopColor="var(--violet)" />
          <stop offset="100%" stopColor="var(--rose)" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={`url(#${id})`}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - Math.min(1, Math.max(0, progress))) }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ filter: 'drop-shadow(0 0 6px rgba(139,123,255,0.8))' }}
      />
    </svg>
  );
}
