import { describe, expect, it } from 'vitest';
import { findLargeFiles, kindOf } from '~engine/largeFiles';
import { listDir } from '~engine/spaceLens';
import { findLeftovers, listApps } from '~engine/uninstaller';
import { makeHome, MB } from './fixture';

const plist = (id: string, name: string) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${id}</string>
<key>CFBundleName</key><string>${name}</string>
<key>CFBundleShortVersionString</key><string>2.1.0</string>
</dict></plist>`;

describe('Space Lens', () => {
  it('lists folders and files largest first, marking bundles', async () => {
    const h = await makeHome();
    await h.file('big/a', 3 * MB);
    await h.file('small.txt', MB);
    await h.file('Thing.app/Contents/MacOS/thing', 2 * MB);
    const entries = await listDir(h.home);
    expect(entries.map((e) => e.name)).toEqual(['big', 'Thing.app', 'small.txt']);
    expect(entries[0].size).toBeGreaterThanOrEqual(3 * MB);
    expect(entries.find((e) => e.name === 'Thing.app')?.isPackage).toBe(true);
    expect(entries.find((e) => e.name === 'small.txt')?.isDir).toBe(false);
  });
});

describe('Large & Old Files', () => {
  it('finds big files and skips Library, hidden folders, node_modules and bundles', async () => {
    const h = await makeHome();
    await h.file('Downloads/installer.dmg', 3 * MB);
    await h.file('Movies/clip.mov', 2 * MB);
    await h.file('Downloads/tiny.zip', 100);
    await h.file('Library/Caches/huge.bin', 3 * MB);
    await h.file('.cache/model.bin', 3 * MB);
    await h.file('Documents/app/node_modules/big.node', 3 * MB);
    await h.file('Applications/Thing.app/Contents/big', 3 * MB);
    const files = await findLargeFiles(h.home, MB);
    expect(files.map((f) => f.name)).toEqual(['installer.dmg', 'clip.mov']);
    expect(files[0].kind).toBe('disk-image');
  });

  it('classifies files by extension', () => {
    expect(kindOf('a.MOV')).toBe('video');
    expect(kindOf('b.tar.gz')).toBe('archive');
    expect(kindOf('c.pkg')).toBe('installer');
    expect(kindOf('d.unknown')).toBe('other');
  });
});

describe('Uninstaller', () => {
  it('lists user apps and finds their leftovers by bundle id and name', async () => {
    const h = await makeHome();
    await h.file('Applications/Foo.app/Contents/Info.plist', 0, plist('com.example.foo', 'Foo Studio'));
    await h.file('Applications/Foo.app/Contents/MacOS/foo', 2 * MB);
    await h.file('Applications/Mail Copy.app/Contents/Info.plist', 0, plist('com.apple.mail', 'Mail'));
    await h.file('Library/Application Support/Foo Studio/data.db');
    await h.file('Library/Caches/com.example.foo/cache');
    await h.file('Library/Preferences/com.example.foo.plist', 100);
    await h.file('Library/Application Support/Fooey/keep');
    const ctx = await h.context({ bundleIds: new Set(['com.example.foo']) });
    const apps = await listApps(ctx);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ name: 'Foo Studio', bundleId: 'com.example.foo', version: '2.1.0', running: true });
    const leftovers = await findLeftovers(ctx, apps[0]);
    expect(leftovers.map((l) => l.path.slice(h.home.length)).sort()).toEqual([
      '/Library/Application Support/Foo Studio',
      '/Library/Caches/com.example.foo',
      '/Library/Preferences/com.example.foo.plist',
    ]);
  });
});
