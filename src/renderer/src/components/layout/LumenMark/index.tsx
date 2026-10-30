import { useId } from 'react';

/** Lumen's mark: a glowing orb inside a thin orbit. */
export function LumenMark({ size = 24 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <radialGradient id={`${id}-core`} cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#9ff3dd" />
          <stop offset="70%" stopColor="#8b7bff" />
          <stop offset="100%" stopColor="#ff7ab6" />
        </radialGradient>
        <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4fe3c1" />
          <stop offset="100%" stopColor="#ff7ab6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="8.5" fill={`url(#${id}-core)`} />
      <ellipse cx="16" cy="16" rx="14" ry="5.2" fill="none" stroke={`url(#${id}-ring)`} strokeWidth="1.4" transform="rotate(-24 16 16)" opacity="0.9" />
    </svg>
  );
}
