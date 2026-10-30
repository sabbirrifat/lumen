import { readdir, statfs } from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell, type IpcMainInvokeEvent } from 'electron';
import type { AppInfo, DirEntry, LumenEvents, Settings, TrashResult, UninstallResult } from '~shared/types';
import { cleanRules } from '~engine/cleaner';
import { createContext, type EngineContext } from '~engine/context';
import { exec } from '~engine/exec';
import { assertTrashable } from '~engine/guard';
import { findLargeFiles } from '~engine/largeFiles';
import { snapshotProcesses } from '~engine/processes';
import { RULES } from '~engine/rules';
import { scanRules, toResult } from '~engine/scanner';
import { sizesOf, sum } from '~engine/size';
import { listDir } from '~engine/spaceLens';
import { createStore } from '~engine/store';
import { applicationDirs, findLeftovers, leftoverRoots, listApps } from '~engine/uninstaller';

const send = <K extends keyof LumenEvents>(event: IpcMainInvokeEvent, channel: K, payload: LumenEvents[K]) => {
  if (!event.sender.isDestroyed()) event.sender.send(channel, payload);
};

/** Validates a renderer-supplied path list so a bad message can't widen what we touch. */
const paths = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((p): p is string => typeof p === 'string' && path.isAbsolute(p)) : [];

