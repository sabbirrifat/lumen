import { create } from 'zustand';
import {
  type CleanProgress,
  type CleanSummary,
  type DiskInfo,
  MIN_SIZE,
  type PlatformInfo,
  type RuleResult,
  type ScanProgress,
  type Settings,
} from '~shared/types';
import { sound } from '~lib/sound';

export type Page = 'scan' | 'cleanup' | 'space' | 'large' | 'uninstall' | 'history' | 'settings';
export type Phase = 'idle' | 'scanning' | 'results' | 'cleaning' | 'done';

const api = () => window.lumen;

interface LumenState {
  page: Page;
  platform: PlatformInfo | null;
  disk: DiskInfo | null;
  settings: Settings | null;
  phase: Phase;
  scanProgress: ScanProgress | null;
  cleanProgress: CleanProgress | null;
  /** Rules that found something; grows live during a scan. */
  results: RuleResult[];
  selected: string[];
  summary: CleanSummary | null;
  go(page: Page): void;
  boot(): () => void;
  refreshDisk(): Promise<void>;
  refreshPlatform(): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  scan(): Promise<void>;
  toggle(id: string): void;
  selectSafe(): void;
  selectNone(): void;
  clean(): Promise<void>;
  reset(): void;
}

const cleanable = (r: RuleResult) => !r.blocked && r.size >= MIN_SIZE;
export const defaultSelection = (results: RuleResult[]) => results.filter((r) => cleanable(r) && r.safety === 'safe').map((r) => r.id);
export const selectedSize = (results: RuleResult[], selected: string[]) =>
  results.filter((r) => selected.includes(r.id) && cleanable(r)).reduce((t, r) => t + r.size, 0);

export const useLumen = create<LumenState>((set, get) => ({
  page: 'scan',
  platform: null,
  disk: null,
  settings: null,
  phase: 'idle',
  scanProgress: null,
  cleanProgress: null,
  results: [],
  selected: [],
  summary: null,

  go(page) {
    if (page !== get().page) sound.tick();
    set({ page });
  },

  boot() {
    void get().refreshPlatform();
    void get().refreshDisk();
    void api()
      .getSettings()
      .then((settings) => {
        sound.configure(settings.sound, settings.volume);
        set({ settings });
      });
    const offs = [
      api().on('scan:progress', (scanProgress) => set({ scanProgress })),
      api().on('scan:result', (result) => set((s) => ({ results: [...s.results.filter((r) => r.id !== result.id), result] }))),
      api().on('clean:progress', (cleanProgress) => set({ cleanProgress })),
    ];
    return () => offs.forEach((off) => off());
  },

  async refreshDisk() {
    set({ disk: await api().disk() });
  },

  async refreshPlatform() {
    set({ platform: await api().platform() });
  },

  async updateSettings(patch) {
    const settings = await api().setSettings(patch);
    sound.configure(settings.sound, settings.volume);
    set({ settings });
  },

  async scan() {
    if (get().phase === 'scanning' || get().phase === 'cleaning') return;
    set({ phase: 'scanning', results: [], selected: [], summary: null, scanProgress: null });
    sound.scanStart();
    sound.startAmbient();
    try {
      const results = (await api().scan()).filter((r) => r.size >= MIN_SIZE).sort((a, b) => b.size - a.size);
      set({ results, selected: defaultSelection(results), phase: 'results' });
      sound.found();
    } catch {
      set({ phase: 'idle' });
      sound.error();
    } finally {
      sound.stopAmbient();
    }
  },

  toggle(id) {
    const { selected } = get();
    const on = !selected.includes(id);
    sound.toggle(on);
    set({ selected: on ? [...selected, id] : selected.filter((s) => s !== id) });
  },

  selectSafe() {
    set({ selected: defaultSelection(get().results) });
  },

  selectNone() {
    set({ selected: [] });
  },

  async clean() {
    const { results, selected } = get();
    const ids = results.filter((r) => selected.includes(r.id) && cleanable(r)).map((r) => r.id);
    if (!ids.length) return;
    set({ page: 'scan', phase: 'cleaning', cleanProgress: null });
    sound.whoosh();
    sound.startAmbient();
    try {
      const summary = await api().clean(ids);
      set({ summary, phase: 'done' });
      sound.complete();
    } catch {
      set({ phase: 'results' });
      sound.error();
    } finally {
      sound.stopAmbient();
      void get().refreshDisk();
    }
  },

  reset() {
    set({ phase: 'idle', results: [], selected: [], summary: null, scanProgress: null, cleanProgress: null });
  },
}));
