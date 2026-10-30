// The contract between the main process (engine + IPC) and the renderer.

export type RuleCategory = 'developer' | 'xcode' | 'apps' | 'system' | 'ai';
export type Safety = 'safe' | 'review';

/** Anything smaller than this isn't worth offering. */
export const MIN_SIZE = 1024 * 1024;

export interface SizedPath {
  path: string;
  size: number;
}

export interface RuleResult {
  id: string;
  name: string;
  category: RuleCategory;
  safety: Safety;
  explain: string;
  detail: string;
  /** Bytes this rule would free. */
  size: number;
  /** Why it can't be cleaned right now, e.g. "Quit Google Chrome to clean". */
  blocked?: string;
  /** The largest targets, for the expandable list. */
  items: SizedPath[];
  itemCount: number;
}

export interface ScanProgress {
  done: number;
  total: number;
  current: string;
  found: number;
}

export interface CleanProgress {
  done: number;
  total: number;
  current: string;
  freed: number;
}

export interface CleanOutcome {
  id: string;
  name: string;
  freed: number;
  error?: string;
}

export interface CleanSummary {
  outcomes: CleanOutcome[];
  freed: number;
  freeBefore: number;
  freeAfter: number;
}

export interface DiskInfo {
  total: number;
  free: number;
}

export interface DirEntry {
  path: string;
  name: string;
  size: number;
  isDir: boolean;
  /** .app, .photoslibrary and other bundles: shown as one item, never drilled into. */
  isPackage: boolean;
}

export interface SpaceLensEntryEvent {
  dir: string;
  entry: DirEntry;
}

export type FileKind = 'video' | 'audio' | 'image' | 'archive' | 'disk-image' | 'installer' | 'document' | 'other';

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  /** Last opened (atime), ms since epoch. */
  accessed: number;
  modified: number;
  kind: FileKind;
}

export interface LargeFilesProgress {
  found: number;
  current: string;
}

export interface AppInfo {
  path: string;
  name: string;
  bundleId: string;
  version: string;
  size: number;
  running: boolean;
  /** PNG data URL. */
  icon?: string;
}

export interface Leftover {
  path: string;
  size: number;
  /** Which Library folder it was found in, e.g. "Caches". */
  kind: string;
}

export interface TrashResult {
  trashed: string[];
  failed: { path: string; error: string }[];
  freed: number;
}

export interface UninstallResult {
  ok: boolean;
  error?: string;
  freed: number;
  leftoversRemoved: number;
}

export interface HistoryEntry {
  at: string;
  kind: 'cleanup' | 'trash' | 'uninstall';
  label: string;
  freed: number;
  items: number;
}

export interface Settings {
  sound: boolean;
  volume: number;
  /** Move cleaned caches to the Trash instead of deleting them. */
  cachesToTrash: boolean;
  /** Folders Lumen never touches. */
  excluded: string[];
  onboarded: boolean;
}

export interface PlatformInfo {
  home: string;
  version: string;
  fullDiskAccess: boolean;
}

export interface LumenEvents {
  'scan:progress': ScanProgress;
  'scan:result': RuleResult;
  'clean:progress': CleanProgress;
  'spaceLens:entry': SpaceLensEntryEvent;
  'largeFiles:progress': LargeFilesProgress;
}

export interface LumenApi {
  platform(): Promise<PlatformInfo>;
  disk(): Promise<DiskInfo>;
  scan(): Promise<RuleResult[]>;
  clean(ruleIds: string[]): Promise<CleanSummary>;
  spaceLens(dir: string, refresh?: boolean): Promise<DirEntry[]>;
  largeFiles(minSize: number): Promise<FileInfo[]>;
  cancelLargeFiles(): Promise<void>;
  apps(): Promise<AppInfo[]>;
  leftovers(appPath: string): Promise<Leftover[]>;
  uninstall(appPath: string, leftovers: string[]): Promise<UninstallResult>;
  trash(paths: string[]): Promise<TrashResult>;
  reveal(path: string): Promise<void>;
  preview(path: string): Promise<void>;
  openFullDiskAccess(): Promise<void>;
  chooseFolder(): Promise<string | null>;
  history(): Promise<HistoryEntry[]>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  on<K extends keyof LumenEvents>(channel: K, listener: (payload: LumenEvents[K]) => void): () => void;
}
