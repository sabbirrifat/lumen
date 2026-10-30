import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HistoryEntry, Settings } from '~shared/types';

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  volume: 0.6,
  cachesToTrash: false,
  excluded: [],
  onboarded: false,
};

const MAX_HISTORY = 200;

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2));
}

/** Settings and history as JSON files in the app's data folder. */
export function createStore(dir: string) {
  const settingsFile = path.join(dir, 'settings.json');
  const historyFile = path.join(dir, 'history.json');
  return {
    async settings(): Promise<Settings> {
      return { ...DEFAULT_SETTINGS, ...(await readJson<Partial<Settings>>(settingsFile, {})) };
    },
    async updateSettings(patch: Partial<Settings>): Promise<Settings> {
      const next = { ...(await this.settings()), ...patch };
      await writeJson(settingsFile, next);
      return next;
    },
    history(): Promise<HistoryEntry[]> {
      return readJson<HistoryEntry[]>(historyFile, []);
    },
    async addHistory(entry: Omit<HistoryEntry, 'at'>): Promise<void> {
      const entries = await this.history();
      await writeJson(historyFile, [{ at: new Date().toISOString(), ...entry }, ...entries].slice(0, MAX_HISTORY));
    },
  };
}
