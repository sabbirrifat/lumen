// Sizes use powers of 1000, like Finder and System Settings.

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function splitBytes(bytes: number): { value: string; unit: string } {
  if (bytes < 1000) return { value: String(Math.round(bytes)), unit: 'B' };
  const power = Math.min(UNITS.length - 1, Math.floor(Math.log10(bytes) / 3));
  const scaled = bytes / 1000 ** power;
  const digits = scaled >= 100 || power <= 1 ? 0 : 1;
  return { value: scaled.toFixed(digits), unit: UNITS[power] };
}

export function formatBytes(bytes: number): string {
  const { value, unit } = splitBytes(bytes);
  return `${value} ${unit}`;
}

const SPANS: [number, string][] = [
  [365 * 24 * 3600, 'year'],
  [30 * 24 * 3600, 'month'],
  [7 * 24 * 3600, 'week'],
  [24 * 3600, 'day'],
  [3600, 'hour'],
  [60, 'minute'],
];

export function timeAgo(ms: number, now = Date.now()): string {
  const seconds = Math.max(0, (now - ms) / 1000);
  for (const [span, label] of SPANS) {
    const n = Math.floor(seconds / span);
    if (n >= 1) return `${n} ${label}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "/Users/me/Library/Caches" → "~/Library/Caches". */
export function tildePath(p: string, home?: string): string {
  if (!home) return p;
  return p === home ? '~' : p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p;
}

/** Keeps both ends of a long path: "~/Library/Appl…/Foo/cache". */
export function middleTruncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.ceil((max - 1) * 0.45);
  return `${text.slice(0, head)}…${text.slice(text.length - (max - 1 - head))}`;
}

export const plural =(n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