export function registerIpc() {
  const store = createStore(app.getPath('userData'));
  const spaceLensCache = new Map<string, DirEntry[]>();
  let largeFilesAbort: AbortController | null = null;
  let knownApps: AppInfo[] = [];

  const context = async (): Promise<EngineContext> => createContext({ excluded: (await store.settings()).excluded });

  const freeSpace = async (home: string) => {
    const s = await statfs(home);
    return { total: s.blocks * s.bsize, free: s.bavail * s.bsize };
  };

  async function hasFullDiskAccess(home: string): Promise<boolean> {
    // These folders are protected by macOS privacy controls; reading one proves access.
    for (const probe of ['Library/Safari', 'Library/Mail', 'Library/Messages']) {
      try {
        await readdir(path.join(home, probe));
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EPERM') return false;
      }
    }
    return true;
  }

  async function trashPaths(targets: string[], ctx: EngineContext, roots?: string[]): Promise<TrashResult> {
    const result: TrashResult = { trashed: [], failed: [], freed: 0 };
    const sizes = await sizesOf(targets);
    for (const target of targets) {
      try {
        await assertTrashable(target, ctx, roots);
        await shell.trashItem(target);
        result.trashed.push(target);
        result.freed += sizes.get(target) ?? 0;
      } catch (error) {
        result.failed.push({ path: target, error: (error as Error).message });
      }
    }
    for (const dir of new Set(result.trashed.map((t) => path.dirname(t)))) {
      for (const key of spaceLensCache.keys()) if (dir === key || dir.startsWith(`${key}/`)) spaceLensCache.delete(key);
    }
    return result;
  }

  ipcMain.handle('platform', async () => {
    const ctx = await context();
    return { home: ctx.home, version: app.getVersion(), fullDiskAccess: await hasFullDiskAccess(ctx.home) };
  });

  ipcMain.handle('disk', async () => freeSpace((await context()).home));

  ipcMain.handle('scan', async (event) => {
    const ctx = await context();
    const planned = await scanRules(
      ctx,
      RULES,
      (progress) => send(event, 'scan:progress', progress),
      (result) => send(event, 'scan:result', result),
    );
    return planned.map(toResult);
  });

  ipcMain.handle('clean', async (event, ruleIds: unknown) => {
    const ids = new Set(Array.isArray(ruleIds) ? ruleIds : []);
    const rules = RULES.filter((r) => ids.has(r.id));
    const ctx = await context();
    const settings = await store.settings();
    const freeBefore = (await freeSpace(ctx.home)).free;
    const outcomes = await cleanRules(ctx, rules, {
      trash: settings.cachesToTrash ? (target) => shell.trashItem(target) : undefined,
      onProgress: (progress) => send(event, 'clean:progress', progress),
    });
    const freed = sum(outcomes.map((o) => o.freed));
    const cleaned = outcomes.filter((o) => !o.error && o.freed > 0);
    if (cleaned.length) {
      await store.addHistory({ kind: 'cleanup', label: cleaned.map((o) => o.name).join(', '), freed, items: cleaned.length });
    }
    spaceLensCache.clear();
    return { outcomes, freed, freeBefore, freeAfter: (await freeSpace(ctx.home)).free };
  });

  ipcMain.handle('spaceLens', async (event, dir: unknown, refresh: unknown) => {
    if (typeof dir !== 'string' || !path.isAbsolute(dir)) return [];
    if (!refresh && spaceLensCache.has(dir)) return spaceLensCache.get(dir);
    const entries = await listDir(dir, (entry) => send(event, 'spaceLens:entry', { dir, entry }));
    spaceLensCache.set(dir, entries);
    return entries;
  });

  ipcMain.handle('largeFiles', async (event, minSize: unknown) => {
    largeFilesAbort?.abort();
    const abort = new AbortController();
    largeFilesAbort = abort;
    const ctx = await context();
    const files = await findLargeFiles(ctx.home, Number(minSize) || 100 * 1024 * 1024, (p) => send(event, 'largeFiles:progress', p), abort.signal);
    return files.filter((f) => !ctx.excluded.some((dir) => f.path.startsWith(`${dir}/`)));
  });

  ipcMain.handle('cancelLargeFiles', () => largeFilesAbort?.abort());

  ipcMain.handle('apps', async () => {
    const ctx = await context();
    const apps = await listApps(ctx);
    const self = app.getPath('exe');
    knownApps = apps.filter((a) => !self.startsWith(`${a.path}/`));
    // Quick Look thumbnails give a crisp 128px app icon; fall back to the small Finder icon.
    for (const info of knownApps) {
      const thumb = await nativeImage.createThumbnailFromPath(info.path, { width: 128, height: 128 }).catch(() => null);
      const image = thumb && !thumb.isEmpty() ? thumb : await app.getFileIcon(info.path, { size: 'large' }).catch(() => null);
      info.icon = image?.toDataURL();
    }
    return knownApps;
  });

  ipcMain.handle('leftovers', async (_event, appPath: unknown) => {
    const target = knownApps.find((a) => a.path === appPath);
    return target ? findLeftovers(await context(), target) : [];
  });

  ipcMain.handle('uninstall', async (_event, appPath: unknown, leftovers: unknown): Promise<UninstallResult> => {
    const target = knownApps.find((a) => a.path === appPath);
    if (!target) return { ok: false, error: 'Lumen doesn’t know this app. Refresh the list and try again.', freed: 0, leftoversRemoved: 0 };
    const ctx = await context();
    if ((await snapshotProcesses()).bundleIds.has(target.bundleId)) {
      // The id comes from the app's Info.plist and goes into AppleScript, so only plain ids pass.
      if (!/^[\w.-]+$/.test(target.bundleId)) {
        return { ok: false, error: `Quit ${target.name} first, then try again.`, freed: 0, leftoversRemoved: 0 };
      }
      await exec('osascript', ['-e', `tell application id "${target.bundleId}" to quit`], 15_000);
      for (let i = 0; i < 12 && (await snapshotProcesses()).bundleIds.has(target.bundleId); i++) {
        await new Promise((r) => setTimeout(r, 500));
      }
      if ((await snapshotProcesses()).bundleIds.has(target.bundleId)) {
        return { ok: false, error: `${target.name} is still open. Quit it and try again.`, freed: 0, leftoversRemoved: 0 };
      }
    }
    const appResult = await trashPaths([target.path], ctx, applicationDirs(ctx));
    if (!appResult.trashed.length) {
      // Root-owned apps can't be trashed directly; Finder asks for an admin password instead.
      const escaped = target.path.replace(/["\\]/g, '\\$&');
      const finder = await exec('osascript', ['-e', `tell application "Finder" to delete (POSIX file "${escaped}" as alias)`], 120_000);
      if (!finder.ok) return { ok: false, error: appResult.failed[0]?.error ?? 'Couldn’t move the app to the Trash.', freed: 0, leftoversRemoved: 0 };
    }
    const leftoverResult = await trashPaths(paths(leftovers), ctx, leftoverRoots(ctx));
    const freed = target.size + leftoverResult.freed;
    await store.addHistory({ kind: 'uninstall', label: target.name, freed, items: 1 + leftoverResult.trashed.length });
    knownApps = knownApps.filter((a) => a !== target);
    return { ok: true, freed, leftoversRemoved: leftoverResult.trashed.length };
  });

  ipcMain.handle('trash', async (_event, targets: unknown) => {
    const ctx = await context();
    const result = await trashPaths(paths(targets), ctx);
    if (result.trashed.length) {
      const label = result.trashed.length === 1 ? path.basename(result.trashed[0]) : `${result.trashed.length} items`;
      await store.addHistory({ kind: 'trash', label, freed: result.freed, items: result.trashed.length });
    }
    return result;
  });

  ipcMain.handle('reveal', (_event, target: unknown) => {
    if (typeof target === 'string' && path.isAbsolute(target)) shell.showItemInFolder(target);
  });

  ipcMain.handle('preview', (event, target: unknown) => {
    if (typeof target === 'string' && path.isAbsolute(target)) BrowserWindow.fromWebContents(event.sender)?.previewFile(target);
  });

  ipcMain.handle('openFullDiskAccess', () =>
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'),
  );

  ipcMain.handle('chooseFolder', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const options = { properties: ['openDirectory' as const, 'showHiddenFiles' as const] };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  ipcMain.handle('history', () => store.history());
  ipcMain.handle('getSettings', () => store.settings());
  ipcMain.handle('setSettings', (_event, patch: Partial<Settings>) => store.updateSettings(patch));
}
