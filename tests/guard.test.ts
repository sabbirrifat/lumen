import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertDeletable, assertTrashable } from '~engine/guard';
import { makeHome } from './fixture';

describe('assertDeletable', () => {
  it('allows paths strictly inside a rule root', async () => {
    const h = await makeHome();
    const target = await h.file('.npm/_cacache/x');
    const ctx = await h.context();
    await expect(assertDeletable(target, ctx, { roots: [h.at('.npm/_cacache')] })).resolves.toBeUndefined();
  });

  it('rejects the root itself, paths outside it, and unclean paths', async () => {
    const h = await makeHome();
    await h.file('.npm/_cacache/x');
    const ctx = await h.context();
    const roots = [h.at('.npm/_cacache')];
    await expect(assertDeletable(h.at('.npm/_cacache'), ctx, { roots })).rejects.toThrow(/outside/);
    await expect(assertDeletable(h.at('.npm/other'), ctx, { roots })).rejects.toThrow(/outside/);
    await expect(assertDeletable(`${h.at('.npm/_cacache')}/../../Documents`, ctx, { roots })).rejects.toThrow(/clean absolute/);
    await expect(assertDeletable('relative/path', ctx, { roots })).rejects.toThrow(/clean absolute/);
  });

  it('rejects the home folder and anything above it, whatever the roots say', async () => {
    const h = await makeHome();
    const ctx = await h.context();
    await expect(assertDeletable(h.home, ctx, { roots: [path.dirname(h.home)] })).rejects.toThrow(/home folder/);
    await expect(assertDeletable(path.dirname(h.home), ctx, { roots: ['/'] })).rejects.toThrow(/home folder/);
    await expect(assertDeletable(h.at('Documents'), ctx, { roots: [h.home] })).rejects.toThrow(/outside/);
  });

  it('protects personal folders except node_modules when the rule allows it', async () => {
    const h = await makeHome();
    await h.file('Documents/app/node_modules/x');
    await h.file('Documents/app/src/index.ts');
    const ctx = await h.context();
    const roots = [h.at('Documents')];
    await expect(assertDeletable(h.at('Documents/app/src'), ctx, { roots })).rejects.toThrow(/protected/);
    await expect(assertDeletable(h.at('Documents/app/node_modules'), ctx, { roots })).rejects.toThrow(/protected/);
    await expect(assertDeletable(h.at('Documents/app/node_modules'), ctx, { roots, allowNodeModules: true })).resolves.toBeUndefined();
    await expect(assertDeletable(h.at('Documents/app/src'), ctx, { roots, allowNodeModules: true })).rejects.toThrow(/protected/);
  });

  it('rejects targets reached through a symlinked folder', async () => {
    const h = await makeHome();
    const outside = await mkdtemp(path.join(os.tmpdir(), 'lumen-outside-'));
    await h.dir('.cache/tool');
    await h.link('.cache/tool/escape', outside);
    const ctx = await h.context();
    await expect(assertDeletable(h.at('.cache/tool/escape/file'), ctx, { roots: [h.at('.cache/tool')] })).rejects.toThrow(/symlink/);
    // The link itself is fine to delete: rm removes the link, not what it points to.
    await expect(assertDeletable(h.at('.cache/tool/escape'), ctx, { roots: [h.at('.cache/tool')] })).resolves.toBeUndefined();
  });

  it('respects folders excluded in Settings', async () => {
    const h = await makeHome();
    await h.file('.npm/_cacache/keep/x');
    const ctx = await h.context({}, { excluded: [h.at('.npm/_cacache/keep')] });
    await expect(assertDeletable(h.at('.npm/_cacache/keep'), ctx, { roots: [h.at('.npm/_cacache')] })).rejects.toThrow(/excluded/);
  });
});

describe('assertTrashable', () => {
  it('allows ordinary files in the home folder', async () => {
    const h = await makeHome();
    const file = await h.file('Downloads/movie.mov');
    await expect(assertTrashable(file, await h.context())).resolves.toBeUndefined();
  });

  it('refuses standard folders and ~/Library', async () => {
    const h = await makeHome();
    await h.file('Library/Preferences/x.plist');
    await h.dir('Downloads');
    const ctx = await h.context();
    await expect(assertTrashable(h.at('Downloads'), ctx)).rejects.toThrow(/standard macOS folder/);
    await expect(assertTrashable(h.at('Library/Preferences/x.plist'), ctx)).rejects.toThrow(/Library/);
  });

  it('only allows the roots it is given', async () => {
    const h = await makeHome();
    const leftover = await h.file('Library/Caches/com.foo.app/x');
    const ctx = await h.context();
    const roots = [h.at('Library/Caches')];
    await expect(assertTrashable(path.dirname(leftover), ctx, roots)).resolves.toBeUndefined();
    await expect(assertTrashable(h.at('Documents/x'), ctx, roots)).rejects.toThrow(/outside/);
  });
});
