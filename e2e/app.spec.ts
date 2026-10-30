import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron, expect, test } from '@playwright/test';
import type { LumenApi } from '~shared/types';

const MB = 1024 * 1024;
const SHOTS = path.join(__dirname, '..', 'test-results', 'screens');

const plist = (id: string, name: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${id}</string>
<key>CFBundleName</key><string>${name}</string>
<key>CFBundleShortVersionString</key><string>3.2.1</string>
</dict></plist>`;

/** A fake home with junk in the places Lumen knows, plus personal files that must survive. */
async function buildFixture(root: string) {
  const home = path.join(root, 'home');
  const brew = path.join(root, 'brew');
  const file = async (p: string, size: number, content?: string) => {
    const target = path.isAbsolute(p) ? p : path.join(home, p);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content ?? Buffer.alloc(size, 7));
    return target;
  };
  await file('.npm/_cacache/content-v2/sha512/aa', 42 * MB);
  await file('.cache/uv/archive-v0/old/lib.so', 21 * MB);
  await file('.cache/puppeteer/chrome/mac_arm-140.0.1/chrome', 28 * MB);
  await file('.cache/puppeteer/chrome/mac_arm-149.0.2/chrome', 8 * MB);
  await file('Library/Caches/Google/Chrome/Default/Cache/data_1', 16 * MB);
  await file('Library/Caches/com.example.music/stream', 11 * MB);
  await file('Library/Logs/SomeApp/app.log', 6 * MB);
  await file('Library/Developer/Xcode/DerivedData/Demo-abc/Build/x', 24 * MB);
  await file('Library/Developer/CoreSimulator/Devices/AAAA/data/x', 7 * MB);
  await file('.cache/huggingface/hub/models--demo/blob', 13 * MB);
  await file('.cache/huggingface/token', 0, 'hf_token');
  await file('.gemini/antigravity/brain/x', 9 * MB);
  await file(`${brew}/var/log/mongodb/mongo.log`, 30 * MB);
  await file('Downloads/Old Installer.dmg', 110 * MB);
  await file('Applications/Foo Studio.app/Contents/Info.plist', 0, plist('com.example.foostudio', 'Foo Studio'));
  await file('Applications/Foo Studio.app/Contents/MacOS/foo', 5 * MB);
  await file('Library/Application Support/Foo Studio/data.db', 2 * MB);
  await file('Library/Preferences/com.example.foostudio.plist', 0, '<plist/>');
  const personal = [await file('Documents/thesis.pdf', MB), await file('Library/Application Support/Google/Chrome/Default/Bookmarks', 1000)];
  return { home, brew, personal };
}

test('scan, clean and tour every page', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lumen-e2e-'));
  const { home, brew, personal } = await buildFixture(root);
  await mkdir(SHOTS, { recursive: true });
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, LUMEN_HOME: home, LUMEN_BREW_PREFIX: brew, LUMEN_USER_DATA: path.join(root, 'userData') },
  });
  const errors: string[] = [];
  const mainLog: string[] = [];
  app.process().stdout?.on('data', (d) => mainLog.push(String(d)));
  app.process().stderr?.on('data', (d) => mainLog.push(String(d)));
  try {
    const page = await app.firstWindow();
    page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
    page.on('pageerror', (err) => errors.push(err.message));
    const shot = async (name: string) => {
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
    };

    // CI machines start Electron slowly; if the welcome never shows, print what the app sees.
    try {
      await expect(page.getByText('Welcome to Lumen')).toBeVisible({ timeout: 20_000 });
    } catch (error) {
      const state = await page.evaluate(async () => {
        const { lumen } = globalThis as unknown as { lumen: LumenApi };
        return {
          settings: await lumen.getSettings().catch((e: Error) => `error: ${e.message}`),
          platform: await lumen.platform().catch((e: Error) => `error: ${e.message}`),
        };
      });
      console.log('App state:', JSON.stringify(state), '\nPage errors:', errors, '\nMain log:', mainLog.join(''));
      throw error;
    }
    await shot('01-onboarding');
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: /Skip for now|Start using Lumen/ }).click();
    await expect(page.getByText('Clear the clutter, keep the calm.')).toBeVisible();
    await shot('02-idle');

    await page.getByRole('button', { name: 'Start Smart Scan' }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(SHOTS, '03-scanning.png') });
    await expect(page.getByText('Ready to clean')).toBeVisible({ timeout: 60_000 });
    await shot('04-results');

    await page.getByRole('button', { name: 'Review items' }).click();
    await expect(page.getByRole('heading', { name: 'Cleanup' })).toBeVisible();
    await page.getByText('npm download cache').click();
    await shot('05-cleanup');

    await page.getByRole('button', { name: /^Clean / }).last().click();
    await expect(page.getByText('All clear')).toBeVisible({ timeout: 60_000 });
    await shot('06-done');
    expect(existsSync(path.join(home, '.npm/_cacache/content-v2'))).toBe(false);
    expect(existsSync(path.join(home, '.cache/puppeteer/chrome/mac_arm-149.0.2'))).toBe(true);
    for (const p of personal) expect(existsSync(p)).toBe(true);
    // Review items (Hugging Face, Antigravity, simulators) stay until chosen.
    expect(existsSync(path.join(home, '.cache/huggingface/hub'))).toBe(true);

    await page.getByRole('button', { name: 'Space Lens' }).click();
    await expect(page.getByRole('heading', { name: 'Space Lens' })).toBeVisible();
    await page.waitForTimeout(2500);
    await shot('07-space-lens');

    await page.getByRole('button', { name: 'Large & Old Files' }).click();
    await page.getByRole('button', { name: 'Find large files' }).click();
    await expect(page.getByText('Old Installer.dmg')).toBeVisible({ timeout: 30_000 });
    await page.getByText('Old Installer.dmg').click();
    await shot('08-large-files');

    await page.getByRole('button', { name: 'Uninstaller' }).click();
    await page.getByRole('button', { name: /Foo Studio/ }).click();
    await expect(page.getByText('Leftover files')).toBeVisible();
    await shot('09-uninstaller');

    await page.getByRole('button', { name: 'History' }).click();
    await shot('10-history');
    await page.getByRole('button', { name: 'Settings' }).click();
    await shot('11-settings');

    expect(errors).toEqual([]);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
