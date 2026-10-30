import { existsSync } from 'node:fs';
import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanRules } from '~engine/cleaner';
import { RULES } from '~engine/rules';
import { scanRule, toResult } from '~engine/scanner';
import { makeHome, MB } from './fixture';

const rule = (id: string) => {
  const found = RULES.find((r) => r.id === id);
  if (!found) throw new Error(`no rule ${id}`);
  return found;
};

/** A stand-in for shell.trashItem that moves files into a folder we can inspect. */
async function fakeTrash(dir: string) {
  await mkdir(dir, { recursive: true });
  return async (target: string) => rename(target, path.join(dir, path.basename(target)));
}

const plist = (entries: Record<string, string>) =>
  `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>${Object.entries(
    entries,
  )
    .map(([k, v]) => (k.endsWith('Date') ? `<key>${k}</key><date>${v}</date>` : `<key>${k}</key><string>${v}</string>`))
    .join('')}</dict></plist>`;

describe('Downloads & Trash', () => {
  it('moves week-old installers to the Trash and leaves everything else', async () => {
    const h = await makeHome();
    await h.file('Downloads/OldApp.dmg', 2 * MB);
    await h.file('Downloads/apps/Tool.pkg', 2 * MB);
    await h.file('Downloads/NewApp.dmg', 2 * MB);
    await h.file('Downloads/holiday.jpg', 2 * MB);
    await h.age('Downloads/OldApp.dmg', 30);
    await h.age('Downloads/apps/Tool.pkg', 30);
    await h.age('Downloads/holiday.jpg', 30);
    const trash = h.at('FakeTrash');
    const [outcome] = await cleanRules(await h.context(), [rule('old-installers')], { moveToTrash: await fakeTrash(trash) });
    expect(outcome.trashed).toBeGreaterThanOrEqual(4 * MB);
    expect(outcome.freed).toBe(0);
    expect(existsSync(path.join(trash, 'OldApp.dmg'))).toBe(true);
    expect(existsSync(path.join(trash, 'Tool.pkg'))).toBe(true);
    expect(existsSync(h.at('Downloads/NewApp.dmg'))).toBe(true);
    expect(existsSync(h.at('Downloads/holiday.jpg'))).toBe(true);
  });

  it('never deletes Trash-only files when moving to the Trash is unavailable', async () => {
    const h = await makeHome();
    await h.file('Downloads/OldApp.dmg', 2 * MB);
    await h.age('Downloads/OldApp.dmg', 30);
    const [outcome] = await cleanRules(await h.context(), [rule('old-installers')]);
    expect(outcome.error).toMatch(/Trash/);
    expect(existsSync(h.at('Downloads/OldApp.dmg'))).toBe(true);
  });

  it('finds downloads that stopped partway, but not ones still in progress', async () => {
    const h = await makeHome();
    await h.file('Downloads/movie.mp4.crdownload', 2 * MB);
    await h.file('Downloads/Big.zip.download/data', 2 * MB);
    await h.file('Downloads/now.iso.part', 2 * MB);
    await h.age('Downloads/movie.mp4.crdownload', 3);
    await h.age('Downloads/Big.zip.download', 3);
    const { plan } = await scanRule(rule('unfinished-downloads'), await h.context());
    expect(plan.targets.sort()).toEqual([h.at('Downloads/Big.zip.download'), h.at('Downloads/movie.mp4.crdownload')]);
  });
});

describe('iPhone & iPad', () => {
  it('labels backups with the device name and date, and moves them to the Trash', async () => {
    const h = await makeHome();
    const backup = 'Library/Application Support/MobileSync/Backup/00008110-001A';
    await h.file(`${backup}/Manifest.db`, 3 * MB);
    await h.file(`${backup}/Info.plist`, 0, plist({ 'Device Name': 'Sam’s iPhone', 'Last Backup Date': '2025-03-03T10:00:00Z' }));
    const ctx = await h.context();
    const result = toResult(await scanRule(rule('ios-backups'), ctx));
    expect(result.items[0].label).toBe('Sam’s iPhone · backed up 3 Mar 2025');
    expect(result.toTrash).toBe(true);
    const trash = h.at('FakeTrash');
    await cleanRules(ctx, [rule('ios-backups')], { moveToTrash: await fakeTrash(trash) });
    expect(existsSync(path.join(trash, '00008110-001A', 'Manifest.db'))).toBe(true);
  });

  it('clears downloaded iPhone software updates', async () => {
    const h = await makeHome();
    await h.file('Library/iTunes/iPhone Software Updates/iPhone_18.1_Restore.ipsw', 3 * MB);
    const [outcome] = await cleanRules(await h.context(), [rule('ios-updates')]);
    expect(outcome.freed).toBeGreaterThanOrEqual(3 * MB);
    expect(existsSync(h.at('Library/iTunes/iPhone Software Updates/iPhone_18.1_Restore.ipsw'))).toBe(false);
  });
});

