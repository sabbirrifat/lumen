import { join } from 'node:path';
import { app, BrowserWindow, nativeTheme, shell } from 'electron';
import { registerIpc } from './ipc';

// Apps opened from Finder get a bare PATH; add Homebrew's so docker and colima resolve.
process.env.PATH = [process.env.PATH, '/opt/homebrew/bin', '/usr/local/bin'].filter(Boolean).join(':');

// End-to-end tests point the app at a fixture home (LUMEN_HOME) and their own settings folder.
if (process.env.LUMEN_USER_DATA) app.setPath('userData', process.env.LUMEN_USER_DATA);

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Lumen',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    // Opaque on purpose: the orb's glow is screen-blended onto the page, which needs a solid backdrop.
    backgroundColor: '#07080f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(__dirname, '../renderer/index.html'));
}

void app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark';
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
