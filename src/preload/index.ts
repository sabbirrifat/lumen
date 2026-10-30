import { contextBridge, ipcRenderer } from 'electron';
import type { LumenApi } from '~shared/types';

const invoke = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

const api: LumenApi = {
  platform: invoke('platform') as LumenApi['platform'],
  disk: invoke('disk') as LumenApi['disk'],
  scan: invoke('scan') as LumenApi['scan'],
  clean: invoke('clean') as LumenApi['clean'],
  spaceLens: invoke('spaceLens') as LumenApi['spaceLens'],
  largeFiles: invoke('largeFiles') as LumenApi['largeFiles'],
  cancelLargeFiles: invoke('cancelLargeFiles') as LumenApi['cancelLargeFiles'],
  apps: invoke('apps') as LumenApi['apps'],
  leftovers: invoke('leftovers') as LumenApi['leftovers'],
  uninstall: invoke('uninstall') as LumenApi['uninstall'],
  trash: invoke('trash') as LumenApi['trash'],
  reveal: invoke('reveal') as LumenApi['reveal'],
  preview: invoke('preview') as LumenApi['preview'],
  openFullDiskAccess: invoke('openFullDiskAccess') as LumenApi['openFullDiskAccess'],
  chooseFolder: invoke('chooseFolder') as LumenApi['chooseFolder'],
  history: invoke('history') as LumenApi['history'],
  getSettings: invoke('getSettings') as LumenApi['getSettings'],
  setSettings: invoke('setSettings') as LumenApi['setSettings'],
  on(channel, listener) {
    const handler = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) => listener(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
};

contextBridge.exposeInMainWorld('lumen', api);