describe('Leftovers from deleted apps', () => {
  it('still recognises apps whose Info.plist holds dates and nested dictionaries', async () => {
    const h = await makeHome();
    const info = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>
      <key>BuildDate</key><date>2025-01-01T00:00:00Z</date>
      <key>Blob</key><data>AAEC</data>
      <key>NSExtension</key><dict><key>CFBundleIdentifier</key><string>com.wrong.nested</string></dict>
      <key>CFBundleIdentifier</key><string>com.example.tricky</string>
    </dict></plist>`;
    await h.file('Applications/Tricky.app/Contents/Info.plist', 0, info);
    await h.file('Library/Containers/com.example.tricky/Data/x', MB);
    const { plan } = await scanRule(rule('app-leftovers'), await h.context());
    expect(plan.targets).toEqual([]);
  });

  it('finds data of apps that are gone, and nothing of installed, related or Apple apps', async () => {
    const h = await makeHome();
    await h.file('Applications/Foo.app/Contents/Info.plist', 0, plist({ CFBundleIdentifier: 'com.foo.app', CFBundleName: 'Foo' }));
    const kept = [
      'Library/Containers/com.foo.app/Data/x',
      'Library/Containers/com.foo.app.ShareExtension/Data/x',
      'Library/Containers/com.foo.sharedauth/Data/x', // same vendor as an installed app
      'Library/Application Scripts/ABCDE12345.com.foo.app/x', // team-prefixed
      'Library/Application Scripts/group.com.apple.notes/x',
      'Library/Application Scripts/74J34U3R6X.com.apple.iWork/x',
      'Library/Application Scripts/6DT6U8T2R4.is.workflow.my.app/x', // Apple's Shortcuts
      'Library/Containers/com.apple.Notes/Data/x',
      'Library/Containers/0A1B2C3D-UUID/Data/x',
      'Library/Containers/net.running.app/Data/x',
    ];
    for (const p of kept) await h.file(p, MB);
    await h.file('Library/Containers/org.gone.app/Data/x', 2 * MB);
    await h.file('Library/Saved Application State/org.gone.app.savedState/data.data', MB);
    await h.file('Library/HTTPStorages/org.gone.app.binarycookies', MB);
    await h.file('Library/Application Scripts/ZZZZZ99999.org.gone.app/x', MB);
    const ctx = await h.context({ bundleIds: new Set(['net.running.app']) });
    const { plan } = await scanRule(rule('app-leftovers'), ctx);
    expect(plan.targets.map((t) => t.slice(h.home.length)).sort()).toEqual([
      '/Library/Application Scripts/ZZZZZ99999.org.gone.app',
      '/Library/Containers/org.gone.app',
      '/Library/HTTPStorages/org.gone.app.binarycookies',
      '/Library/Saved Application State/org.gone.app.savedState',
    ]);
    expect(plan.labels?.[h.at('Library/Containers/org.gone.app')]).toBe('org.gone.app · Containers');
  });
});

describe('Browsers & apps', () => {
  it('clears Firefox profile caches but not the profile itself', async () => {
    const h = await makeHome();
    await h.file('Library/Caches/Firefox/Profiles/abc.default-release/cache2/entries/1', 2 * MB);
    await h.file('Library/Application Support/Firefox/Profiles/abc.default-release/places.sqlite', MB);
    await cleanRules(await h.context(), [rule('firefox')]);
    expect(existsSync(h.at('Library/Caches/Firefox/Profiles/abc.default-release/cache2'))).toBe(false);
    expect(existsSync(h.at('Library/Application Support/Firefox/Profiles/abc.default-release/places.sqlite'))).toBe(true);
  });

  it('leaves Safari alone while it runs', async () => {
    const h = await makeHome();
    await h.file('Library/Caches/com.apple.Safari/WebKitCache/x', 2 * MB);
    const running = await h.context({ commands: ['/Applications/Safari.app/Contents/MacOS/Safari'] });
    const [blocked] = await cleanRules(running, [rule('safari')]);
    expect(blocked.error).toBe('Quit Safari to clean');
    expect(existsSync(h.at('Library/Caches/com.apple.Safari/WebKitCache/x'))).toBe(true);
    await cleanRules(await h.context(), [rule('safari')]);
    expect(existsSync(h.at('Library/Caches/com.apple.Safari'))).toBe(false);
  });

  it('only removes Mail attachment copies, never the mailbox', async () => {
    const h = await makeHome();
    await h.file('Library/Containers/com.apple.mail/Data/Library/Mail Downloads/ABC/report.pdf', 2 * MB);
    await h.file('Library/Mail/V10/INBOX.mbox/1.emlx', MB);
    await cleanRules(await h.context(), [rule('mail-attachments')]);
    expect(existsSync(h.at('Library/Containers/com.apple.mail/Data/Library/Mail Downloads/ABC'))).toBe(false);
    expect(existsSync(h.at('Library/Mail/V10/INBOX.mbox/1.emlx'))).toBe(true);
  });
});
