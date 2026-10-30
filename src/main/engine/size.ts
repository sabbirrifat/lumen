import { exec } from './exec';
import { existing } from './fsutil';

const DU_CHUNK = 200;

/**
 * Allocated size in bytes of each path that exists, from `du -sk` (one call per 200 paths).
 * Hard links are counted once per call, like Finder does.
 */
export async function sizesOf(paths: string[]): Promise<Map<string, number>> {
  const sizes = new Map<string, number>();
  const present = await existing(paths);
  for (let i = 0; i < present.length; i += DU_CHUNK) {
    const { stdout } = await exec('du', ['-sk', ...present.slice(i, i + DU_CHUNK)]);
    for (const line of stdout.split('\n')) {
      const tab = line.indexOf('\t');
      if (tab > 0) sizes.set(line.slice(tab + 1), parseInt(line, 10) * 1024);
    }
  }
  return sizes;
}

export async function sizeOf(paths: string[]): Promise<number> {
  return sum((await sizesOf(paths)).values());
}

export function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}
