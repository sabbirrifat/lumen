// Renders build/icon.svg to build/icon.icns. Run with: npm run icon
// Electron draws the SVG offscreen (transparent), then sips and iconutil build the iconset.
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const buildDir = path.join(__dirname, '..', 'build');
const iconset = path.join(buildDir, 'icon.iconset');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(buildDir, 'icon.svg'), 'utf8');
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } });
  const html = `<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="1024" height="1024"></body></html>`;
  await win.loadURL(`data:text/html;base64,${Buffer.from(html).toString('base64')}`);
  await new Promise((r) => setTimeout(r, 500));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  const master = path.join(buildDir, 'icon.png');
  fs.writeFileSync(master, image.resize({ width: 1024, height: 1024 }).toPNG());

  fs.rmSync(iconset, { recursive: true, force: true });
  fs.mkdirSync(iconset);
  for (const size of [16, 32, 128, 256, 512]) {
    for (const scale of [1, 2]) {
      const name = `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`;
      execFileSync('sips', ['-z', String(size * scale), String(size * scale), master, '--out', path.join(iconset, name)], { stdio: 'ignore' });
    }
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(buildDir, 'icon.icns')]);
  fs.rmSync(iconset, { recursive: true, force: true });
  console.log('Wrote build/icon.png and build/icon.icns');
  app.quit();
});
