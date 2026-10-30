import { mkdir, mkdtemp, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach } from 'vitest';
import { createContext, type EngineContext } from '~engine/context';
import type { ProcessSnapshot } from '~engine/processes';

export const MB = 1024 * 1024;

const created: string[] = [];
afterEach(async () => {
  await Promise.all(created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

/** A throwaway home folder plus helpers to fill it. Removed after each test. */
export async function makeHome() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lumen-test-'));
  created.push(root);
  const home = path.join(root, 'home');
  const brew = path.join(root, 'brew');
  await mkdir(home, { recursive: true });
  const at = (p: string) => (path.isAbsolute(p) ? p : path.join(home, p));
  return {
    home,
    brew,
    at,
    async file(p: string, size = MB, content?: string) {
      const target = at(p);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content ?? Buffer.alloc(size, 7));
      return target;
    },
    async dir(p: string) {
      await mkdir(at(p), { recursive: true });
      return at(p);
    },
    async link(p: string, to: string) {
      await mkdir(path.dirname(at(p)), { recursive: true });
      await symlink(to, at(p));
      return at(p);
    },
    async age(p: string, days: number) {
      const when = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      await utimes(at(p), when, when);
    },
    context(processes: Partial<ProcessSnapshot> = {}, extra: Partial<EngineContext> = {}) {
      return createContext({
        home,
        brewPrefix: brew,
        external: false,
        simctl: false,
        processes: { commands: [], bundleIds: new Set(), ...processes },
        ...extra,
      });
    },
  };
}
